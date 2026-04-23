/**
 * Image generation helper — DEAD STUB post-Manus migration.
 *
 * Previously hit Manus Forge's proxied ImageService. That service doesn't
 * exist on Railway and no caller in the server currently uses this function
 * (verified via grep of `generateImage(`). Kept as a stub so that if/when a
 * caller reappears it fails loudly with a clear message rather than a 500
 * on a dead URL.
 *
 * If SOLVR genuinely needs image generation later, wire it to an OpenAI
 * Images / Anthropic / Replicate endpoint here.
 */

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  _options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  throw new Error(
    "Image generation is not configured. The Manus Forge ImageService was removed during the Railway migration — wire up a direct image provider before calling generateImage()."
  );
}
