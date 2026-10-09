import { consoleReporter, type ErrorReport, type Reporter } from './reporter';

/** What the server's clientReportError takes (see ClientErrors on the server). */
export interface ClientErrorPayload {
  message: string;
  stack?: string;
  source: string;
  path: string;
  userAgent?: string;
  appVersion?: string;
  context?: string;
}

/**
 * A reporter that also sends each error to the game server (self-hosted crash reporting; nothing goes to third
 * parties). Sending is best effort: offline or refused reports are dropped, and the same message is sent once per
 * minute at most. The page path goes without its query string.
 */
export function serverReporter(
  send: (payload: ClientErrorPayload) => Promise<unknown>,
  environment: { path(): string; userAgent?: string; appVersion?: string; now?(): number },
): Reporter {
  const lastSent = new Map<string, number>();
  return (report: ErrorReport) => {
    consoleReporter(report);
    const now = environment.now?.() ?? Date.now();
    const key = `${report.source}:${report.message}`;
    const last = lastSent.get(key);
    if (last !== undefined && now - last < 60_000) return;
    lastSent.set(key, now);
    if (lastSent.size > 200) lastSent.delete(lastSent.keys().next().value!);
    let context: string | undefined;
    try {
      context = report.context ? JSON.stringify(report.context) : undefined;
    } catch {
      context = undefined;
    }
    const payload: ClientErrorPayload = {
      message: report.message.slice(0, 500),
      stack: report.stack?.slice(0, 4000),
      source: report.source,
      path: environment.path().split(/[?#]/)[0],
      userAgent: environment.userAgent,
      appVersion: environment.appVersion,
      context,
    };
    send(payload).catch(() => undefined);
  };
}
