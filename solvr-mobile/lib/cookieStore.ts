import * as SecureStore from "expo-secure-store";

const COOKIE_KEY = "solvr_portal_cookie";

export async function getStoredCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(COOKIE_KEY);
}

export async function storeSessionCookie(
  setCookieHeader: string
): Promise<void> {
  const match = setCookieHeader.match(/solvr_portal_session=([^;]+)/);
  if (match) {
    await SecureStore.setItemAsync(
      COOKIE_KEY,
      `solvr_portal_session=${match[1]}`
    );
  }
}

export async function clearStoredCookie(): Promise<void> {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
}
