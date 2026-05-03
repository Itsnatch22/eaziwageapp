# Agent Rules — `eaziwageapp` (EaziWage Product App)
> For: Cursor, Windsurf, Blackbox, Codex, Gemini CLI, Kilo Code, GitHub Copilot  
> Project: `app.eaziwage.com` — Next.js authenticated product app  
> Last updated: May 2026

---

## 1. Project Identity

This is the **authenticated product application** for EaziWage, a fintech earned wage access (EWA) platform targeting East Africa (Kenya, Uganda, Tanzania, Rwanda). It lives at `app.eaziwage.com` and is separate from the marketing site (`eaziwage.com`), which lives in the `eaziwageapp` repo.

**Do not mix concerns between the two repos.** This repo handles:
- User authentication (employee and employer)
- Advance (earned wage) requests and processing
- Dashboard — balances, history, wallet
- Employer portal — payroll, employee management
- Wiza AI — financial copilot feature
- Currency handling (KES, UGX, TZS, RWF)
- Notifications and transaction history

---

## 2. Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (shared project with `advance`) |
| Auth | Supabase Auth |
| Validation | Zod |
| Deployment | Vercel |

---

## 3. Absolute Rules (Never Break These)

### 3.1 No Mock Data in Production Code
- **Never** use hardcoded balance figures, fake transaction lists, simulated advance statuses, or any fabricated financial data outside of `__mocks__` or `*.test.*` files.
- Financial data is sensitive — fake data in production is a trust and compliance risk, not just a code quality issue.
- If real data isn't available yet, render an empty/null/skeleton state — never invent numbers.
- Do not ship `console.log` statements, `debugger` calls, or commented-out dead code.

### 3.2 No Simulated APIs or Flows
- Every API route under `app/api/` must interact with **real services** — Supabase, a payment provider, or a verified external API.
- Do not fake advance request processing, approval flows, or disbursement logic with `setTimeout` or hardcoded state transitions.
- If a flow isn't wired up yet, return `501 Not Implemented` — never fake a success response.

```ts
// Acceptable placeholder
return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
```

### 3.3 Do Not Break Working Code
- Before editing any file, read it fully. Understand what it does before touching it.
- Make **surgical changes only** — edit the minimum lines necessary to accomplish the task.
- Never refactor, rename, or restructure code that wasn't part of the request.
- If you think a refactor would help, leave a comment suggesting it — do not do it unasked.
- Never delete or overwrite existing logic without explicit instruction.
- Pay special attention to: advance request state machines, auth guards, and currency conversion logic — these are critical paths.

---

## 4. Environment Variables

All secrets live in `.env.local` (local) and Vercel environment settings (production). Never hardcode them.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role — **server-side only, never expose to client** |

**Rules:**
- Variables prefixed `NEXT_PUBLIC_` are safe for client-side use.
- `SUPABASE_SERVICE_ROLE_KEY` must **only** be used in server components, API routes, or server actions — never in client components or hooks.
- Never hardcode API keys, tokens, or credentials anywhere in the codebase.

---

## 5. Supabase Usage

- The `eaziwageapp` repo shares a single Supabase project with `advance`. Be mindful of shared tables.
- Core tables owned by this repo: users, advances, transactions, wallets, employers, employees, notifications.
- Always use the **service role client** for server-side writes (API routes, server actions, admin operations).
- Always use the **anon client** with Supabase Auth session for client-side operations — RLS enforces row-level access.
- **Never disable RLS** on any table — this is a financial app, RLS is a security boundary.
- Never expose the service role key to the browser under any circumstances.

```ts
// Server-side (API routes, server actions)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Client-side (with auth session)
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 6. Authentication & Route Protection

- All dashboard and app routes must be protected — unauthenticated users redirect to `/login`.
- Auth state is managed via Supabase Auth and middleware.
- Never bypass auth checks, even for testing — use a real test account.
- Employer and employee roles have different access levels — always check the user's role before rendering sensitive UI or allowing mutations.

---

## 7. Currency Handling

EaziWage operates across multiple East African currencies. This is a critical area — currency bugs are financial bugs.

- Supported currencies: **KES, UGX, TZS, RWF**
- Always use the `useCurrency()` hook for formatting and conversion on the client side.
- Never hardcode currency symbols or conversion rates — always derive from the hook or a central utility.
- Store monetary values in the database as **integers (smallest unit / cents)** to avoid floating point errors.
- Display formatting (e.g. `KES 1,200.00`) must always go through the currency utility — never format manually inline.

---

## 8. Advance Request Flow

The advance request is the core product feature. Treat it with care.

- The advance request modal has **three UX states**: `processing`, `success`, `failed/retry`.
- Never skip or collapse these states — each one has a distinct UI and user action.
- State transitions must reflect **real backend responses**, not optimistic fakes.
- Never mark an advance as `success` without a confirmed Supabase write.

---

## 9. Wiza AI

- Wiza AI is the in-app financial copilot feature.
- It is tethered to the authenticated user's real financial data (balances, advance history, transactions).
- Never feed Wiza mock or fabricated data — it must only reference real user records from Supabase.
- Keep Wiza's scope within the app — it is not a general-purpose chatbot.

---

## 10. File & Folder Conventions

```
app/
  (auth)/            # Login, register, onboarding routes
  (dashboard)/       # Authenticated app routes
  api/               # API routes
components/
  ui/                # Base UI components
  dashboard/         # Dashboard-specific components
lib/
  supabase/          # Supabase client helpers
  validation/        # Zod schemas
  utils/
    currency.ts      # Currency formatting and conversion
hooks/
  useCurrency.ts     # Currency hook
  useAdvance.ts      # Advance request hook
```

- Keep API routes in `app/api/[route]/route.ts`.
- Keep Zod schemas in `lib/validation/`.
- Keep all currency logic in `lib/utils/currency.ts` and `hooks/useCurrency.ts` — never scattered inline.
- Do not create new top-level folders without a clear reason.

---

## 11. TypeScript

- **Strict mode is on.** No `any` types unless absolutely unavoidable — and if used, add a comment explaining why.
- Always type API request bodies, response shapes, and Supabase query results explicitly.
- Use Zod schemas for runtime validation of all incoming API data.
- Financial values must always be typed as `number` (integer cents) — never `string` or `any`.

---

## 12. What This Repo Is NOT

- Not the marketing site — do not add landing pages, blog posts, SEO pages, or the contact form here. Those belong in `advance`.
- Not a fintech sandbox — do not experiment with payment flows, fake disbursements, or test integrations directly in this repo. Use a dedicated test environment.