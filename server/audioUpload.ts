/**
 * Audio upload endpoint for Voice-to-Quote.
 *
 * POST /api/portal/upload-audio
 * - Requires portal session cookie (verifies via portal.me)
 * - Accepts multipart/form-data with a single "file" field (audio/webm, audio/mp4, etc.)
 * - Uploads to S3 and returns { url }
 * - Max 16MB (Whisper limit)
 * - All errors return JSON (never HTML) so the client can parse them reliably
 */
import { Router, Request, Response, NextFunction } from "express";
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

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB (Whisper limit)
  fileFilter: (_req, file, cb) => {
    // Accept any audio/* MIME type — Whisper handles the format validation
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are accepted"));
    }
  },
});

const router = Router();

router.post(
  "/portal/upload-audio",
  // Wrap multer so errors are caught and returned as JSON (not HTML)
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      const multerErr = err as Error & { code?: string };
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Audio file exceeds the 16MB limit" });
        return;
      }
      res.status(400).json({ error: multerErr.message ?? "File upload error" });
    });
  },
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

      // Determine extension from MIME type (strip codec params for lookup)
      const baseMime = file.mimetype.split(";")[0].trim().toLowerCase();
      const ext = MIME_TO_EXT[file.mimetype] ?? MIME_TO_EXT[baseMime] ?? baseMime.split("/")[1] ?? "audio";

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
