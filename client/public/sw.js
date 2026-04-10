/**
 * Solvr Portal — Web Push Service Worker
 * Handles background push notifications for tradies.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Solvr", body: event.data.text(), url: "/portal/jobs" };
  }

  const title = data.title || "Solvr";
  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-96.png",
    data: { url: data.url || "/portal/jobs" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: "solvr-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/portal/jobs";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
