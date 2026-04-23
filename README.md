# EaziWage — Earned Wage Access Platform

EaziWage is a production-grade **Earned Wage Access (EWA)** platform that enables employees to access a portion of their earned wages before payday. Built on **Next.js 16**, **TypeScript**, and **Supabase**, the system connects employees, employers, and administrators through secure, role-based dashboards with real-time fund disbursement via the **DusuPay** payment gateway.

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
- **Real-Time Disbursement** — Receive funds via M-Pesa, Airtel Money, MTN MoMo, Tigo Pesa, or bank transfer
- **KYC Document Upload** — Submit ID, tax, and employment documents for verification
- **Advance History** — Track pending, approved, completed, and failed transactions

### For Employers
- **Employee Management** — Onboard employees, configure EWA settings, and manage eligibility
- **Advance Review & Approval** — Review requests with risk-adjusted fee calculations
- **Risk Insights Dashboard** — View automated risk scores based on financial health, compliance, and payroll sustainability
- **Wallet & Balance Monitoring** — Track internal credit balances and funding history

### For Administrators
- **KYC Review & Verification** — Approve or reject employee and employer onboarding documents
- **Fund Management** — Move funds between the platform's Stanbic source and employer wallets
- **Fraud Detection** — Monitor automated alerts for amount thresholds, frequency violations, and velocity attacks
- **Reconciliation & Reporting** — Reconcile DusuPay transactions, generate exports, and audit all fund movements
- **System Health & Notifications** — Real-time alerts via Pusher and email for critical events

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | React framework with SSR, API routes, and middleware |
| **Language** | TypeScript 5 | Type-safe development across the entire stack |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Utility-first CSS and accessible UI components |
| **Database** | Supabase (PostgreSQL) | Relational data with Row-Level Security (RLS) |
| **ORM** | Drizzle ORM | Type-safe SQL queries and schema management |
| **Auth** | Supabase Auth + bcryptjs | Session-based auth with role-based access control |
| **Payments** | DusuPay API | Mobile money and bank payout collections/disbursements |
| **Email** | Resend + React Email | Transactional and notification emails |
| **Real-Time** | Pusher | Live notifications and dashboard updates |
| **Rate Limiting** | Upstash Redis | API rate limiting and brute-force protection |
| **Validation** | Zod | Runtime schema validation for all inputs |
| **Analytics** | Vercel Analytics | Production traffic and performance monitoring |

---

## System Architecture

### Three-Tier Virtual Wallet

```
┌─────────────────────────────────────────────┐
│         Admin Wallet (Main Stanbic)         │
│        Platform primary liquidity pool      │
└──────────────────┬──────────────────────────┘
                   │ fund_employer_from_admin()
                   ▼
┌─────────────────────────────────────────────┐
│           Employer Virtual Wallet           │
│    Internal credit/balance per employer     │
└──────────────────┬──────────────────────────┘
                   │ reserveFunds() → disburseAdvance()
                   ▼
┌─────────────────────────────────────────────┐
│          DusuPay Wallet Mirror              │
│    Real-time balance at payment gateway     │
└─────────────────────────────────────────────┘
```

### Core Services

- **`lib/services/payout-service.ts`** — Centralized fund movement, reservation, and disbursement
- **`lib/dusupay/client.ts`** — DusuPay API wrapper for collections, payouts, and verification
- **`lib/fraud-engine.ts`** — Rule-based fraud detection (amount, frequency, velocity)
- **`lib/auth.ts`** — Authentication helpers and session management
- **`lib/email-service.ts`** — Resend-based email dispatch with React Email templates
- **`lib/notifications.ts`** — Pusher real-time push notifications

---

## End-to-End Workflow

### 1. Employee Request
- Employee visits the **Request Advance** page
- System calculates the **platform fee** based on the employer's risk score
- Employee sees **Gross Amount**, **Fee**, and **Net Disbursement**
- Request is saved to the `advances` table with `pending` status
- Payment details are pulled automatically from `employee_onboarding` (mobile money or bank)

### 2. Employer Review & Approval
- Employer views the request in their **Advances Dashboard**
- On **Approve**, the system calls `payoutService.reserveFunds()`
- This creates a `pending` transaction in the employer's wallet, locking the funds
- Approval is blocked if the employer has insufficient balance or outstanding arrears

