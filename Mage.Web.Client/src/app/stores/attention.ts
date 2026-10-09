import { useSettings } from './settings';

/**
 * Getting the player back to the tab: while the page is in the background, things that wait for them count up in the
 * tab title ("(2) Playmat") and, when the player allowed it, raise a browser notification. Coming back clears both.
 */
let pending = 0;
const open = new Map<string, Notification>();

function baseTitle(): string {
  return document.title.replace(/^\(\d+\)\s+/, '');
}

function showCount(): void {
  document.title = pending > 0 ? `(${pending}) ${baseTitle()}` : baseTitle();
}

function away(): boolean {
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Asks the browser for permission; true when notifications can be shown. */
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export interface AttentionOptions {
  /** one notification per tag: a newer one replaces it ("game:<id>", "draft") */
  tag: string;
  /** what clicking the notification does after focusing the tab */
  onClick?(): void;
}

/** Something waits for the player. Does nothing while they are looking at the page. */
export function attention(title: string, body: string, options: AttentionOptions): void {
  if (typeof document === 'undefined' || !away()) return;
  pending++;
  showCount();
  if (!useSettings.getState().settings.notifications || !notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    open.get(options.tag)?.close();
    const notification = new Notification(title, { body, tag: options.tag, icon: '/logo-512.png' });
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
    open.set(options.tag, notification);
  } catch {
    // some browsers only allow notifications from a service worker: the title count still shows
  }
}

function back(): void {
  if (away()) return;
  pending = 0;
  showCount();
  open.forEach((notification) => notification.close());
  open.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', back);
  document.addEventListener('visibilitychange', back);
}

/** for tests */
export function pendingAttention(): number {
  return pending;
}
