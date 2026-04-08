/**
 * Audio upload endpoint for Voice-to-Quote.
 *
 * POST /api/portal/upload-audio
 * - Requires portal session cookie (verifies via portal.me)
 * - Accepts multipart/form-data with a single "file" field (audio/webm, audio/mp4, etc.)
 * - Uploads to S3 and returns { url }
 * - Max 16MB (Whisper limit)
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { parse as parseCookieHeader } from "cookie";
import { getPortalSessionBySessionToken } from "./db";
import { getCrmClientById } from "./db";

const PORTAL_COOKIE = "solvr_portal_session";

async function getPortalClient(req: Request) {
  let sessionToken: string | undefined;
  const rawHeader = req.headers?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    sessionToken = parsed[PORTAL_COOKIE];
  } else {
    sessionToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[PORTAL_COOKIE];
  }
  if (!sessionToken) return null;
  const session = await getPortalSessionBySessionToken(sessionToken);
  if (!session) return null;
  if (session.sessionExpiresAt && new Date(session.sessionExpiresAt) < new Date()) return null;
  const client = await getCrmClientById(session.clientId);
  return client ? { session, client, clientId: session.clientId } : null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/m4a"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are accepted"));
    }
  },
});

const router = Router();

router.post(
  "/api/portal/upload-audio",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Verify portal session
      const session = await getPortalClient(req);
      if (!session) {
        res.status(401).json({ error: "Unauthorised" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const ext = file.mimetype.includes("webm") ? "webm"
        : file.mimetype.includes("mp4") ? "mp4"
        : file.mimetype.includes("mpeg") ? "mp3"
        : file.mimetype.includes("wav") ? "wav"
        : "audio";

      const key = `quote-recordings/${session.clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);

      res.json({ url, key });
    } catch (err) {
      console.error("[AudioUpload] Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

export { router as audioUploadRouter };
