import * as Sentry from '@sentry/nextjs';

// Deliberately no session-replay or feedback-widget integrations here —
// both record DOM/user interactions, and this app handles account numbers,
// phone numbers, and other PII throughout its forms (see CLAUDE.md's payment
// method / KYC handling notes). Default masking exists for replay, but
// starting with error + performance monitoring only avoids that risk
// entirely until there's a deliberate decision to add it with an explicit
// mask/block configuration reviewed first.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
