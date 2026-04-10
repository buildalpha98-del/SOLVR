/**
 * Photo upload endpoint for Job before/after photos.
 *
 * POST /api/portal/upload-photo
 * - Requires portal session cookie
 * - Accepts multipart/form-data with a single "file" field (image/*)
 * - Accepts optional "photoType" field: "before" | "after" | "during" | "other"
 * - Uploads to S3 and returns { url, key }
 * - Max 10MB
 */
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { parse as parseCookieHeader } from "cookie";
import { getPortalSessionBySessionToken, getCrmClientById } from "./db";

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are accepted"));
    }
  },
});

const router = Router();

router.post(
  "/portal/upload-photo",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      const multerErr = err as Error & { code?: string };
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Image file exceeds the 10MB limit" });
        return;
      }
      res.status(400).json({ error: multerErr.message ?? "File upload error" });
    });
  },
  async (req: Request, res: Response) => {
    try {
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
      // Determine extension from MIME type
      const ext = file.mimetype.split("/")[1]?.split(";")[0] ?? "jpg";
      const photoType = (req.body?.photoType as string) ?? "other";
      const key = `job-photos/${session.clientId}/${photoType}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      res.json({ url, key });
    } catch (err) {
      console.error("[PhotoUpload] Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

export { router as photoUploadRouter };
