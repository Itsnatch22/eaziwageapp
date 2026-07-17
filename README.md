# EaziWage — Earned Wage Access Platform

EaziWage is a production-grade **Earned Wage Access (EWA)** platform that enables employees to access a portion of their earned wages before payday. Built on **Next.js 16**, **TypeScript**, and **Supabase**, the system connects employees, employers, and administrators through secure, role-based dashboards with real fund movement via the **DusuPay** payment gateway.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [End-to-End Workflow](#end-to-end-workflow)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Security & Compliance](#security--compliance)
- [Deployment](#deployment)

---

## Overview

Financial stress is one of the leading causes of reduced productivity in the workplace. EaziWage addresses this by allowing employees to request wage advances against their already-earned salary, with funds disbursed directly to their mobile money or bank accounts. Employers retain full control over approval workflows and risk exposure, while administrators oversee operations, compliance, and liquidity.

**Supported Markets:** Kenya (KE), Uganda (UG), Tanzania (TZ), Rwanda (RW)

---

## Key Features

### For Employees
- **Request Wage Advances** — Calculate and request advances based on employer-configured limits
- **Real Disbursement** — Receive funds via M-Pesa, Airtel Money, MTN MoMo, Tigo Pesa, or bank transfer, validated against DusuPay's own supported-provider list before a request can be submitted
- **KYC Document Upload** — Submit ID, tax, and employment documents for verification
- **Advance History** — Track pending, approved, processing, completed, failed, and rejected transactions

### For Employers
- **Employee Management** — Onboard employees, configure EWA settings, and manage eligibility
- **Advance Review & Approval** — Review requests with risk-adjusted fee calculations
- **Risk Insights Dashboard** — View automated risk scores (0–5 scale) based on financial health, compliance, and payroll sustainability
- **Wallet & Funding** — Track outstanding liability, request wallet top-ups, and (depending on funding model — see [System Architecture](#system-architecture)) either pay EaziWage directly via DusuPay or receive funded credit from EaziWage
- **Payday Recoupment** — Automated payday-triggered collection of outstanding balances via DusuPay mobile money, with a manual bank-transfer fallback

### For Administrators
- **KYC Review & Verification** — Approve or reject employee and employer onboarding documents
- **Fund Management** — Record Stanbic deposits into the platform's admin wallet, and approve employer wallet top-up requests (which now route through a real DusuPay collection or payout, depending on the employer's funding model)
- **Fraud Detection** — Monitor automated alerts for amount thresholds, frequency violations, and velocity attacks
- **Reconciliation & Reporting** — A daily job cross-checks advance and wallet-funding statuses against DusuPay's live transaction status and records any drift for review
- **System Health & Notifications** — In-app, web push, and email alerts for critical events; live dashboard updates via Supabase Realtime

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | React framework with SSR, API routes, and `proxy.ts` (Next 16's replacement for `middleware.ts`) for auth/role gating |
| **Language** | TypeScript 5 | Type-safe development across the entire stack |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Utility-first CSS and accessible UI components |
| **Database** | Supabase (PostgreSQL) | Relational data with Row-Level Security (RLS) as the primary access-control boundary |
| **ORM** | Drizzle ORM + direct Supabase clients | Schema management (`lib/db/schema.ts`); most business logic uses Supabase clients directly |
| **Auth** | Supabase Auth | Session-based auth with role-based access control, enforced in `proxy.ts` |
| **Payments** | DusuPay API | Mobile money and bank payout/collection — two client implementations exist (`lib/dusupay.ts` for the webhook/verify path, `lib/dusupay/client.ts` for outbound payout/collection calls) — see [System Architecture](#system-architecture) |
| **Email** | Resend + React Email | Templates in `lib/emails/*.tsx`; dispatched via `lib/email-service.ts` |
| **Real-Time** | Supabase Realtime | Live dashboard updates and in-app notifications (migrated off Pusher — do not reintroduce Pusher code) |
| **Push Notifications** | Web Push (VAPID) | Browser push as part of the notification delivery chain in `lib/notifications.ts` |
| **Rate Limiting** | Upstash Redis | API rate limiting and brute-force protection (no-op'd under `PLAYWRIGHT_TEST=1`) |
| **Validation** | Zod | Runtime schema validation for all inputs (`lib/validations/`) |
| **Testing** | Vitest + Playwright | Unit tests (`tests/unit/*.test.ts`) and end-to-end tests (`tests/*.spec.ts`) |

---

## System Architecture

### Three-Tier Money Flow

```
┌─────────────────────────────────────────────┐
│         Admin Wallet (Main Stanbic)         │
│      USD-denominated platform liquidity     │
└──────────────────┬──────────────────────────┘
                   │ Employer wallet top-up approval
                   │ (routes through real DusuPay calls,
                   │  see below)
                   ▼
┌─────────────────────────────────────────────┐
│              Employer Wallet                │
│   Liability tracker, not a prepaid balance:  │
│   total_advanced / outstanding_liability /   │
│   total_repaid / reserved_amount             │
└──────────────────┬──────────────────────────┘
                   │ reserveFunds() → disburseAdvance()
                   ▼
┌─────────────────────────────────────────────┐
│              DusuPay Gateway                 │
│   Real mobile money / bank disbursement      │
└─────────────────────────────────────────────┘
```

Employer wallets track what an employer owes EaziWage, not a spendable prepaid balance. How an employer's top-up request actually moves money depends on `employers.funding_model`:

- **`prefunded`** — a collection leg. The employer pays their own money into EaziWage via a DusuPay mobile money collection; on admin approval, `initializeCollection()` is called and the employer's available balance (`total_advanced`) is credited once DusuPay confirms via webhook.
- **`debit_order` / `invoice`** — a payout leg. EaziWage sends the employer real cash via DusuPay (`sendFunds()`, resolved against their bank or mobile money on file), recorded as real liability (`outstanding_liability`) that is collected back automatically on their payday through the recoupment flow below.

Either way, a DusuPay call that fails ambiguously (no confirmed response) is never assumed to have failed — the row is left in a `processing` state and resolved by a daily reconciliation job that checks DusuPay's real transaction status, never by an automatic or one-click retry with the same reference.

Individual employee advances are always disbursed the same way regardless of the employer's funding model: `reserveFunds()` holds the amount against the employer's available balance, then `disburseAdvance()` sends it to the employee via DusuPay.

**Payday recoupment**: on an employer's configured payday, `payday_recoupments` are created for their full outstanding liability and collected via a DusuPay mobile money charge (with a manual bank-transfer admin fallback) — independent of and unaffected by their funding model.

### Core Services

- **`lib/services/payout-service.ts`** — Centralized fund movement: eligibility checks, fraud screening, fund reservation, and employee disbursement
- **`lib/services/payday-recoupment-service.ts`** — Payday-triggered liability collection from employers
- **`lib/dusupay.ts`** — DusuPay client used by the webhook handler (`app/api/webhook/dusupay/route.ts`) and the status-verify route (`app/api/dusupay/verify/route.ts`) — the security-critical inbound path
- **`lib/dusupay/client.ts`** — DusuPay client used for outbound calls: employee/employer payouts, mobile money collections, and admin balance sync. The two clients are not interchangeable — check which one a file imports before assuming shared behavior
- **`lib/fraud-engine.ts`** — Rule-based fraud detection (amount, frequency, velocity)
- **`lib/server/admin-auth.ts`** — Canonical admin-access check (`system_admins` table, falling back to `profiles.role`)
- **`lib/notifications.ts`** — Multi-channel notification dispatch: writes an in-app row, attempts Web Push, falls back to a Resend email — the in-app row is always the guaranteed delivery
- **`lib/paymentMethodsService.ts`** — The only place that should read decrypted `payment_methods` PII

---

## End-to-End Workflow

### 1. Employee Request
- Employee visits the **Request Advance** page and selects a saved, verified payment method (`payment_methods` table — mobile money or bank, PII-encrypted at rest)
- System calculates the **platform fee** based on the employer's risk score
- Employee sees **Gross Amount**, **Fee**, and **Net Disbursement**
- Request is saved to the `advances` table with `pending` status; a partial unique index guarantees an employee can never have two pending requests at once, which also protects against accidental duplicate submissions on a network retry

### 2. Employer Review & Approval
- Employer views the request in their **Advances Dashboard** (or it's handled automatically if the employer has opted into auto-approval for low-risk employees)
- On approval, the system calls `payoutService.reserveFunds()`, which locks the amount against the employer's available balance (`total_advanced - total_repaid - reserved_amount`)
- Approval is blocked if the employer has insufficient available balance, disbursements are frozen, or the employer is in default

### 3. Disbursement
- Approval synchronously triggers `payoutService.disburseAdvance()`, which re-runs eligibility and fraud checks, resolves the employee's payout provider, and calls DusuPay
- If DusuPay's response is ambiguous (no confirmation received), the service checks DusuPay's real transaction status before ever marking the advance failed — a duplicate submission with the same reference is guaranteed by DusuPay to be rejected outright rather than processed twice, so this can never cause a duplicate real payout

### 4. DusuPay Webhook Confirmation
- DusuPay delivers a signed webhook to `/api/webhook/dusupay`, verified via HMAC-SHA256
- **Success:** Advance status moves to `completed`; a repayment schedule is created
- **Failure:** Advance status moves to `failed`; reserved funds are released back to the employer
- A daily reconciliation job independently cross-checks every non-terminal advance and wallet-funding transaction against DusuPay's real status, catching anything a missed or delayed webhook would otherwise leave stuck

---

## Project Structure

```
eaziwageapp/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Login page
│   ├── layout.tsx                # Root layout with fonts & analytics
│   ├── api/                      # API routes (auth, advances, webhooks, cron, etc.)
│   ├── admin/                    # Admin dashboard pages
│   ├── dashboards/               # Employer & employee dashboards
│   ├── register/                 # Account registration
│   ├── forgot-password/          # Password recovery
│   └── ...
├── proxy.ts                      # Auth/role gate for all routes (Next 16 middleware equivalent)
├── components/
│   ├── admin/                    # Admin-specific layouts & components
│   ├── employer/                 # Employer dashboard components
│   ├── employee/                 # Employee dashboard components
│   ├── shared/                   # Cross-role shared components (CopyButton, Skeletons, etc.)
│   ├── layout/                   # Shared layout components (chat, notifications)
│   └── ui/                       # shadcn/ui base components
├── lib/
│   ├── services/                 # Business logic (payout, payday recoupment, earnings)
│   ├── dusupay.ts                # DusuPay client — webhook/verify path
│   ├── dusupay/                  # DusuPay client — outbound payout/collection path (types, utils, webhooks)
│   ├── emails/                   # React Email templates
│   ├── auth.ts                   # Authentication utilities
│   ├── fraud-engine.ts           # Fraud detection engine
│   ├── email-service.ts          # Resend-based email delivery
│   ├── notifications.ts          # In-app / web push / email notification dispatch
│   ├── supabaseAdmin.ts          # Service-role Supabase client (bypasses RLS — trusted contexts only)
│   ├── supabaseServer.ts         # Server-side user-scoped Supabase client
│   ├── constants/                # Canonical column-name constants and status-list guards
│   └── validations/              # Zod schemas for all inputs
├── types/                        # Shared TypeScript types
├── hooks/                        # Custom React hooks (useNotifications, useRealtimeRefresh, etc.)
├── supabase/migrations/          # SQL migration history, tracked in full
├── public/                       # Static assets
├── tests/                        # Playwright specs + tests/unit (Vitest)
└── env.ts                        # Environment variable validation
```

---

## Environment Variables

Create a `.env.local` file with the following variables. `env.ts` validates a subset of these at server startup — the app will not start if a required one is missing or malformed. DusuPay and Stanbic/cron secrets outside that subset are read directly from `process.env` where used.

### Required — validated by `env.ts`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Google reCAPTCHA v3 site key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (bypasses RLS) |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v3 secret key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `PII_ENCRYPTION_KEY` | Encryption key for payment-method/bank-account PII and OTP hashing (min 16 characters) |
| `ADMIN_PASSWORD` | Initial admin account password |
| `STANBIC_API_KEY` **or** `STANBIC_SANDBOX_API_KEY` | At least one is required |

### Optional — validated only if present

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Base URL of the deployed application |
| `ADMIN_NOTIFICATION_EMAIL` | Where critical admin alerts are sent |
| `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `SUPABASE_PRIVATE_VAPID_KEY` / `PUSH_VAPID_CONTACT` | Web push notification keys |
| `STANBIC_CLIENT_SECRET` | Required if `STANBIC_TOKEN_URL` is set |
| `STANBIC_BASE_URL` / `STANBIC_SANDBOX_BASE_URL` / `STANBIC_SANDBOX_URL_ENDPOINT` / `STANBIC_TOKEN_URL` | Stanbic API endpoint configuration |

### Read directly from `process.env` — not validated by `env.ts`

| Variable | Description |
|----------|-------------|
| `DUSUPAY_PUBLIC_KEY` / `DUSUPAY_SECRET_KEY` | DusuPay merchant API credentials |
| `DUSUPAY_WEBHOOK_SECRET` | Used to verify inbound webhook signatures |
| `DUSUPAY_ENVIRONMENT` | `sandbox` or `production` |
| `DUSUPAY_SANDBOX_BASE_URL` / `DUSUPAY_PRODUCTION_BASE_URL` | Override the default DusuPay API host per environment |
| `CRON_SECRET` | Bearer token required by every `/api/cron/*` and `/api/internal/*` route |
| `TEST_ADMIN_EMAIL` / `_PASSWORD`, `TEST_EMPLOYER_EMAIL` / `_PASSWORD`, `TEST_EMPLOYEE_EMAIL` / `_PASSWORD` | Playwright test account credentials — a spec skips gracefully rather than failing if these are absent |

> There is no Pusher configuration — it was fully migrated to Supabase Realtime. Do not add `PUSHER_*` env vars back.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm (or pnpm/yarn)
- A Supabase project
- DusuPay merchant account (sandbox or production)
- Upstash Redis instance
- Resend account
- Stanbic API credentials (sandbox or production)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd eaziwageapp

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint across the codebase |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:unit:watch` | Run Vitest in watch mode |
| `npm run test:unit:coverage` | Run Vitest with coverage |
| `npm run test:e2e` | Run the full Playwright end-to-end suite (starts its own dev server on port 3001) |
| `npm run test:webhook` | Run only the DusuPay webhook Playwright spec |

---

## Security & Compliance

- **Row-Level Security (RLS):** The primary access-control boundary — Supabase tables enforce RLS policies so users can only access data they are authorized to view, and application-layer checks are treated as a secondary layer, not the source of truth.
- **Webhook Signature Verification:** DusuPay callbacks are verified using HMAC-SHA256 signatures before any processing.
- **Idempotency:** Every payout and collection uses a `merchant_reference` derived deterministically from the underlying record (never regenerated per retry). DusuPay confirmed this is enforced as a true server-side idempotency key — a duplicate reference is rejected before it's ever processed, ruling out duplicate disbursement even across retries.
- **PII Encryption:** Payment method account numbers/phone numbers and employer bank account numbers are encrypted at rest (`pgcrypto`) and only ever decrypted server-side through dedicated RPCs — API responses that read these tables explicitly select non-sensitive fields rather than returning rows wholesale.
- **Fraud Detection:** Automated rules monitor for amount thresholds, excessive frequency, and velocity attacks.
- **Rate Limiting:** Upstash Redis protects authentication endpoints and sensitive API routes from brute-force attacks.
- **reCAPTCHA v3:** Login and registration flows are protected by invisible bot detection.
- **Input Validation:** All user inputs are validated with Zod schemas before processing or storage.
- **Role Isolation:** Employer, employee, and admin routes are strictly separated — `proxy.ts` enforces role prefixes and resolves the session on every request before a route handler runs.

---

## Deployment

The easiest way to deploy EaziWage is on the **[Vercel Platform](https://vercel.com)**:

1. Push your code to a Git repository
2. Import the project into Vercel
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy

Ensure your DusuPay dashboard's callback URLs point to your production domain:
- Webhook: `https://your-domain.com/api/webhook/dusupay`
- Status verification: `https://your-domain.com/api/dusupay/verify`

Five scheduled GitHub Actions workflows (`.github/workflows/`) call back into the deployed app on a schedule and require `CRON_SECRET` as a Bearer token: stats/health sync every 5 minutes, exchange-rate sync, overdue-repayment sweep, and DusuPay reconciliation daily.

---

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

**Built with care for financial inclusion across East Africa.**
