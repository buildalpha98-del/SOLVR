/**
 * Audio upload helper — POSTs a recorded audio file to the SOLVR backend.
 * Uses NSURLSession's native cookie jar via `credentials: "include"`; no manual
 * cookie handling (see lib/trpc.ts for rationale).
 */

const AUDIO_UPLOAD_URL =
  process.env.EXPO_PUBLIC_AUDIO_UPLOAD_URL ||
  "https://solvr.com.au/api/portal/upload-audio";

export async function uploadAudio(fileUri: string): Promise<{ url: string; key?: string }> {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as unknown as Blob);

  const response = await fetch(AUDIO_UPLOAD_URL, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Upload failed (${response.status})`);
  }

  return response.json();
}
