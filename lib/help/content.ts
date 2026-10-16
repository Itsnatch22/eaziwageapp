import { type HelpArticle, helpFrontmatterSchema } from "@/lib/help/schema";

export const helpArticles: HelpArticle[] = [
  {
    slug: "request-advance",
    title: "Request a wage advance",
    description:
      "Understand how an employee can request part of their earned wages before payday and what information is needed to avoid delays.",
    audience: "employees",
    category: "advances",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["ADV-101", "ADV-202", "ADV-418"],
    synonyms: [
      "wage advance",
      "request advance",
      "take my earned pay early",
      "early salary",
      "advance request",
    ],
    related: ["track-earnings", "set-payment-method", "review-advance-requests"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What this does",
        body:
          "An employee can request a portion of wages they have already earned, based on the employer's configured EWA settings and the employee's available balance.",
      },
      {
        heading: "What to check before submitting",
        body:
          "Verify your profile, ensure your payout method is active, and confirm that your employer has not reached its payroll or approval limits for your account.",
      },
      {
        heading: "If the request is blocked",
        body:
          "A request may be blocked if the account is pending verification, the employee has already submitted another active request, or the employer has not approved the amount. Review your available earnings and contact support if the system still shows the request as unavailable.",
      },
    ],
  },
  {
    slug: "track-earnings",
    title: "Track your earned wages and available balance",
    description:
      "See how much has been earned, what is available to withdraw, and how deductions affect the remaining balance.",
    audience: "employees",
    category: "earnings",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["EARN-114", "EARN-226", "REP-155"],
    synonyms: ["available balance", "earned wages", "salary tracker", "my earnings"],
    related: ["request-advance", "manage-repayment", "track-payroll-deductions"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What this dashboard shows",
        body:
          "The employee dashboard displays the amount earned, approved advances, active deductions, and the amount still available for a new request or withdrawal.",
      },
      {
        heading: "Why the numbers change",
        body:
          "Each payroll run updates earnings and any deductions tied to prior advances. New repayment schedules and employer approval changes can reduce what is currently available.",
      },
      {
        heading: "What to do if the balance looks wrong",
        body:
          "Check the last payroll cycle, recent advance approvals, and scheduled deductions. If the balance still looks incorrect, compare the dates with the most recent payslip and raise the issue through support.",
      },
    ],
  },
  {
    slug: "set-payment-method",
    title: "Set up your payout method",
    description:
      "Add or update the mobile money or bank account that should receive your approved advance or payroll-linked payout.",
    audience: "employees",
    category: "payouts",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["PAYOUT-301", "PAYOUT-410", "PAYOUT-502"],
    synonyms: ["mobile money details", "wallet details", "bank account", "payout method"],
    related: ["request-advance", "resolve-payout-delay", "verify-profile"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What this does",
        body:
          "The payout method tells the system where to send approved wage advances or payroll-linked disbursements, such as M-Pesa, Airtel Money, or a bank account.",
      },
      {
        heading: "Why it matters",
        body:
          "Incorrect details can delay payment or cause the transaction to be sent to the wrong account. The system expects the registered account to match the verified identity on the profile.",
      },
      {
        heading: "What to check",
        body:
          "Update your profile with the latest phone number or wallet, make sure the details are active, and confirm the same information was used during verification. If a payout already went out, contact support immediately for review.",
      },
    ],
  },
  {
    slug: "verify-profile",
    title: "Verify your profile and KYC",
    description:
      "Complete the profile and identity checks required for onboarding, limits, and payment approvals across the platform.",
    audience: "employees",
    category: "account",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["KYC-201", "KYC-407", "KYC-503"],
    synonyms: ["kyc", "identity verification", "document check", "profile verification"],
    related: ["set-payment-method", "login-help", "request-advance"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "Why verification is required",
        body:
          "KYC and profile validation are part of the employee onboarding flow. They help confirm identity, reduce fraud risk, and enable access to wage advances and payouts.",
      },
      {
        heading: "Common causes of rejection",
        body:
          "The ID may be blurry, the name may not match the account, or the phone number may not correspond to the same verified records. Some submissions are also rejected when documents are incomplete or expired.",
      },
      {
        heading: "What to do next",
        body:
          "Retry with clear, readable documents and match the details on the submitted ID exactly to the account. If the review continues to fail, contact the support team and include the rejection reason shown in the app.",
      },
    ],
  },
  {
    slug: "manage-repayment",
    title: "Review repayments and scheduled deductions",
    description:
      "Understand how deductions are scheduled from your payslip and what happens when a repayment is due or delayed.",
    audience: "employees",
    category: "repayments",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["REP-155", "REP-311", "PAY-221"],
    synonyms: ["repayment schedule", "salary deductions", "deduction history"],
    related: ["track-earnings", "request-advance", "track-payroll-deductions"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What is being deducted",
        body:
          "Repayments are normally taken from your next payroll cycle or the next approved deduction window. The schedule shows the amount, status, and the date the deduction is expected to hit your payslip.",
      },
      {
        heading: "Why a deduction may look different",
        body:
          "It may reflect an outstanding balance from a previous advance or a payroll change after the last approval. Some employers also update their deduction rules as part of normal pay-cycle processing.",
      },
      {
        heading: "If you think the deduction is wrong",
        body:
          "Check the actual deduction amount against your approved advance and payslip. If the mismatch remains, open a support request with the employee ID, pay period, and the amount you believe is incorrect.",
      },
    ],
  },
  {
    slug: "login-help",
    title: "Log in and recover access",
    description:
      "Recover access when your account is locked, a password reset is not arriving, or a sign-in step fails on the employee portal.",
    audience: "employees",
    category: "account",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["ACC-401", "ACC-509", "AU-501"],
    synonyms: ["reset password", "can't sign in", "locked account", "forgot password"],
    related: ["verify-profile", "report-issue", "resolve-payout-delay"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What you're seeing",
        body:
          "The employee portal may reject the password, fail the reset flow, or lock the user after repeated attempts. In some cases, the account remains active but cannot complete the sign-in challenge.",
      },
      {
        heading: "Likely causes",
        body:
          "The phone number or email is outdated, the reset link has expired, or the account is temporarily blocked because of repeated failed attempts or a pending review.",
      },
      {
        heading: "What to check",
        body:
          "Use the reset flow with the same verified contact details, confirm there are no typing errors, and wait a short while if the account has been locked. If access still fails, contact support and provide the last successful login date and the phone or email registered on the profile.",
      },
    ],
  },
  {
    slug: "resolve-payout-delay",
    title: "Resolve a delayed or missing payout",
    description:
      "Review the usual reasons a wage advance or payroll disbursement is still pending, stuck, or not reflected in the mobile money or bank account.",
    audience: "employees",
    category: "funds",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["PAYOUT-502", "PAYOUT-603", "WD-102"],
    synonyms: ["missing money", "delayed payout", "withdrawal pending", "funds not received"],
    related: ["set-payment-method", "manage-repayment", "report-issue"],
    urgent: true,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What you're seeing",
        body:
          "The advance or payout status may show as approved or sent, but the funds are not yet visible in the wallet or bank account linked to the employee profile.",
      },
      {
        heading: "Likely causes",
        body:
          "The payment may still be in processing, the payout provider may be delayed, or the wallet number is incorrect. Some issues are caused by verification or top-up blocks that are resolved only after a profile review.",
      },
      {
        heading: "What to do",
        body:
          "Check the payout method and the latest transaction status in the app, then wait a short period before retrying. If the sequence still does not complete, escalate the case with the payment date, wallet number, and the exact message shown in the dashboard.",
      },
    ],
  },
  {
    slug: "report-issue",
    title: "Report suspicious activity or account issues",
    description:
      "Flag a suspected security problem, unusual payment activity, or account change before any further funds or approvals are affected.",
    audience: "employees",
    category: "security",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["SEC-710", "SEC-801", "ACC-401"],
    synonyms: ["fraud report", "suspicious transaction", "account compromised", "scam"],
    related: ["login-help", "resolve-payout-delay", "verify-profile"],
    urgent: true,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What this covers",
        body:
          "Employees should report anything unusual, including unexpected changes to the profile, unusual deductions, or messages that request personal or wallet credentials.",
      },
      {
        heading: "Likely causes",
        body:
          "A scam message may be impersonating support, or someone may have accessed the account through the wrong device or phone number. Reports often begin when a new transaction, login, or payment change is noticed by the employee.",
      },
      {
        heading: "How to respond",
        body:
          "Never share your password, PIN, or wallet credentials. Change the password immediately, review the account activity, and open a support ticket with the exact message or transaction you saw.",
      },
    ],
  },
  {
    slug: "add-team-and-onboard",
    title: "Add and onboard employees",
    description:
      "Set up your team correctly so employee eligibility, payroll deductions, and advance approvals can work smoothly from the first pay cycle onwards.",
    audience: "employers",
    category: "onboarding",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["EMP-101", "EMP-204", "KYC-201"],
    synonyms: ["invite employees", "new hire setup", "staff onboarding"],
    related: ["set-company-rules", "review-advance-requests", "review-risk-and-compliance"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What this process covers",
        body:
          "Employers add staff records, confirm their phone and profile details, and ensure each employee completes the required verification and onboarding steps before EWA is enabled.",
      },
      {
        heading: "Why onboarding matters",
        body:
          "A missing or incomplete employee profile can stop access to advances, block payroll-linked deductions, or leave the account in a suspended state until the issue is fixed.",
      },
      {
        heading: "What to check",
        body:
          "Confirm each employee has a complete profile, an active phone number, and successful KYC review. If onboarding is incomplete, ask the employee to finish verification before the next payroll run or advance review cycle.",
      },
    ],
  },
  {
    slug: "set-company-rules",
    title: "Set company EWA limits and approval rules",
    description:
      "Configure employer-level rules such as approval limits, risk thresholds, and the settings that determine how much an employee can access.",
    audience: "employers",
    category: "settings",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["CFG-110", "CFG-214", "RISK-058"],
    synonyms: ["advance limits", "employer settings", "EWA config", "approval rules"],
    related: ["add-team-and-onboard", "monitor-wallet", "review-risk-and-compliance"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What these settings control",
        body:
          "Employer-level configuration covers the advance policy, deduction thresholds, risk settings, and the rules that decide how much an employee can access before payday.",
      },
      {
        heading: "Why they matter",
        body:
          "Incorrect settings can create low limits, failed approvals, or excessive exposure for the employer. The rules need to match the employer's payroll policy and current financial position.",
      },
      {
        heading: "What to review",
        body:
          "Check the employer's configured limit percentages, cooldown period, and risk thresholds against the live payroll and hiring plan. Make adjustments before the next approval cycle if the limit has become too restrictive or too permissive.",
      },
    ],
  },
  {
    slug: "review-advance-requests",
    title: "Review and approve employee advance requests",
    description:
      "Assess employee requests, confirm the amount and eligibility, and approve or reject the advance before payment is sent.",
    audience: "employers",
    category: "approvals",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["ADV-304", "ADV-418", "WAL-408"],
    synonyms: ["approve advance", "advance review", "wage advance approval"],
    related: ["add-team-and-onboard", "track-payroll-deductions", "set-company-rules"],
    urgent: true,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What the employer sees",
        body:
          "The approval flow shows the employee's request, their available balance, and the employer's configured exposure or limit around that request.",
      },
      {
        heading: "Why approval can fail",
        body:
          "Approval is blocked when there are insufficient available funds, the employee is no longer eligible, the account is in a pending or restricted state, or the employer's funding rules are not met.",
      },
      {
        heading: "What to check before approving",
        body:
          "Verify the employee's payroll status, review the requested amount against their earnings, and confirm the choice is aligned with employer policy. If the request is still blocked after review, check wallet sufficiency and service status.",
      },
    ],
  },
  {
    slug: "track-payroll-deductions",
    title: "Track payroll deductions and repayment schedules",
    description:
      "Compare the deductions taken from payroll with each approved advance and confirm that repayments are happening in the correct pay period.",
    audience: "employers",
    category: "payroll",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["PAY-221", "PAY-330", "REP-311"],
    synonyms: ["payroll reconciliation", "deduction mismatch", "repayment tracking"],
    related: ["review-advance-requests", "monitor-wallet", "manage-repayment"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What to monitor",
        body:
          "Employers should review active advances, monthly or weekly deduction windows, and the total amount being recovered from payroll against the employee's approved amount.",
      },
      {
        heading: "Why mismatches happen",
        body:
          "A mismatch typically happens when an employee has a newer approved advance, a different payroll run was used, or the deduction date changed after the original schedule was created.",
      },
      {
        heading: "How to resolve it",
        body:
          "Fetch the employee's advance history, reconcile it with the actual payroll file, and confirm the amount matches the reported deduction. If the issue remains, escalate the pay period with the employee record and the payroll file reference.",
      },
    ],
  },
  {
    slug: "monitor-wallet",
    title: "Monitor employer wallet and funding status",
    description:
      "Track the employer's available balance, reserved funds, and the current funding state needed to support approved employee advances.",
    audience: "employers",
    category: "funds",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["WAL-134", "WAL-408", "PAYOUT-301"],
    synonyms: ["funding status", "wallet balance", "available funds", "employer wallet"],
    related: ["set-company-rules", "track-payroll-deductions", "review-advance-requests"],
    urgent: true,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What the wallet shows",
        body:
          "The employer wallet captures the available balance, reserved amounts for approved advances, and the total liabilities tied to payroll or funding activity that must be reconciled over time.",
      },
      {
        heading: "Why a wallet can be restricted",
        body:
          "A wallet may be restricted if funding has not been approved, there are outstanding liabilities, or the system is waiting on a reconciliation update from the payment provider.",
      },
      {
        heading: "What to do",
        body:
          "Review the current available balance, confirm there are no pending funding approvals, and cross-check the employer's outstanding liability with the approval queue. If funds are still blocked, escalate to the operations team with the wallet ID and funding status.",
      },
    ],
  },
  {
    slug: "review-risk-and-compliance",
    title: "Review risk and compliance status",
    description:
      "Check employee or employer risk scoring, KYC status, and compliance signals before approving a new request or changing payroll policy.",
    audience: "employers",
    category: "risk",
    countries: ["all", "KE", "UG", "TZ", "RW"],
    errorCodes: ["RISK-058", "KYC-503", "CFG-214"],
    synonyms: ["risk score", "compliance review", "fraud signals", "KYC approval"],
    related: ["add-team-and-onboard", "set-company-rules", "monitor-wallet"],
    urgent: false,
    lastVerified: new Date("2026-10-08"),
    sections: [
      {
        heading: "What the risk view shows",
        body:
          "The risk and compliance screen can summarize an employee or employer score, document status, and operational signals that affect advance approvals and platform exposure.",
      },
      {
        heading: "Why it matters",
        body:
          "Risk scoring helps employers and administrators decide whether a request is safe to approve, whether a profile needs more review, or whether a company has reached a threshold that requires stricter controls.",
      },
      {
        heading: "What to do when it changes",
        body:
          "Review the score, check whether verification closed correctly, and confirm whether the latest payroll or funding conditions changed the risk posture. When the result is unclear, escalate with the profile and the risk outcome details.",
      },
    ],
  },
];

export const articleMap = new Map(
  helpArticles.map((article) => [article.slug, article]),
);

export function getHelpArticleBySlug(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}

export function getAudienceArticles(audience: "employees" | "employers") {
  return helpArticles
    .filter((article) => article.audience === audience)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getUrgentArticles() {
  return helpArticles.filter((article) => article.urgent).slice(0, 3);
}

export function getRelatedArticles(slug: string) {
  const article = getHelpArticleBySlug(slug);
  if (!article) return [];

  return article.related
    .map((relatedSlug) => getHelpArticleBySlug(relatedSlug))
    .filter((related): related is NonNullable<typeof related> => Boolean(related));
}

export const validatedHelpArticles = helpArticles.map((article) =>
  helpFrontmatterSchema.parse(article),
);
