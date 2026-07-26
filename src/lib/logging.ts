type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  details?: Record<string, unknown> | unknown;
  level?: LogLevel;
}

export function logProductionEvent(payload: LogPayload) {
  if (typeof window === 'undefined') return;
  const entry = {
    ts: new Date().toISOString(),
    ...payload,
  };

  if (payload.level === 'error') {
    console.error('[CoachPro]', entry);
  } else if (payload.level === 'warn') {
    console.warn('[CoachPro]', entry);
  } else {
    console.info('[CoachPro]', entry);
  }

  if ('navigator' in window && 'sendBeacon' in navigator) {
    try {
      navigator.sendBeacon('/api/log', JSON.stringify(entry));
    } catch {
      // ignore logging failures
    }
  }
}

export function reportCrash(error: unknown, context?: string) {
  logProductionEvent({
    level: 'error',
    message: context || 'Unhandled crash',
    details: { error: error instanceof Error ? error.message : String(error) },
  });
}
