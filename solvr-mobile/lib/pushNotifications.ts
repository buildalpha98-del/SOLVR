import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { trpc } from "./trpc";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  try {
    await (trpc as any).portal.registerPushToken.mutate({ token });
  } catch {
    // silently fail - will retry next app open
  }

  return token;
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await (trpc as any).portal.unregisterPushToken.mutate({
      token: tokenData.data,
    });
  } catch {
    // ignore
  }
}
