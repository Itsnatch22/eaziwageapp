// Structured JSON logger for server-side use (API routes, lib).
// Output is newline-delimited JSON — compatible with Datadog, Loki, Vercel log drains, etc.
// Each line has: ts, level, sev (numeric sort key), service, message, plus caller-supplied context.
//
// Usage:
//   const log = createLogger('my-service');               // module-level
//   const log = requestLogger('my-route', req);           // per-request, injects reqId
//   const child = log.child({ advanceId, employeeId });   // narrows context for a sub-operation

type Level = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, unknown>;

const SEV: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Serialize Error instances to a plain object so they survive JSON.stringify.
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function emit(level: Level, service: string, message: string, ctx: LogContext): void {
  const line = JSON.stringify(
    { ts: new Date().toISOString(), level, sev: SEV[level], service, message, ...ctx },
    replacer,
  );
  // error and warn go to stderr so log drains can route by stream without parsing JSON.
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  /** Returns a new logger that merges `ctx` into every subsequent log line. */
  child(ctx: LogContext): Logger;
}

function make(service: string, base: LogContext): Logger {
  const l = (level: Level, msg: string, ctx: LogContext = {}) =>
    emit(level, service, msg, { ...base, ...ctx });
  return {
    debug: (m, c) => l('debug', m, c),
    info:  (m, c) => l('info', m, c),
    warn:  (m, c) => l('warn', m, c),
    error: (m, c) => l('error', m, c),
    child: (c) => make(service, { ...base, ...c }),
  };
}

/** Module-level logger — no request context. Use for lib modules and background work. */
export function createLogger(service: string): Logger {
  return make(service, {});
}

interface RequestLike {
  headers: { get(name: string): string | null };
  method?: string;
  nextUrl?: { pathname: string };
}

/**
 * Per-request logger. Extracts or generates a `reqId` from the `x-request-id` header
 * (set by Vercel, Cloudflare, or your own gateway). All child loggers inherit it, so
 * every log line for a given request shares the same `reqId` for easy correlation.
 */
export function requestLogger(service: string, req: RequestLike): Logger {
  const reqId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  return make(service, {
    reqId,
    ...(req.method  && { method: req.method }),
    ...(req.nextUrl && { path: req.nextUrl.pathname }),
  });
}
