self.addEventListener('push', function(event) {
  try {
    const payload = event.data ? event.data.json() : { title: 'Notification', body: '' };
    const title = payload.title || 'Notification';
    const options = {
      body: payload.body || '',
      data: payload.data || {},
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('sw push handler error', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(windowClients => {
    for (let client of windowClients) {
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
