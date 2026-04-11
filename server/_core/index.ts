import "dotenv/config";
import express from "express";
import cors from "cors";
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
import { quoteAcceptRouter } from "../quoteAccept";

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

  // Audio upload for Voice-to-Quote (multipart/form-data) — register BEFORE json middleware
  // Mount at /api so the full path becomes /api/portal/upload-audio (matching the frontend fetch call)
  app.use("/api", audioUploadRouter);
  // Photo upload for job before/after photos
  app.use("/api", photoUploadRouter);
  // Quote acceptance — public GET /api/quotes/:token/accept
  app.use("/api", quoteAcceptRouter);

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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
