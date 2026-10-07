/**
 * Error reporting. Everything that goes wrong (uncaught errors, unhandled rejections, crashed screens) is reported here.
 * The default reporter logs to the console; another can be plugged in with setReporter (nothing is sent over the
 * network by default). The last errors are kept in memory for debugging: recentErrors(), or window.__mageErrors() in
 * the browser console once the global handlers are installed.
 */

export type ErrorSource = 'error' | 'unhandledrejection' | 'react' | 'manual';

export interface ErrorReport {
  time: number;
  source: ErrorSource;
  message: string;
  stack?: string;
  /** where it happened (a screen, a game id...) */
  context?: Record<string, unknown>;
}

export type Reporter = (report: ErrorReport) => void;

export const RING_SIZE = 50;

export const consoleReporter: Reporter = (report) => {
  console.error(`[${report.source}] ${report.message}`, report.stack ?? '', report.context ?? '');
};

let reporter: Reporter = consoleReporter;
const ring: ErrorReport[] = [];

/** Replace the reporter (null restores the console one). Returns the previous reporter. */
export function setReporter(next: Reporter | null): Reporter {
  const previous = reporter;
  reporter = next ?? consoleReporter;
  return previous;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

export function reportError(error: unknown, source: ErrorSource = 'manual', context?: Record<string, unknown>): ErrorReport {
  const report: ErrorReport = { time: Date.now(), source, ...describe(error), ...(context ? { context } : {}) };
  ring.push(report);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
  try {
    reporter(report);
  } catch {
    // a broken reporter must never take the app down with it
  }
  return report;
}

/** The last errors, oldest first. */
export function recentErrors(): readonly ErrorReport[] {
  return [...ring];
}

export function clearErrors(): void {
  ring.length = 0;
}

/** Report uncaught errors and unhandled promise rejections. Returns a function that removes the handlers. */
export function installGlobalErrorHandlers(target: Window | EventTarget = window): () => void {
  const onError = (event: Event) => {
    const { error, message, filename, lineno } = event as ErrorEvent;
    reportError(error ?? message ?? 'Unknown error', 'error', filename ? { filename, line: lineno } : undefined);
  };
  const onRejection = (event: Event) => {
    reportError((event as PromiseRejectionEvent).reason, 'unhandledrejection');
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  if (typeof window !== 'undefined' && target === window) {
    (window as Window & { __mageErrors?: () => readonly ErrorReport[] }).__mageErrors = recentErrors;
  }
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
