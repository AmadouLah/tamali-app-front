const TITLE = 'Tamali';
const TAG_PREFIX = 'tamali-instant';
const DEDUP_TTL_MS = 90_000;
const recentNotificationIds = new Map<string, number>();

function notificationTag(notificationId: string | undefined): string {
  const id = notificationId?.trim();
  return id ? `${TAG_PREFIX}-${id}` : TAG_PREFIX;
}

function pruneDedup(now: number): void {
  for (const [id, t] of recentNotificationIds) {
    if (now - t > DEDUP_TTL_MS) recentNotificationIds.delete(id);
  }
}

/**
 * Notification navigateur / OS (bandeau, centre de notifications), pas un toast in-app.
 * Même tag que le Web Push lorsque notificationId provient du backend.
 * Déduplique par {@param notificationId} (plusieurs onglets / sources).
 */
export function showTamaliInstantSystemNotification(body: string, notificationId?: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const id = notificationId?.trim();
  const now = Date.now();
  pruneDedup(now);
  if (id) {
    if (recentNotificationIds.has(id)) return;
    recentNotificationIds.set(id, now);
  }
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
