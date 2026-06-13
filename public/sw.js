self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "冰箱提醒", body: "" };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
