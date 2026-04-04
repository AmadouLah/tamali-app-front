const TITLE = 'Tamali';
const TAG_PREFIX = 'tamali-instant';

function notificationTag(notificationId: string | undefined): string {
  const id = notificationId?.trim();
  return id ? `${TAG_PREFIX}-${id}` : TAG_PREFIX;
}

/**
 * Notification navigateur / OS (bandeau, centre de notifications), pas un toast in-app.
 * Même tag que le Web Push lorsque notificationId provient du backend.
 */
export function showTamaliInstantSystemNotification(body: string, notificationId?: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(TITLE, {
      body,
      tag: notificationTag(notificationId),
      requireInteraction: true,
      icon: '/favicon.ico',
      silent: false
    });
  } catch {
    /* navigateurs / contextes restreints */
  }
}
