self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Testovi", {
      body: data.body || "Imate podsetnik.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag || "testovi-reminder",
      data: { url: data.url || "/" },
      renotify: true
    })
  );
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ("focus" in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(event.notification.data?.url || "/");
  }));
});