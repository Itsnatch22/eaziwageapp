 Error [EnvironmentError]: Environment validation failed:
[WebServer]   - CRON_SECRET is not defined
[WebServer]   - AT_SANDBOX_API_KEY or AT_API_KEY is not defined (required for Africa's Talking sandbox)
[WebServer]   - AT_SANDBOX_USERNAME or AT_USERNAME is not defined (required for Africa's Talking sandbox)
[WebServer]     at validateEnv (env.ts:211:11)
[WebServer]     at getEnv (env.ts:295:17)
[WebServer]     at module evaluation (lib/rate-limit.ts:6:19)
[WebServer]     at module evaluation (lib/mfa-handler.ts:5:1)
[WebServer]     at module evaluation (proxy.ts:7:1)
[WebServer]     at Object.<anonymous> (.next/dev/server/middleware.js:8:3)
[WebServer]   209 |
[WebServer]   210 |   if (errors.length > 0) {
[WebServer] > 211 |     throw new EnvironmentError(
[WebServer]       |           ^
[WebServer]   212 |       `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
[WebServer]   213 |     );
[WebServer]   214 |   }