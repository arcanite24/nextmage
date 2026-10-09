/** Formatting for the admin console. */

export const MUTE_CHOICES = [
  { minutes: 60, label: 'an hour' },
  { minutes: 24 * 60, label: 'a day' },
  { minutes: 7 * 24 * 60, label: 'a week' },
  { minutes: 30 * 24 * 60, label: 'a month' },
] as const;

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(millis: number): string {
  const minutes = Math.max(0, Math.floor(millis / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days ${hours % 24} h`;
}

export function describeAge(at: number, now: number): string {
  if (!at) return '';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  return `${formatDuration(seconds * 1000)} ago`;
}