### 3. Admin Oversight & Disbursement
- Admins track all requests in the **Admin Advances** page
- For `approved` advances, an admin (or automated trigger) initiates `payoutService.disburseAdvance()`
- The service fetches the employee's onboarding details and sends a payout request to **DusuPay**

### 4. DusuPay Verification & Webhook
- DusuPay calls `/api/v1/payouts/verify` to confirm transaction authenticity
- Final status is delivered via signed webhook to `/api/v1/payouts/webhook`
- **Success:** Advance status moves to `completed`; reserved funds are finalized
- **Failure:** Advance status moves to `failed`; reserved funds are released back to the employer

---

## Project Structure

```
eaziwageapp/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Login page
│   ├── layout.tsx                # Root layout with fonts & analytics
│   ├── api/                      # API routes (auth, advances, webhooks, etc.)
│   ├── admin/                    # Admin dashboard pages
│   ├── dashboards/               # Employer & employee dashboards
│   ├── register/                 # Account registration
│   ├── forgot-password/          # Password recovery
│   └── ...
├── components/
│   ├── admin/                    # Admin-specific layouts & components
│   ├── employer/                 # Employer dashboard components
│   ├── employee/                 # Employee dashboard components
│   ├── layout/                   # Shared layout components (chat, notifications)
│   └── ui/                       # shadcn/ui base components
├── lib/
│   ├── services/                 # Business logic (payout, earnings)
│   ├── dusupay/                  # DusuPay integration (client, types, utils, webhooks)
│   ├── emails/                   # React Email templates
│   ├── auth.ts                   # Authentication utilities
│   ├── fraud-engine.ts           # Fraud detection engine
│   ├── email-service.ts          # Email delivery service
│   ├── notifications.ts          # Pusher notification helpers
│   ├── supabaseAdmin.ts          # Service-role Supabase client
│   ├── supabaseServer.ts         # Server-side Supabase client
│   └── validations/              # Zod schemas for all inputs
├── actions/                      # Next.js Server Actions
├── types/                        # Shared TypeScript types
├── constants/                    # Static data and constants
├── hooks/                        # Custom React hooks
├── supabase/                     # SQL migrations and schema definitions
├── emails/                       # Standalone email components
├── public/                       # Static assets
└── env.ts                        # Environment variable validation
```

---

## Environment Variables

Create a `.env.local` file with the following variables. The application validates all required variables on startup via `env.ts`.

### Public (Client-Side)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Google reCAPTCHA v3 site key |
| `NEXT_PUBLIC_PUSHER_APP_KEY` | Pusher application key |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher cluster (e.g., `mt1`) |
| `NEXT_PUBLIC_APP_URL` | Base URL of the deployed application |

### Server-Side Only

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (bypasses RLS) |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v3 secret key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `ADMIN_PASSWORD` | Initial admin account password |
| `PUSHER_APP_ID` | Pusher application ID |
| `PUSHER_APP_SECRET` | Pusher application secret |

> **Note:** DusuPay credentials (`public-key`, `secret-key`) are configured in the DusuPay merchant dashboard and used in API request headers.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm (or pnpm/yarn)
- A Supabase project
- DusuPay merchant account (sandbox or production)
- Upstash Redis instance
- Resend account
- Pusher account

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

---

## Security & Compliance

- **Row-Level Security (RLS):** All Supabase tables enforce RLS policies to ensure users can only access data they are authorized to view.
- **Webhook Signature Verification:** DusuPay callbacks are verified using HMAC-SHA256 signatures to prevent spoofing.
- **Idempotency:** Every payout uses a unique `merchant_reference` to prevent duplicate disbursements.
- **Fraud Detection:** Automated rules monitor for amount thresholds, excessive frequency, and velocity attacks.
- **Rate Limiting:** Upstash Redis protects authentication endpoints and sensitive API routes from brute-force attacks.
- **reCAPTCHA v3:** Login and registration flows are protected by invisible bot detection.
- **Input Validation:** All user inputs are validated with Zod schemas before processing or storage.
- **Role Isolation:** Employer, employee, and admin dashboards are strictly separated with middleware-enforced access control.

---

## Deployment

The easiest way to deploy EaziWage is on the **[Vercel Platform](https://vercel.com)**:

1. Push your code to a Git repository
2. Import the project into Vercel
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy

Ensure your DusuPay callback URLs point to your production domain:
- Verification: `https://your-domain.com/api/v1/payouts/verify`
- Webhook: `https://your-domain.com/api/v1/payouts/webhook`

---

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

**Built with care for financial inclusion across East Africa.**

