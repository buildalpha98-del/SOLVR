import { getStoredCookie, storeSessionCookie } from "./cookieStore";

const AUDIO_UPLOAD_URL =
  process.env.EXPO_PUBLIC_AUDIO_UPLOAD_URL ||
  "https://solvr.com.au/api/portal/upload-audio";

export async function uploadAudio(fileUri: string): Promise<{ url: string }> {
  const cookie = await getStoredCookie();

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;

  const response = await fetch(AUDIO_UPLOAD_URL, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) await storeSessionCookie(setCookie);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${response.status})`);
  }

  return response.json();
}
