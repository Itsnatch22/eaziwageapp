import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Full trace sampling in dev for debugging; a sane fraction in prod to
  // control event volume/cost on a fintech app's request rate.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enableLogs: true,
});
