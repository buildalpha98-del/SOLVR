/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 *
 * Client-side image compression for upload paths.
 *
 * Modern phone cameras produce 4–8 MB JPEGs at 4032×3024. Uploading those
 * over rural 4G is slow and burns the user's data. Resizing to 1600px long
 * edge at JPEG quality 0.82 typically drops file size to 200–500 KB while
 * still being plenty for a quote/job photo viewed on a tablet or print.
 *
 * iOS HEIC handling: Safari's <input type="file" accept="image/*"> reads
 * HEIC files and the browser canvas can decode them via the underlying
 * platform decoder. On non-Safari browsers HEIC may fail to decode — in
 * that case we fall back to the original file unchanged.
 */

export interface CompressOptions {
  /** Max longest-edge in CSS pixels. Defaults to 1600. */
  maxDimension?: number;
  /** JPEG quality from 0–1. Defaults to 0.82. */
  quality?: number;
  /** Files smaller than this byte threshold skip compression. Defaults to 800 KB. */
  skipUnderBytes?: number;
}

const DEFAULT_OPTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  skipUnderBytes: 800 * 1024,
};

/**
 * Resize and re-encode an image File to JPEG. Returns the original File
 * unchanged when:
 *   - the file is already smaller than skipUnderBytes
 *   - the file is not an image (defensive — caller should gate)
 *   - decoding fails (CORS, malformed image, missing HEIC decoder)
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const o = { ...DEFAULT_OPTS, ...opts };

  if (!file.type.startsWith("image/")) return file;
  if (file.size <= o.skipUnderBytes) return file;

  try {
    const img = await loadImage(file);
    const { width, height } = scaleToFit(img.width, img.height, o.maxDimension);

    // Already small enough in pixels — re-encoding for size only
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", o.quality),
    );
    if (!blob) return file;

    // If our compressed output is somehow larger than the source, ship the source.
    if (blob.size >= file.size) return file;

    const newName = renameToJpg(file.name);
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (err) {
    // Swallow and fall back to the original — a working upload beats a broken one.
    console.warn("[imageCompression] falling back to original:", err);
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function scaleToFit(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

function renameToJpg(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.jpg`;
}
