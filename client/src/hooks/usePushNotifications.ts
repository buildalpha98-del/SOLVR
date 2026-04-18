/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * usePushNotifications — Web Push subscription management for the Solvr portal.
 *
 * Usage:
 *   const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: vapidData } = trpc.portal.getVapidPublicKey.useQuery(undefined, {
    retry: false,
  });

  const subscribeMutation = trpc.portal.subscribePush.useMutation();
  const unsubscribeMutation = trpc.portal.unsubscribePush.useMutation();

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      // Check if already subscribed
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setIsSubscribed(true);
          setCurrentEndpoint(sub.endpoint);
        }
      }).catch(() => {});
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidData?.publicKey) return;

    setIsLoading(true);
    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
      toast.error("Notifications blocked — enable them in your browser settings.");
        return;
      }

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint!,
        p256dh: (json.keys as Record<string, string>).p256dh,
        auth: (json.keys as Record<string, string>).auth,
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      setCurrentEndpoint(json.endpoint!);
      toast.success("Notifications enabled — you'll get instant alerts when a new call comes in.");
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      toast.error("Couldn't enable notifications — please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidData, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    if (!currentEndpoint) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await unsubscribeMutation.mutateAsync({ endpoint: currentEndpoint });
      setIsSubscribed(false);
      setCurrentEndpoint(null);
      toast.success("Notifications disabled.");
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentEndpoint, unsubscribeMutation]);

  return { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
