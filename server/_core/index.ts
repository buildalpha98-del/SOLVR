import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe";
import { handleVapiWebhook } from "../vapiWebhook";
import { audioUploadRouter } from "../audioUpload";
import { photoUploadRouter } from "../photoUpload";
import { registerMonthlyCallReportCron } from "../cron/monthlyCallReport";
import { registerSessionExpiryWarningCron } from "../cron/sessionExpiryWarning";
import { scheduleInvoiceChasingCron } from "../cron/invoiceChasing";
import { scheduleOnboardingEmailSequence } from "../cron/onboardingEmailSequence";
import { scheduleWeeklySummaryEmail } from "../cron/weeklySummaryEmail";
import { scheduleQuoteFollowUpCron } from "../cron/quoteFollowUp";
import { scheduleStaffTimesheetCrons } from "../cron/staffTimesheet";
import { scheduleReviewRequestDispatchCron } from "../cron/reviewRequestDispatch";
import { scheduleLateCheckinAlertCron } from "../cron/lateCheckinAlert";
import { scheduleSmsCampaignsCron } from "../cron/scheduledSmsCampaigns";
import { scheduleAppointmentReminderCron } from "../cron/appointmentReminder";
import { scheduleLicenceExpiryWarningCron } from "../cron/licenceExpiryWarning";
import { scheduleIdleJobNudgeCron } from "../cron/idleJobNudge";
import { handleTwilioInboundSms } from "../twilioInboundSms";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Trust the Manus reverse proxy so Set-Cookie headers work correctly in production
  // Without this, Express doesn't recognise the request as HTTPS and secure cookies fail
  app.set('trust proxy', 1);

  // ─── Security headers (Helmet) ────────────────────────────────────────────────
  // Applied before all routes. Adds X-Frame-Options, X-Content-Type-Options,
  // Referrer-Policy, Permissions-Policy, and more.
  app.use(helmet({
    // CSP is deferred — needs tuning for Vite/React inline scripts
    contentSecurityPolicy: false,
    // Allow cross-origin resources for Capacitor iOS
    crossOriginEmbedderPolicy: false,
  }));

  // ─── Rate Limiters ────────────────────────────────────────────────────────────
  /**
   * Staff PIN login: max 10 attempts per 15 minutes per IP.
   * A 4-digit PIN has 10,000 combinations — without this an attacker
   * can brute-force it in seconds.
   */
  const staffLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
    skip: (req) => !req.ip,
  });

  /**
   * Owner portal password login: max 10 attempts per 15 minutes per IP.
   */
  const portalLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
    skip: (req) => !req.ip,
  });

  /**
   * Forgot-password: max 5 requests per hour per IP to prevent email enumeration.
   */
  const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset requests. Please wait 1 hour before trying again." },
    skip: (req) => !req.ip,
  });

  // Apply rate limiters to specific tRPC batch paths
  // tRPC batches use the procedure name as a query param: /api/trpc/staffPortal.login
  app.use("/api/trpc/staffPortal.login", staffLoginLimiter);
  app.use("/api/trpc/portal.passwordLogin", portalLoginLimiter);
  app.use("/api/trpc/portal.forgotPassword", forgotPasswordLimiter);

  // CORS — allow the Capacitor iOS origin and local dev in addition to production
  const allowedOrigins = [
    "https://solvr.com.au",
    "https://www.solvr.com.au",
    "https://solvr.manus.space",
    "capacitor://localhost",  // iOS Capacitor app
    "http://localhost:5173",  // Vite dev server
    "http://localhost:3000",  // Express dev server
  ];
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, server-to-server)
      if (!origin) return cb(null, true);
      // Allow Manus sandbox preview URLs (*.manus.computer, *.manus.space)
      if (origin.endsWith(".manus.computer") || origin.endsWith(".manus.space")) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }));

  // Stripe webhook MUST use raw body — register BEFORE json middleware
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

  // Vapi webhook — receives call events (transcripts, summaries)
  // Must include json middleware inline since it's registered before the global parser
  app.post("/api/vapi/webhook", express.json({ limit: "10mb" }), handleVapiWebhook);

  // Twilio inbound SMS — receives customer replies to booking/quote SMS messages
  // Uses urlencoded body (Twilio sends application/x-www-form-urlencoded)
  app.post("/api/twilio/inbound-sms", express.urlencoded({ extended: false }), handleTwilioInboundSms);

  // Audio upload for Voice-to-Quote (multipart/form-data) — register BEFORE json middleware
  // Mount at /api so the full path becomes /api/portal/upload-audio (matching the frontend fetch call)
  app.use("/api", audioUploadRouter);
  // Photo upload for job before/after photos
  app.use("/api", photoUploadRouter);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Register cron jobs
  registerMonthlyCallReportCron();
  registerSessionExpiryWarningCron();
  scheduleInvoiceChasingCron();
  scheduleOnboardingEmailSequence();
  scheduleWeeklySummaryEmail();
  scheduleQuoteFollowUpCron();
  scheduleStaffTimesheetCrons();
  scheduleReviewRequestDispatchCron();
  scheduleLateCheckinAlertCron();
  scheduleSmsCampaignsCron();
  scheduleAppointmentReminderCron();
  scheduleLicenceExpiryWarningCron();
  scheduleIdleJobNudgeCron();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
