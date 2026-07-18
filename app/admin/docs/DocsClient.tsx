'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, Shield, Building2, Users, 
  AlertTriangle, Settings, Wifi, ChevronRight, Search,
  DollarSign, Eye, 
   Clock, TrendingUp, Bell, X, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArticleSection {
  heading: string;
  body: string;
  steps?: string[];
  warnings?: string[];
  tips?: string[];
}

interface ArticleContent {
  overview: string;
  sections: ArticleSection[];
}

const docSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    description: 'New to admin? Start here',
    articles: [
      {
        title: 'Admin Dashboard Overview',
        description: 'Complete guide to the admin dashboard interface and navigation',
        path: '#dashboard-overview',
        difficulty: 'beginner',
        content: {
          overview: 'The EaziWage Admin Dashboard is your central command center for overseeing the entire platform. It surfaces real-time data across employers, employees, advances, and system health — all in one place.',
          sections: [
            {
              heading: 'Dashboard Layout',
              body: 'The dashboard is divided into four primary zones: the top navigation bar (global search, notifications, profile), the left sidebar (module navigation), the main content area (dynamic per page), and the right panel (contextual details and quick actions).',
            },
            {
              heading: 'Key Metrics Panel',
              body: 'At a glance, you will see: total active employers, total employees enrolled, advances disbursed this month, platform revenue, and any pending actions requiring your attention.',
              tips: [
                'Red badge counts on sidebar icons indicate urgent pending actions.',
                'Click any metric card to drill into the full report for that category.',
                'Metrics refresh every 60 seconds automatically — no need to reload.',
              ],
            },
            {
              heading: 'Navigation Structure',
              body: 'Sidebar modules are ordered by operational priority: Employers → Employees → Advances → Financial Reports → Risk & Fraud → System Settings. This mirrors the typical admin workflow from onboarding to reconciliation.',
            },
            {
              heading: 'Dark Mode & Preferences',
              body: 'Toggle dark mode from the top-right profile menu. Preferences persist per admin account — each admin maintains their own view settings independently.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Understanding Your Role',
        description: 'Admin permissions and core responsibilities',
        path: '#admin-roles',
        difficulty: 'beginner',
        content: {
          overview: 'As an EaziWage admin, you have full access to all platform functions and data. Your role is to ensure smooth operations across employer onboarding, employee oversight, advance approvals, KYC verification, and financial reconciliation.',
          sections: [
            {
              heading: 'Admin Responsibilities',
              body: 'All admins have the same access level and share responsibility for:',
              steps: [
                'Employer Onboarding — Review and approve employer applications, verify KYC documents, and assess risk profiles.',
                'Employee KYC & Verification — Ensure employee documents are complete and valid before advance eligibility.',
                'Advance Approvals — Review flagged advance requests, approve or reject, and ensure timely processing (target: same business day for manual reviews).',
                'Disbursement Management — Monitor payment status, resolve failed transactions, and handle customer inquiries.',
                'KYC Reviews — Conduct ongoing compliance reviews and verify employer/employee documentation remains current.',
                'Financial Reconciliation — Match transactions, investigate discrepancies, and ensure accurate accounting.',
              ],
            },
            {
              heading: 'Core Principles',
              body: 'All admin actions are governed by these principles:',
              steps: [
                'Every action is logged with your admin account and timestamp — shared logins compromise the audit trail and are strictly prohibited.',
                'Always document your reasoning in the notes field when taking significant actions (approvals, rejections, overrides, suspensions).',
                'Follow the principle of least privilege — only access data or perform actions necessary for your assigned tasks.',
                'When in doubt, escalate — contact your manager or a colleague rather than guessing on a high-stakes decision.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Platform Architecture',
        description: 'How EaziWage works under the hood',
        path: '#architecture',
        difficulty: 'intermediate',
        content: {
          overview: 'EaziWage is built on a modern web stack: Next.js on the frontend, Supabase as the backend (database, auth, storage, and realtime), Resend for transactional emails, and Zod for runtime data validation. Understanding this architecture helps you diagnose issues and understand data flows.',
          sections: [
            {
              heading: 'Core Data Flow',
              body: 'A typical advance request flows as follows: Employee submits request via mobile/web app → Next.js API Route validates with Zod → Supabase stores the request and updates earned-wage balance → Admin is notified → Admin reviews and approves → Disbursement is triggered → Employee receives payout → Repayment deducted on payroll date.',
            },
            {
              heading: 'Supabase Layer',
              body: 'Supabase powers: PostgreSQL (all relational data — employers, employees, advances, transactions), Row-Level Security (RLS) policies enforce data isolation between employers, Supabase Auth handles user authentication with JWT tokens, and Supabase Storage holds KYC documents with access controls.',
              tips: [
                'Each employer\'s data is isolated via RLS — an employer admin cannot see another employer\'s employee data.',
                'Admin accounts bypass employer-level RLS but are subject to admin-tier policies.',
              ],
            },
            {
              heading: 'API Routes',
              body: 'Next.js API routes handle all server-side business logic: advance eligibility calculations, risk scoring, disbursement triggers, and webhook receivers from payment partners. These routes use the Supabase service role key (not the anon key) and should never be exposed client-side.',
              warnings: [
                'The service role key has full database access — any exposure is a critical security incident. Report immediately to your manager and security team.',
              ],
            },
            {
              heading: 'Realtime & Notifications',
              body: 'Supabase Realtime subscriptions power live dashboard updates (e.g. new advance requests appearing without refresh). Resend + React Email handles all outbound transactional emails — employer approvals, employee notifications, and admin alerts.',
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'employer-management',
    title: 'Employer Management',
    icon: Building2,
    description: 'Manage partner companies',
    articles: [
      {
        title: 'Employer Onboarding Process',
        description: 'Review and approve new employer applications',
        path: '#employer-onboarding',
        difficulty: 'beginner',
        content: {
          overview: 'When a new company applies to join EaziWage as an employer partner, an admin must review and approve their application before any employees can access earned wage advances. This process typically takes 24–72 hours.',
          sections: [
            {
              heading: 'Onboarding Steps',
              body: 'The employer onboarding workflow follows this sequence:',
              steps: [
                'Application received — Employer submits company details, contact info, and uploads required documents.',
                'Initial review — Admin checks completeness of submission. Incomplete applications are flagged and employer is notified.',
                'KYC verification — Company registration documents, director IDs, and bank account details are verified (see KYC Verification Guide).',
                'Risk assessment — Platform calculates initial risk score based on company size, industry, and financial profile.',
                'Approval decision — Admin approves, conditionally approves, or rejects the application.',
                'Account activation — Upon approval, employer receives onboarding email with setup instructions. A dedicated employer portal account is created.',
                'Integration setup — Employer connects their payroll system or manually uploads employee rosters.',
              ],
            },
            {
              heading: 'Required Documents',
              body: 'Every employer application must include: Certificate of Incorporation, valid business permit/licence, director national IDs or passports, company bank account confirmation letter, and payroll sample (last 3 months, anonymised is acceptable).',
              warnings: [
                'Do not approve any employer with missing KYC documents — even partially. Conditional approvals must be documented with a clear checklist of outstanding items.',
              ],
            },
            {
              heading: 'Communicating with Applicants',
              body: 'All communication with employers during onboarding must go through the platform\'s internal messaging system — not personal email — so it is captured in the audit trail. Use the templated responses available in the Communication module for consistency.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'KYC Verification Guide',
        description: 'Verify employer documents and compliance',
        path: '#kyc-verification',
        difficulty: 'intermediate',
        content: {
          overview: 'Know Your Customer (KYC) verification is a mandatory regulatory and risk-management step before onboarding any employer. As an admin, you are responsible for verifying the authenticity and validity of all submitted documents.',
          sections: [
            {
              heading: 'Document Verification Checklist',
              body: 'For each employer, verify the following:',
              steps: [
                'Certificate of Incorporation — Cross-reference with the company registry. Check company name, registration number, and incorporation date.',
                'Business Permit/Licence — Confirm it is current (not expired), matches the operational jurisdiction, and covers the employer\'s primary business activity.',
                'Director IDs — Verify government-issued ID for each listed director. Check photo, name match, and expiry date. Flag any mismatch between ID name and company registration.',
                'Bank Account Letter — Must be on official bank letterhead, show the full account number and sort code, and be dated within 90 days.',
                'Payroll Sample — Confirm the employer has an established payroll history. Look for consistency in employee count and pay cycles.',
              ],
            },
            {
              heading: 'Red Flags to Watch For',
              body: 'Immediately escalate to your manager or a senior colleague if you encounter:',
              warnings: [
                'Documents that appear digitally altered (inconsistent fonts, pixelated seals, misaligned text).',
                'Director names that appear on known fraud or sanctions watchlists (use the built-in sanctions check tool).',
                'Newly incorporated company (under 6 months) with no trading history applying for high advance limits.',
                'Bank account in a different country from the company registration without clear business justification.',
                'Same director appearing across multiple employer applications simultaneously.',
              ],
            },
            {
              heading: 'Sanctions Screening',
              body: 'Before approving any employer, run the company name and all listed directors through the built-in sanctions screening tool (Settings → Compliance → Sanctions Check). This checks against OFAC, UN, and local financial intelligence unit lists. Document the screening result in the employer\'s KYC record regardless of outcome.',
            },
            {
              heading: 'KYC Renewal',
              body: 'KYC is not a one-time event. Existing employers must re-submit updated documents every 24 months, or immediately upon: director change, company restructuring, change of banking details, or legal name change. The platform automatically flags employers approaching renewal deadlines.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Risk Assessment Framework',
        description: 'Understanding employer risk scoring and factors',
        path: '#risk-assessment',
        difficulty: 'advanced',
        content: {
          overview: 'The EaziWage risk engine assigns every employer a risk score from 0 (lowest risk) to 100 (highest risk). This score directly influences advance limits, fee rates, and the frequency of compliance reviews for that employer. Understanding how scores are calculated helps you make better approval decisions.',
          sections: [
            {
              heading: 'Scoring Dimensions',
              body: 'The risk score is a weighted composite of five dimensions:',
              steps: [
                'Financial Stability (30%) — Assessed via payroll consistency, company age, and industry classification. Seasonal businesses and startups score higher risk.',
                'KYC Completeness (25%) — Penalises missing, expired, or flagged documents. A 100% clean KYC file contributes maximum score reduction.',
                'Advance Repayment History (25%) — For existing employers: on-time repayment rate, default incidents, and restructured advances. New employers start at a neutral baseline.',
                'Employee Default Rate (10%) — The proportion of this employer\'s employees with advance repayment defaults. High employee default rates indicate payroll reliability issues.',
                'Compliance Incidents (10%) — Any regulatory issues, fraud flags, or audit findings. A single substantiated fraud incident triggers a mandatory manual review regardless of overall score.',
              ],
            },
            {
              heading: 'Score Bands and Implications',
              body: 'Scores translate to operational tiers:',
              steps: [
                '0–25 (Green/Low Risk) — Standard advance limits apply. Annual KYC review cycle. Priority processing.',
                '26–50 (Amber/Medium Risk) — Advance limits capped at 70% of standard. 18-month KYC review cycle. Enhanced monitoring.',
                '51–75 (Orange/High Risk) — Advance limits capped at 40% of standard. 12-month KYC review cycle. Quarterly compliance check-ins required.',
                '76–100 (Red/Critical Risk) — Advances suspended pending manual review. Immediate escalation to management required. 6-month KYC review cycle.',
              ],
            },
            {
              heading: 'Manual Score Overrides',
              body: 'Admins can apply a temporary manual override to a risk score with documented justification. Overrides are valid for a maximum of 90 days before automatic expiry. All overrides are logged in the audit trail. Overrides should be used sparingly — they are exceptions, not workarounds.',
              warnings: [
                'Apply overrides only with clear documentation. Any override that significantly changes an employer\'s advance limit should be reviewed by a colleague or manager.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Employer Status Management',
        description: 'Approve, suspend, or reject employer accounts',
        path: '#status-management',
        difficulty: 'beginner',
        content: {
          overview: 'Employer accounts can exist in five states: Pending, Active, Suspended, Rejected, and Terminated. Moving an employer between states has immediate downstream effects on their employees\' ability to access advances.',
          sections: [
            {
              heading: 'Status Definitions',
              body: 'Understanding each status:',
              steps: [
                'Pending — Newly applied employer. KYC review in progress. No employee access.',
                'Active — Fully approved employer. Employees can request and receive advances normally.',
                'Suspended — Temporarily restricted. Employees cannot request new advances, but existing advance schedules continue. Used for compliance reviews or payment disputes.',
                'Rejected — Application denied. Employer notified with reason. Can reapply after 6 months.',
                'Terminated — Permanently removed from platform. All outstanding advances must be settled before termination is finalised.',
              ],
            },
            {
              heading: 'Suspension Procedure',
              body: 'To suspend an employer:',
              steps: [
                'Navigate to Employer Management → select employer → Status tab.',
                'Click "Suspend Account" and select a reason from the dropdown (Compliance Review, Payment Dispute, KYC Expired, Fraud Investigation).',
                'Set an expected review date (maximum 30 days — extensions require management approval).',
                'System automatically notifies the employer via email and disables new advance requests.',
                'Document the full rationale in the Notes field — this feeds into the audit trail.',
              ],
              warnings: [
                'Suspension immediately blocks all employees of that employer from new advances. Ensure this is proportionate to the issue before proceeding.',
                'Never suspend without documented reason — unsupported suspensions are audit findings.',
              ],
            },
            {
              heading: 'Rejection and Termination',
              body: 'Rejection is for new applicants who fail KYC or risk assessment. Termination is for existing active employers. Both actions are serious — consult with your manager before proceeding. Always send the employer a formal reason — vague rejections invite disputes. Use the templated rejection notices in the Communication module.',
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'employee-oversight',
    title: 'Employee Oversight',
    icon: Users,
    description: 'Monitor workforce across all employers',
    articles: [
      {
        title: 'Employee Profile Management',
        description: 'View and manage employee information across organisations',
        path: '#employee-profiles',
        difficulty: 'beginner',
        content: {
          overview: 'Each employee enrolled in EaziWage has a profile that aggregates their personal details, employment data, KYC status, advance history, and repayment record. As an admin, you have cross-employer visibility — meaning you can view any employee\'s profile regardless of which employer they belong to.',
          sections: [
            {
              heading: 'Profile Sections',
              body: 'An employee profile contains:',
              steps: [
                'Personal Details — Full name, national ID, date of birth, contact information.',
                'Employment Info — Employer name, department, job title, employment start date, salary, and pay cycle.',
                'KYC Status — Verification documents submitted, review status, and expiry dates.',
                'Advance Eligibility — Current earned wage balance, maximum advance amount, active advance count, and eligibility status.',
                'Advance History — All past and current advances with amounts, disbursement dates, repayment status, and any defaults.',
                'Repayment Record — Aggregate on-time repayment rate, total advanced to date, outstanding balance.',
              ],
            },
            {
              heading: 'Editing Profile Data',
              body: 'Admins can correct factual errors in employee profiles (e.g. name spelling, ID number typo). Any edit creates an automatic audit log entry. You cannot modify advance history or repayment records — those are system-generated from transaction data and require a formal reconciliation request.',
              warnings: [
                'Do not edit salary or employment data directly — these must be updated by the employer through their portal. Admin edits to salary data bypass employer controls and distort advance eligibility calculations.',
              ],
            },
            {
              heading: 'Cross-Employer Search',
              body: 'Use the global employee search (top navigation bar) to find employees by name, national ID, or phone number across all employers. This is particularly useful when investigating an employee who may be enrolled under multiple employers simultaneously — which is allowed but requires monitoring.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Employee KYC Review',
        description: 'Review employee verification documents',
        path: '#employee-kyc',
        difficulty: 'intermediate',
        content: {
          overview: 'Employee KYC is lighter than employer KYC but equally important. It verifies the employee is who they say they are, and that the banking details on file will successfully receive advance disbursements.',
          sections: [
            {
              heading: 'Required Employee Documents',
              body: 'Standard employee KYC requires:',
              steps: [
                'National ID or passport — Verify name, photo, and ID number match the employee profile.',
                'Selfie/liveness check — Automated biometric match against the ID photo. Review flagged cases manually.',
                'Bank account details — Account name must match the employee\'s full name. Confirm the bank and account number are valid.',
                'Employment confirmation — Some employers require admin to verify the employee appears on the submitted payroll list.',
              ],
            },
            {
              heading: 'Handling Failed Liveness Checks',
              body: 'If the automated liveness check fails, the employee is prompted to retry up to 3 times. After 3 failures, the case is escalated to manual admin review. In manual review, compare the selfie against the ID photo carefully. If you are not confident of a match, reject and request the employee visit their employer\'s HR office for in-person verification.',
              tips: [
                'Common liveness failure causes: poor lighting, sunglasses or face coverings, someone else holding the ID instead of the employee.',
                'Deliberate fraud (someone else\'s ID used) should be reported to the fraud team immediately — do not just reject quietly.',
              ],
            },
            {
              heading: 'Bank Account Verification',
              body: 'Before approving banking details, run a micro-transaction verification if the payment partner supports it, or confirm via the bank account lookup tool. An advance sent to the wrong account due to admin oversight is the platform\'s liability. Double-check account names — nicknames and shortened names are common mismatch causes.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Employee Status Controls',
        description: 'Activate, suspend, or terminate employee accounts',
        path: '#employee-status',
        difficulty: 'intermediate',
        content: {
          overview: 'Employee account statuses control whether an employee can request advances. Status changes should always be proportionate, documented, and communicated to the relevant employer.',
          sections: [
            {
              heading: 'Status Types',
              body: 'Employee accounts have four possible statuses:',
              steps: [
                'Pending — KYC under review. Cannot request advances.',
                'Active — Fully verified. Can request advances up to their eligibility limit.',
                'Suspended — Temporarily blocked from new advances. Existing repayment schedules continue.',
                'Inactive — Employee has left the employer. Advances blocked. Outstanding balance repayment managed by employer.',
              ],
            },
            {
              heading: 'When to Suspend an Employee',
              body: 'Suspend an employee account when: a fraud flag is raised on their profile, their KYC documents expire and renewal is overdue, you receive a report of compromised account credentials, or the employer reports the employee has been suspended from work pending investigation.',
              warnings: [
                'Employee suspension does not cancel existing advance repayments — those continue per the original schedule.',
                'Always notify the employer when you suspend one of their employees. They need to know for payroll planning.',
              ],
            },
            {
              heading: 'Offboarding Employees',
              body: 'When an employer reports an employee has left the company, the admin must: verify the offboarding through the employer portal, check for any outstanding advance balances, coordinate with the employer on repayment of outstanding advances (typically deducted from the final paycheck), and then move the account to Inactive. Do not delete employee accounts — they must be retained for regulatory reporting.',
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'financial-operations',
    title: 'Financial Operations',
    icon: DollarSign,
    description: 'Manage money flow and compliance',
    articles: [
      {
        title: 'Advance Processing Workflow',
        description: 'From request to disbursement - complete advance lifecycle',
        path: '#advance-workflow',
        difficulty: 'intermediate',
        content: {
          overview: 'An advance request passes through several stages from the moment an employee submits it to the moment funds land in their account. As an admin, you may need to intervene at various stages — particularly for large advances, flagged accounts, or failed disbursements.',
          sections: [
            {
              heading: 'Lifecycle Stages',
              body: 'The complete advance lifecycle:',
              steps: [
                'Request Submitted — Employee requests an amount within their eligibility limit via the mobile or web app.',
                'Automated Eligibility Check — System verifies: employee is Active, KYC is valid, requested amount ≤ earned wage balance, no overdue repayments, employer account is Active.',
                'Auto-Approve or Flag — Low-risk requests below a threshold are auto-approved. Higher-value requests or flagged accounts are routed to admin review queue.',
                'Admin Review (if flagged) — Admin reviews the request details, employee profile, and employer status. Approves or rejects with documented reason.',
                'Disbursement Triggered — Approved advance triggers a payment instruction to the payment partner (M-Pesa, bank transfer, etc.).',
                'Funds Delivered — Employee receives notification of successful disbursement.',
                'Repayment Scheduled — System records the repayment deduction amount and date against the next payroll cycle.',
                'Repayment Received — On payroll date, employer deducts and remits repayment. System matches and closes the advance.',
              ],
            },
            {
              heading: 'Auto-Approval Thresholds',
              body: 'Requests below KES 10,000 from Active employees with no fraud flags and a repayment history above 95% are auto-approved without admin review. Thresholds may be adjusted by management in Global Settings. Do not manually approve requests that should have been auto-approved without checking why they were flagged — the flag is there for a reason.',
            },
            {
              heading: 'Failed Disbursements',
              body: 'If a disbursement fails (wrong account number, network error, account limit exceeded), the system retries twice automatically. After two failures, the advance is moved to a Failed state and routed to admin for manual resolution. Contact the employee via the platform messaging system to confirm their banking details before retrying.',
              warnings: [
                'Never retry a failed disbursement to a different account without the employee submitting an official account change request — this is a fraud vector.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Disbursement Management',
        description: 'Approve and process advance payouts',
        path: '#disbursements',
        difficulty: 'beginner',
        content: {
          overview: 'Disbursement management is the admin function of reviewing and approving advance payouts that require manual authorisation. Speed matters here — employees expecting same-day funds require prompt action.',
          sections: [
            {
              heading: 'Accessing the Disbursement Queue',
              body: 'Navigate to Financial Operations → Disbursements. The queue shows all advances awaiting manual approval, sorted by request time (oldest first). Use the filter panel to sort by employer, amount range, or risk flag type.',
              tips: [
                'Set up a custom notification alert so you are pinged immediately when a disbursement enters the manual queue — do not rely on checking periodically.',
                'Target SLA for manual disbursement review: 2 hours during business hours.',
              ],
            },
            {
              heading: 'Reviewing a Disbursement Request',
              body: 'For each request in the queue, review:',
              steps: [
                'Employee profile status — Active and KYC valid?',
                'Advance amount vs. earned wage balance — Is the amount within the eligible limit?',
                'Repayment history — Any defaults or overdue advances?',
                'Fraud flags — Any active risk flags on the employee or employer?',
                'Reason for manual routing — Why was this not auto-approved? Understand the flag before proceeding.',
              ],
            },
            {
              heading: 'Approving or Rejecting',
              body: 'Click Approve to trigger disbursement or Reject to decline. Both actions require a mandatory reason code selection. Rejection reasons are shared with the employee and employer — use professional, clear language in the notes field. Avoid technical jargon in rejection notes visible to employees.',
              warnings: [
                'Approving a flagged request without reviewing the flag reason is a compliance violation and will appear in your audit trail.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Fee Structure Overview',
        description: 'Understanding platform fees and revenue sharing',
        path: '#fee-structure',
        difficulty: 'intermediate',
        content: {
          overview: 'EaziWage earns revenue through fees charged on each advance transaction. Understanding the fee structure is essential for answering employer queries, running revenue reports, and ensuring the platform\'s financial sustainability.',
          sections: [
            {
              heading: 'Fee Types',
              body: 'EaziWage charges three types of fees:',
              steps: [
                'Employee Access Fee — A flat or percentage fee charged to the employee per advance request. This is the primary consumer-facing charge.',
                'Employer Platform Fee — A monthly subscription or per-employee fee charged to employers for platform access and payroll integration.',
                'Processing Fee — A small variable fee covering payment partner charges (M-Pesa, bank transfer costs) passed through at cost.',
              ],
            },
            {
              heading: 'Revenue Sharing (if applicable)',
              body: 'Some employer contracts include a revenue-sharing arrangement where the employer receives a portion of the employee access fees generated by their workforce. This incentivises employer participation in promoting the platform. Revenue share percentages are configured per employer in their contract settings and visible on the Employer Profile → Billing tab.',
            },
            {
              heading: 'Fee Waivers and Adjustments',
              body: 'Admins can apply a one-time fee waiver for specific advances in documented exceptional circumstances (e.g. system error caused a double charge). Any fee waiver must be logged with clear justification and reviewed for audit compliance. Recurring fee adjustments or large contractual fee changes should be coordinated with management.',
              warnings: [
                'Applying fee waivers without documentation is a financial audit finding. Always log the reason with detail.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Financial Reconciliation',
        description: 'Match transactions and resolve discrepancies',
        path: '#reconciliation',
        difficulty: 'advanced',
        content: {
          overview: 'Reconciliation is the process of matching EaziWage\'s internal transaction records against payment partner settlement reports and employer repayment remittances. Discrepancies — amounts that don\'t match — must be investigated and resolved within the reconciliation period.',
          sections: [
            {
              heading: 'Daily Reconciliation Process',
              body: 'Reconciliation runs daily (automated at midnight) and produces a reconciliation report by 6AM the following morning. The report highlights:',
              steps: [
                'Matched transactions — Advances that disbursed and were confirmed by the payment partner. No action needed.',
                'Unmatched disbursements — Advance shows as sent in EaziWage but no payment partner confirmation. Investigate immediately.',
                'Unmatched repayments — Payment partner received a repayment but no matching advance found. Could be an overpayment or misrouted payment.',
                'Employer remittance gaps — Expected repayment from employer payroll not received. Contact employer.',
              ],
            },
            {
              heading: 'Investigating Discrepancies',
              body: 'For unmatched transactions, start by pulling the transaction reference from the payment partner portal and cross-referencing with the EaziWage transaction log. Common causes include: timing differences (end-of-day cut-offs), payment partner API delays, incorrect reference codes used by employers on remittances, and genuine failed or duplicate payments.',
              tips: [
                'Always resolve unmatched items within 3 business days. Aged unreconciled items compound quickly and become harder to trace.',
                'Keep a running log of recurring discrepancy patterns — they often indicate a systemic integration issue worth fixing at the source.',
              ],
            },
            {
              heading: 'Escalation',
              body: 'Any unreconciled item above KES 50,000 must be escalated to management with a full investigation report within 24 hours. Do not attempt to manually close large discrepancies without senior review.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Billing & Revenue Analytics',
        description: 'Track platform revenue and financial performance',
        path: '#billing-analytics',
        difficulty: 'intermediate',
        content: {
          overview: 'The Billing & Revenue Analytics module gives you a live view of the platform\'s financial health: how much has been advanced, what fees have been collected, which employers are generating the most volume, and how revenue trends over time.',
          sections: [
            {
              heading: 'Key Metrics to Track',
              body: 'Monitor these metrics weekly:',
              steps: [
                'Total Volume Advanced (TVA) — Sum of all advances disbursed in the period. The primary business volume metric.',
                'Platform Revenue — Total fees collected. Break down by fee type to understand revenue mix.',
                'Average Advance Size — TVA divided by number of advances. Trends up or down indicate changes in employee behaviour.',
                'Repayment Rate — Percentage of due repayments received on time. Target >97%. Below 95% is a warning signal.',
                'Employer Revenue Contribution — Which employers are driving the most fee revenue? Useful for prioritising relationship management.',
              ],
            },
            {
              heading: 'Generating Reports',
              body: 'Navigate to Financial Operations → Revenue Analytics. Select date range, employer filter (or all employers), and report type. Export to CSV for further analysis in spreadsheet tools. Monthly and quarterly reports are automatically generated and available for download.',
              tips: [
                'Use the cohort analysis view to understand revenue per employer over time — it reveals employer health trends earlier than aggregate numbers.',
              ],
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'risk-fraud',
    title: 'Risk & Fraud Management',
    icon: Shield,
    description: 'Protect the platform and users',
    articles: [
      {
        title: 'Risk Scoring System',
        description: 'How employer and employee risk scores are calculated',
        path: '#risk-scoring',
        difficulty: 'advanced',
        content: {
          overview: 'The EaziWage risk engine assigns composite risk scores to both employers and employees. These scores are recalculated continuously as new data arrives and directly govern platform behaviour — advance limits, approval routing, and monitoring intensity.',
          sections: [
            {
              heading: 'Employee Risk Score Factors',
              body: 'Employee risk scores are weighted across:',
              steps: [
                'Repayment History (40%) — On-time repayment rate across all advances. Default incidents heavily penalise this dimension.',
                'Advance Frequency (20%) — Employees requesting advances every pay cycle score higher risk than occasional users.',
                'KYC Completeness (20%) — Full and current KYC reduces risk score; expired or incomplete documents increase it.',
                'Employment Stability (20%) — Length of tenure with current employer and consistency of salary. Short-tenured employees are higher risk.',
              ],
            },
            {
              heading: 'Score Recalculation Triggers',
              body: 'Scores are recalculated: automatically every 24 hours (batch), immediately upon any new advance request, immediately upon a repayment event, and upon any manual admin flag being applied. Real-time recalculation ensures the most current risk profile governs each advance decision.',
            },
            {
              heading: 'Interpreting Score Changes',
              body: 'A sudden spike in an employee\'s risk score (increase of 20+ points in 7 days) without a clear repayment event is a fraud signal. Common causes: rapid increase in advance frequency, KYC document flagged post-approval, or a reported account compromise. Investigate before the next advance request reaches the queue.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Fraud Detection Alerts',
        description: 'Monitor and respond to suspicious activities',
        path: '#fraud-detection',
        difficulty: 'intermediate',
        content: {
          overview: 'The fraud detection system monitors transactions and account behaviour in real time, generating alerts when patterns deviate from established norms. Rapid admin response to fraud alerts is critical — delays allow fraudulent advances to be disbursed and withdrawn before they can be stopped.',
          sections: [
            {
              heading: 'Alert Types',
              body: 'The system generates four categories of fraud alerts:',
              steps: [
                'Account Takeover Alert — Login from a new device or location combined with an immediate advance request. High priority.',
                'Velocity Alert — Multiple advance requests from the same employee or employer in a short window exceeding normal patterns.',
                'Identity Mismatch Alert — KYC biometric match falls below confidence threshold after previously passing.',
                'Unusual Amount Alert — Advance requested at exactly the maximum eligibility limit, especially from accounts with no prior advance history.',
              ],
            },
            {
              heading: 'Responding to an Alert',
              body: 'When an alert fires:',
              steps: [
                'Open the alert from the Risk & Fraud → Alerts queue.',
                'Review the triggering event and the employee/employer profile.',
                'Check if an advance is pending disbursement — if so, place an immediate hold to prevent disbursement while you investigate.',
                'Contact the employee and/or employer to verify the activity.',
                'Resolve the alert as: Confirmed Fraud, False Positive, or Needs Monitoring.',
                'Document your investigation findings and resolution in the alert record.',
              ],
              warnings: [
                'Never dismiss a fraud alert as a false positive without investigation. Unreviewed dismissals create liability.',
                'If you suspect confirmed fraud, do not alert the suspect employer or employee — escalate to your manager and the fraud team immediately.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Compliance Monitoring',
        description: 'Regulatory compliance and reporting requirements',
        path: '#compliance',
        difficulty: 'advanced',
        content: {
          overview: 'EaziWage operates in a regulated financial services environment. Compliance monitoring ensures the platform meets its obligations under applicable financial regulations, data protection laws, and anti-money laundering (AML) requirements.',
          sections: [
            {
              heading: 'AML Obligations',
              body: 'As a financial platform handling wage advances, EaziWage is subject to AML regulations. Key admin responsibilities include:',
              steps: [
                'Sanctions screening — All employers and their directors must be screened against sanctions lists at onboarding and on an ongoing basis.',
                'Suspicious Activity Reports (SARs) — If any transaction or account behaviour suggests money laundering, you are legally obligated to file a SAR with the relevant financial intelligence unit. Do not tip off the subject.',
                'Cash threshold reporting — Any advance request or repayment above the regulatory cash threshold must be flagged for additional review.',
                'Record retention — All KYC documents, transaction records, and audit logs must be retained for the minimum statutory period (typically 7 years).',
              ],
            },
            {
              heading: 'Data Protection Compliance',
              body: 'Employee and employer data is personal/sensitive data subject to data protection regulations. Admins must: access only the data necessary for the task at hand (data minimisation), not share personal data outside the platform\'s approved systems, report any suspected data breach to the Data Protection Officer within 24 hours, and never export bulk personal data without documented authorisation.',
            },
            {
              heading: 'Regulatory Reporting',
              body: 'The platform automatically generates required regulatory reports on a scheduled basis. Admins are collectively responsible for ensuring submission deadlines are met and underlying data accuracy. Maintain correct KYC statuses, accurate transaction records, and up-to-date employer/employee information — errors directly affect regulatory report accuracy.',
              warnings: [
                'Filing an inaccurate regulatory report — even unintentionally — carries significant consequences. Flag any data quality concerns you spot to your manager before report submission deadlines.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Audit Trail Management',
        description: 'Track all admin actions and system changes',
        path: '#audit-trail',
        difficulty: 'intermediate',
        content: {
          overview: 'Every admin action on the EaziWage platform is automatically recorded in the immutable audit trail. This log is the authoritative record of who did what, when, and — where provided — why. It is your protection in disputes and a critical compliance asset.',
          sections: [
            {
              heading: 'What Gets Logged',
              body: 'The audit trail records:',
              steps: [
                'All employer and employee status changes — with admin ID, timestamp, and reason code.',
                'All advance approvals, rejections, and manual overrides.',
                'All KYC verification decisions.',
                'All system settings changes made by admins.',
                'All admin account logins and logouts, including failed login attempts.',
                'All data exports and report generations.',
                'All fraud alert resolutions.',
              ],
            },
            {
              heading: 'Accessing the Audit Trail',
              body: 'Navigate to Risk & Fraud → Audit Trail. Filter by date range, admin account, action type, or affected entity (employer/employee/advance). Export to CSV for external audit purposes. The trail itself cannot be edited or deleted — it is append-only by design.',
              tips: [
                'When an auditor or regulator requests records, use the Audit Trail export — it provides a clean, timestamped log suitable for formal review.',
                'If you need to understand why a particular decision was made weeks ago, the audit trail is your first stop.',
              ],
            },
            {
              heading: 'Best Practices for Audit Quality',
              body: 'The audit trail is only as useful as the quality of notes entered by admins. Always fill in the reason/notes field when taking any significant action — not just the mandatory reason code. A future auditor (or your colleague covering for you) needs to understand your reasoning from the log alone. "Looks fine" is not a useful audit note. "KYC documents verified, bank account confirmed via lookup tool, approved" is.',
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'system-administration',
    title: 'System Administration',
    icon: Settings,
    description: 'Platform configuration and maintenance',
    articles: [
      {
        title: 'Global Settings Configuration',
        description: 'Configure platform-wide rules and limits',
        path: '#global-settings',
        difficulty: 'advanced',
        content: {
          overview: 'Global Settings are platform-wide configuration parameters that govern how EaziWage behaves for all employers and employees. Changes here are high-impact — they affect every transaction on the platform. Global Settings changes should be coordinated with management and thoroughly tested before implementation.',
          sections: [
            {
              heading: 'Key Configurable Parameters',
              body: 'Global Settings includes:',
              steps: [
                'Maximum Advance Percentage — The maximum percentage of an employee\'s earned wages available for advance (e.g. 50% means an employee with KES 40,000 earned can access up to KES 20,000).',
                'Auto-Approval Threshold — The maximum advance amount eligible for automatic approval without admin review.',
                'Minimum Employment Tenure — The minimum months of employment before an employee is eligible for their first advance.',
                'Default Fee Rate — The default access fee percentage applied to advances where a custom employer rate is not configured.',
                'KYC Expiry Periods — How long KYC approvals remain valid before renewal is required (employer and employee, separately configurable).',
                'Risk Score Thresholds — The score bands that define Green/Amber/Orange/Red risk tiers (see Risk Assessment Framework).',
              ],
            },
            {
              heading: 'Making Changes Safely',
              body: 'Before changing any Global Setting:',
              steps: [
                'Model the impact — estimate how many employers/employees are affected and by how much.',
                'Document the change rationale in the Settings change log.',
                'Schedule changes during low-activity periods (late evening or weekend) to minimise disruption.',
                'Monitor the advance queue and error logs for 1 hour after any change to catch unintended consequences.',
                'Have a rollback plan — know what you will change it back to if something breaks.',
              ],
              warnings: [
                'There is no staging environment for Global Settings — changes take effect immediately on production. Proceed with extreme caution.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'API Health Monitoring',
        description: 'Monitor system performance and uptime',
        path: '#api-health',
        difficulty: 'intermediate',
        content: {
          overview: 'The API Health dashboard gives real-time visibility into the performance and availability of EaziWage\'s critical system components: the Next.js application, Supabase database, payment partner APIs, and email delivery service.',
          sections: [
            {
              heading: 'Health Indicators',
              body: 'Monitor these indicators continuously:',
              steps: [
                'API Response Time — Average response time for key endpoints. Alert threshold: >2 seconds. Critical threshold: >5 seconds.',
                'Error Rate — Percentage of API requests returning 4xx/5xx errors. Alert threshold: >1%. Critical threshold: >5%.',
                'Database Connections — Active Supabase connection pool utilisation. Alert threshold: >80% of pool capacity.',
                'Payment Partner Status — Live status of M-Pesa and bank transfer integrations. Any disruption directly blocks disbursements.',
                'Email Delivery Rate — Percentage of emails successfully delivered via Resend. Alert threshold: <95% delivery rate.',
              ],
            },
            {
              heading: 'Responding to Health Alerts',
              body: 'When a health alert fires: acknowledge it immediately in the monitoring dashboard (this stops escalation notifications), investigate the root cause using the associated error logs, determine if the issue requires an engineering escalation or if it is a transient blip that has self-resolved, and communicate status to affected stakeholders (employers, employees, or internal teams) if the issue causes visible service degradation.',
              tips: [
                'Keep a mental baseline of normal metrics — you can only spot anomalies if you know what normal looks like.',
                'Payment partner outages are outside your control but you own the communication. Notify affected employers proactively rather than waiting for complaints.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'User Access Management',
        description: 'Manage admin accounts and permissions',
        path: '#access-management',
        difficulty: 'advanced',
        content: {
          overview: 'Managing who has access to the admin platform — and what they can do — is a critical security function. Access should follow the principle of least privilege: every admin should have exactly the permissions needed for their role, and no more.',
          sections: [
            {
              heading: 'Creating Admin Accounts',
              body: 'Admin account creation is handled by management. All new admins receive the same level of access.',
              steps: [
                'New admin requests go through your manager or team lead.',
                'Management creates the account in Settings → User Access.',
                'The system sends an account activation email to the new admin.',
                'New admins should review all relevant documentation and complete training before taking independent actions.',
                'Document new admin accounts in your team\'s access log for audit purposes.',
              ],
            },
            {
              heading: 'Offboarding Admin Accounts',
              body: 'When an admin leaves the organisation: immediately disable their account (do not wait for IT offboarding to complete), invalidate all active sessions, review their recent audit trail activity for any actions requiring follow-up, and document the offboarding in the access log. Never leave a departing admin\'s account active — even for a day.',
              warnings: [
                'A former admin with active credentials is a critical security risk. Account deactivation on the last day of employment is non-negotiable.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'System Maintenance',
        description: 'Scheduled maintenance and updates',
        path: '#maintenance',
        difficulty: 'advanced',
        content: {
          overview: 'Planned system maintenance windows are necessary for applying updates, running database optimisations, and deploying new features. As an admin, you are responsible for communicating maintenance windows to employers and coordinating timing to minimise disruption.',
          sections: [
            {
              heading: 'Maintenance Windows',
              body: 'Scheduled maintenance should be planned for: Sundays between 1AM and 5AM (lowest advance request volume), at least 72 hours notice to employers for any maintenance exceeding 30 minutes, and ideally aligned with payroll off-periods (mid-month for monthly payroll employers).',
            },
            {
              heading: 'Pre-Maintenance Checklist',
              body: 'Before every maintenance window:',
              steps: [
                'Send employer notification email using the maintenance notice template.',
                'Post a platform status update on the status page.',
                'Ensure no disbursements are pending in the queue — process or defer them.',
                'Confirm the engineering team has a rollback plan documented.',
                'Set up an on-call admin for immediate response if maintenance causes unexpected issues.',
              ],
            },
            {
              heading: 'Post-Maintenance Validation',
              body: 'After maintenance completes: run the system health check suite, process a test advance through the full lifecycle in the staging environment, confirm email delivery is functioning, verify payment partner integrations are live, and send an all-clear notification to employers before announcing the platform is back online.',
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'notifications-communication',
    title: 'Notifications & Communication',
    icon: Bell,
    description: 'Stay informed and coordinate',
    articles: [
      {
        title: 'Admin Notifications',
        description: 'Understanding and managing admin alerts',
        path: '#notifications',
        difficulty: 'beginner',
        content: {
          overview: 'The EaziWage admin notification system ensures you are informed of events requiring your attention — from new advance requests in the manual queue to system health alerts and fraud flags. Managing your notifications effectively is the difference between proactive and reactive admin work.',
          sections: [
            {
              heading: 'Notification Categories',
              body: 'Admin notifications are grouped into four categories:',
              steps: [
                'Action Required — Disbursements awaiting review, KYC documents pending verification, employer applications in queue. These have SLA timers.',
                'Alerts — Fraud flags, risk score spikes, system health warnings. High priority, require prompt response.',
                'Informational — Status change confirmations, completed reconciliations, scheduled report availability.',
                'System — Maintenance window reminders, API downtime notifications, version update announcements.',
              ],
            },
            {
              heading: 'Notification Channels',
              body: 'Notifications are delivered via: in-platform notification centre (bell icon, top navigation), email to your registered admin email address, and optionally SMS for critical alerts (configurable in your profile settings). The in-platform notification centre is the authoritative source — email and SMS are supplements, not replacements.',
              tips: [
                'Do not rely solely on email for time-sensitive alerts — email delivery can be delayed. Check the in-platform centre at the start of each shift.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Communication Channels',
        description: 'Internal chat and support systems',
        path: '#communication',
        difficulty: 'beginner',
        content: {
          overview: 'EaziWage provides structured communication channels for admin-to-employer, admin-to-employee, and admin-to-admin communication. Using platform channels (rather than personal email or WhatsApp) is mandatory for all official platform communications — it maintains the audit trail and ensures record retention compliance.',
          sections: [
            {
              heading: 'Employer Messaging',
              body: 'Communicate with employers through the Employer Portal → Messages tab. All messages are threaded by topic and retained permanently. Response time SLA: 4 business hours for operational queries, 1 business hour for urgent compliance matters. Templates are available for common communications (KYC requests, suspension notices, maintenance alerts).',
            },
            {
              heading: 'Employee Communications',
              body: 'Direct admin-to-employee communication is routed through the Employee Profile → Messages tab. In most cases, communicate through the employer\'s HR contact rather than directly with employees — this preserves the employer relationship. Direct employee contact is appropriate for: KYC verification queries, account security alerts, and fraud investigation.',
            },
            {
              heading: 'Internal Admin Communication',
              body: 'For admin-to-admin coordination (e.g. handing over an investigation to a colleague), use the internal notes feature on the relevant entity (employer, employee, or advance) — not personal messaging. This keeps context attached to the record, not buried in someone\'s inbox.',
              warnings: [
                'Never share sensitive case details over personal WhatsApp, SMS, or personal email — even with colleagues. This is a data protection violation.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Alert Configuration',
        description: 'Set up custom alerts and automations',
        path: '#alert-config',
        difficulty: 'intermediate',
        content: {
          overview: 'The alert configuration system allows admins to define custom notification rules beyond the system defaults. Well-configured alerts reduce time spent on manual monitoring and ensure critical events never fall through the cracks.',
          sections: [
            {
              heading: 'Creating a Custom Alert',
              body: 'Navigate to Settings → Notifications → Custom Alerts → New Alert. Define:',
              steps: [
                'Trigger condition — The event or threshold that fires the alert (e.g. "Advance amount > KES 30,000", "Employer repayment overdue > 3 days").',
                'Delivery channel — In-platform, email, or SMS.',
                'Recipient — Your account, all admin accounts.',
                'Escalation — If not acknowledged within X minutes, escalate to the next tier.',
                'Active hours — Whether the alert fires 24/7 or only during business hours.',
              ],
            },
            {
              heading: 'Recommended Default Alerts',
              body: 'If not already configured, set up alerts for:',
              steps: [
                'Any advance request above KES 50,000.',
                'Any employer repayment overdue by more than 2 business days.',
                'Risk score change of more than 25 points in 48 hours (employer or employee).',
                'API error rate exceeding 2% for more than 5 minutes.',
                'Any new fraud alert raised — immediate, 24/7.',
              ],
              tips: [
                'Start conservative with alert thresholds. Too many alerts leads to alert fatigue — you start ignoring them. Tune thresholds after 2 weeks of baseline observation.',
              ],
            },
          ],
        } as ArticleContent,
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: AlertTriangle,
    description: 'Common issues and solutions',
    articles: [
      {
        title: 'Common Login Issues',
        description: 'Resolve authentication and access problems',
        path: '#login-issues',
        difficulty: 'beginner',
        content: {
          overview: 'Login and authentication issues are the most frequent support requests from both admins and employer users. Most are straightforward to resolve — the key is systematic diagnosis rather than jumping straight to password resets.',
          sections: [
            {
              heading: 'Admin Login Troubleshooting',
              body: 'If an admin cannot log in, check in this order:',
              steps: [
                'Is the account active? — Check Settings → User Access for account status. A departed colleague may have had their account deactivated.',
                'Correct email address? — Admin accounts are tied to a specific work email. Personal email addresses will not work.',
                'Password reset — If credentials are correct but login fails, trigger a password reset from Settings → User Access → Reset Password.',
                'MFA issues — If the admin has lost access to their MFA device, contact your manager or IT to temporarily disable MFA for their account to allow login, then re-enrol. Do not permanently disable MFA.',
                'Browser/device issue — Ask the admin to try an incognito window or a different browser. Cached session conflicts cause intermittent login failures.',
              ],
            },
            {
              heading: 'Employer Portal Login Issues',
              body: 'For employer users reporting login issues: verify their account is Active in the Employer Profile, confirm they are using the correct portal URL (not the admin URL), and use the "Resend Invitation" button to resend access credentials. If an employer reports their account was "hacked", immediately suspend the employer account and investigate before restoring access.',
            },
            {
              heading: 'Session Timeout',
              body: 'Admin sessions expire after 8 hours of inactivity. This is a security control — do not request it be extended. Employers\' sessions expire after 24 hours. If users report being "logged out frequently", this is expected behaviour, not a bug.',
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Data Sync Problems',
        description: 'Fix database synchronisation issues',
        path: '#sync-issues',
        difficulty: 'intermediate',
        content: {
          overview: 'Data sync issues occur when data shown in the EaziWage admin dashboard does not match what an employer sees in their portal, or when recently submitted data has not appeared as expected. These are usually caused by replication lag, caching, or failed webhook deliveries.',
          sections: [
            {
              heading: 'Common Sync Scenarios',
              body: 'Frequent sync issues you will encounter:',
              steps: [
                'Employee roster not updating — Employer uploaded a new roster but employee list has not changed. Check Employer → Integrations → Last Sync timestamp. If >1 hour, trigger a manual sync.',
                'Advance status lag — An advance shows as Pending in the employer portal but Approved in admin. Clear the relevant cache entry via Settings → Cache → Flush Entity (select the advance ID).',
                'Repayment not reflected — Employer remitted but balance has not updated. Check the payment partner webhook log for the transaction. If the webhook failed, manually trigger re-processing.',
                'KYC status mismatch — Admin approved KYC but employee still sees "Pending" status. Force a profile refresh from the Employee Profile → Actions → Sync Status.',
              ],
            },
            {
              heading: 'Webhook Failures',
              body: 'Webhooks are the mechanism by which payment partners notify EaziWage of transaction events. Failed webhooks are the most common cause of data sync issues. Navigate to Settings → Integrations → Webhook Logs to see failed deliveries. You can retry individual failed webhooks from this view. If an entire payment partner\'s webhooks are failing, it may indicate an IP allowlist or authentication issue — escalate to engineering.',
              warnings: [
                'Do not manually adjust transaction data to "fix" a sync issue you do not fully understand. Incorrect manual adjustments can create reconciliation problems that take days to untangle.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Performance Optimization',
        description: 'Improve dashboard loading and responsiveness',
        path: '#performance',
        difficulty: 'advanced',
        content: {
          overview: 'Dashboard performance issues — slow loading, laggy interactions, timeouts — are usually caused by one of three things: heavy database queries, excessive data volumes without pagination, or client-side resource constraints. Most performance issues can be diagnosed and resolved without engineering intervention.',
          sections: [
            {
              heading: 'Diagnosing Slow Dashboard',
              body: 'When the dashboard is slow, diagnose systematically:',
              steps: [
                'Is it global or page-specific? — Load the homepage and two or three other pages. If only one page is slow, the issue is that page\'s data query, not a global problem.',
                'Check the API health dashboard — Is database connection pool utilisation high? Are query response times elevated?',
                'Check the browser — Open DevTools (F12) → Network tab → reload the slow page. Identify which API call is taking the longest.',
                'Check the data volume — If a table has grown significantly (e.g. the advances list now has 100,000 rows), pagination or filtering may need adjustment.',
              ],
            },
            {
              heading: 'Quick Fixes',
              body: 'Common performance fixes available to admins:',
              steps: [
                'Apply date filters — Always filter large lists (advances, audit trail) to a specific date range. Fetching all records is slow and unnecessary.',
                'Reduce export size — If exporting large reports is causing timeouts, split the export into smaller date ranges.',
                'Clear browser cache — Sometimes the browser is caching stale scripts. Hard refresh (Ctrl+Shift+R) resolves this.',
                'Switch to a wired connection — If on WiFi and experiencing intermittent slowness, connection quality may be the variable.',
              ],
              tips: [
                'Report consistently slow pages to engineering with the specific API call timing from DevTools — it helps them diagnose and fix the root cause.',
              ],
            },
          ],
        } as ArticleContent,
      },
      {
        title: 'Emergency Procedures',
        description: 'Critical issues and escalation protocols',
        path: '#emergency',
        difficulty: 'advanced',
        content: {
          overview: 'Some situations require immediate, coordinated response beyond normal admin procedures. Knowing the emergency protocols — and following them without improvising — is critical to minimising damage and restoring service quickly.',
          sections: [
            {
              heading: 'Emergency Scenarios',
              body: 'Situations that trigger emergency protocols:',
              steps: [
                'Platform-wide outage — Employers and employees cannot log in or access the platform at all.',
                'Mass failed disbursements — A large batch of advances failed to disburse simultaneously.',
                'Suspected data breach — Evidence that personal data has been accessed or exfiltrated by an unauthorised party.',
                'Payment partner compromise — A payment partner reports a security incident affecting transactions.',
                'Fraud at scale — Evidence of coordinated fraudulent activity across multiple employers or employees.',
              ],
            },
            {
              heading: 'Emergency Response Steps',
              body: 'In any emergency:',
              steps: [
                'DO NOT try to fix it alone — Immediately escalate to your manager and engineering lead. Use the emergency contact list in Settings → Emergency Contacts.',
                'Document the symptom timeline — Note exactly when the issue started, what changed just before it, and who noticed it first. This is invaluable for diagnosis.',
                'Contain before fixing — For a data breach or fraud: suspend affected accounts BEFORE attempting remediation. Stopping the bleeding comes first.',
                'Communicate status — Update the platform status page within 15 minutes of declaring an emergency, even if you only have "We are aware and investigating."',
                'Preserve evidence — Do not clear logs, reset sessions, or delete anything until the engineering team has captured relevant diagnostics.',
                'Post-incident review — Within 48 hours of resolution, complete a formal incident report covering: root cause, timeline, impact, resolution steps, and preventive measures.',
              ],
              warnings: [
                'A data breach must be reported to the Data Protection Officer within 24 hours and to the relevant regulator within 72 hours. These are legal deadlines — not guidelines.',
              ],
            },
          ],
        } as ArticleContent,
      },
    ],
  },
];

const difficultyColors = {
  beginner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

interface Article {
  title: string;
  description: string;
  path: string;
  difficulty: string;
  content: ArticleContent;
}

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const [openSections, setOpenSections] = useState<number[]>([0]);

  const toggleSection = (index: number) => {
    setOpenSections(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                difficultyColors[article.difficulty as keyof typeof difficultyColors]
              )}>
                {article.difficulty}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {article.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{article.description}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-700/30 rounded-xl">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {article.content.overview}
            </p>
          </div>

          
          {article.content.sections.map((section, index) => {
            const isOpen = openSections.includes(index);
            return (
              <div
                key={index}
                className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    {section.heading}
                  </span>
                  <ChevronDown className={cn(
                    'w-4 h-4 text-slate-400 transition-transform shrink-0',
                    isOpen && 'rotate-180'
                  )} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {section.body}
                    </p>

                    {section.steps && (
                      <ol className="space-y-2">
                        {section.steps.map((step, si) => (
                          <li key={si} className="flex gap-3">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5">
                              {si + 1}
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {section.tips && section.tips.length > 0 && (
                      <div className="space-y-2">
                        {section.tips.map((tip, ti) => (
                          <div key={ti} className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700/30 rounded-lg">
                            <span className="text-blue-500 shrink-0 text-xs font-bold mt-0.5">TIP</span>
                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {section.warnings && section.warnings.length > 0 && (
                      <div className="space-y-2">
                        {section.warnings.map((warning, wi) => (
                          <div key={wi} className="flex gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-700/30 rounded-lg">
                            <span className="text-red-500 shrink-0 text-xs font-bold mt-0.5">WARN</span>
                            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredSections = docSections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(section => section.articles.length > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Documentation</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Complete guide to managing the EaziWage platform
          </p>
        </div>
      </div>

      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {docSections.reduce((acc, section) => acc + section.articles.length, 0)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Articles</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">8</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Categories</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">3</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Difficulty Levels</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">24/7</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Available</p>
            </div>
          </div>
        </div>
      </div>

      
      <div className="space-y-6">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <div key={section.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-linear-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {section.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {section.description} ({section.articles.length} articles)
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  'w-5 h-5 text-slate-400 transition-transform',
                  isExpanded && 'rotate-90'
                )} />
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {section.articles.map((article, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {article.title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {article.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                              difficultyColors[article.difficulty as keyof typeof difficultyColors]
                            )}>
                              {article.difficulty}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedArticle(article as Article)}
                          className="shrink-0 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      
      <div className="bg-linear-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-500/10 rounded-xl p-6 border border-emerald-200 dark:border-emerald-700/30">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Links</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/admin" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Admin Dashboard</span>
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform Settings</span>
          </Link>
          <Link href="/admin/api-health" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Wifi className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">System Health</span>
          </Link>
        </div>
      </div>

      
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  );
}