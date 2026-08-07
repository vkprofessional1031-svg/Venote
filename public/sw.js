// Venote Push Notification Service Worker
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || '⏰ Schedule Reminder';
    const options = {
      body: payload.body || 'You have an upcoming event scheduled.',
      icon: payload.icon || '/icon.svg',
      badge: payload.badge || '/icon.svg',
      tag: payload.tag || 'schedule-reminder',
      data: {
        url: payload.url || '/app/schedule',
        ...payload.data
      },
      vibrate: [200, 100, 200],
      requireInteraction: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event in service worker:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/app/schedule';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/app/schedule') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
