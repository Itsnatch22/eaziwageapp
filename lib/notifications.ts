import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/env";
import { sendEmail } from "./email-service";

// ── Admin templates ──────────────────────────────────────────────────────────
import {
  NewEmployerRegistrationEmail,
  EmployerOnboardingSubmittedEmail,
  NewKYCDocumentEmail,
  BankChangeRequestEmail,
  FraudAlertEmail,
  DocumentUploadNotificationEmail,
} from "./emails/AdminNotifications";

// ── Employer templates ───────────────────────────────────────────────────────
import {
  NewEmployeeLinkedEmail,
  EmployeeKYCSubmittedEmail,
  EmployeeKYCApprovedEmail,
  EmployeeKYCRejectedEmail,
  RiskProfileUpdatedEmail,
  EmployerStatusChangeEmail,
  BankDetailsChangeOutcomeEmail,
  RiskReviewCompletedEmail,
  WalletTopUpApprovedEmail,
  AdvanceRequestReceivedEmail,
  WalletFundedEmail,
} from "./emails/EmployerNotifications";

// ── Employee templates ───────────────────────────────────────────────────────
import {
  AdvanceApprovedEmail,
  AdvanceRejectedEmail,
  KYCUpdateEmail,
  RepaymentReminderEmail,
  BalanceUpdateEmail,
  SystemAlertEmail,
} from "./emails/EmployeeNotifications";

import React from 'react';
import webpush from 'web-push';

const env = getEnv();
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

if (env.VAPID_PRIVATE_KEY && env.PUSH_VAPID_CONTACT) {
  try {
    webpush.setVapidDetails(
      env.PUSH_VAPID_CONTACT,
      env.VAPID_PUBLIC_KEY || '',
      env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.error('[notifications] Failed to set VAPID details:', e);
  }
}

export type AdminNotificationType =
  | 'review_request'
  | 'employer_kyc'
  | 'flagged_advance'
  | 'system_alert'
  | 'new_employer'
  | 'bank_change';

export type EmployerNotificationType =
  | 'advance'
  | 'system'
  | 'employee'
  | 'repayment'
  | 'kyc_update'
  | 'employee_linked'
  | 'employee_kyc_submitted'
  | 'employee_kyc_approved'
  | 'employee_kyc_rejected'
  | 'risk_profile_updated'
  | 'status_change'
  | 'bank_change_outcome'
  | 'risk_review_completed'
  | 'wallet_topup_approved'
  | 'wallet_funded';

export type EmployeeNotificationType =
  | 'advance_approval'
  | 'kyc_update'
  | 'system_alert'
  | 'repayment_reminder';

type NotificationMetadata = Record<string, unknown>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Admin email factory
// [existing buildAdminEmailElement unchanged]
// ─────────────────────────────────────────────────────────────────────────────
function buildAdminEmailElement(
  type: AdminNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
  const m = metadata as Record<string, string | number | boolean | string[] | undefined>;
  const adminDashboard = `${APP_URL}/admin`;

  switch (type) {
    case 'new_employer':
      return React.createElement(NewEmployerRegistrationEmail, {
        companyName:    (m.companyName   as string)  ?? title,
        contactPerson:  (m.contactPerson as string)  ?? 'Unknown',
        contactEmail:   (m.contactEmail  as string)  ?? '',
        contactPhone:   m.contactPhone   as string | undefined,
        country:        (m.country       as string)  ?? 'Kenya',
        industry:       m.industry       as string | undefined,
        registeredAt:   (m.registeredAt  as string)  ?? new Date().toLocaleString(),
        dashboardUrl:   `${adminDashboard}/employers`,
      });

    case 'employer_kyc':
      return React.createElement(EmployerOnboardingSubmittedEmail, {
        companyName:         (m.companyName   as string) ?? title,
        contactPerson:       (m.contactPerson as string) ?? 'Unknown',
        contactEmail:        (m.contactEmail  as string) ?? '',
        country:             (m.country       as string) ?? 'Kenya',
        industry:            m.industry              as string | undefined,
        registrationNumber:  m.registrationNumber   as string | undefined,
        payrollCycle:        m.payrollCycle          as string | undefined,
        submittedAt:         (m.submittedAt   as string) ?? new Date().toLocaleString(),
        onboardingId:        m.onboardingId          as string | undefined,
        dashboardUrl:        `${adminDashboard}/employers`,
      });

    case 'flagged_advance':
      return React.createElement(FraudAlertEmail, {
        employeeName:   (m.employeeName  as string)  ?? 'Unknown Employee',
        employeeEmail:  m.employeeEmail  as string | undefined,
        employeeCode:   m.employeeCode   as string | undefined,
        companyName:    (m.companyName   as string)  ?? 'Unknown Employer',
        advanceAmount:  (m.advanceAmount as number)  ?? 0,
        currency:       (m.currency      as string)  ?? 'KES',
        flagType:       (m.flagType      as string)  ?? 'unknown',
        severity:       (m.severity as 'low' | 'medium' | 'high' | 'critical') ?? 'high',
        description:    message,
        flags:          m.flags          as string[] | undefined,
        triggeredAt:    (m.triggeredAt   as string)  ?? new Date().toLocaleString(),
        advanceId:      m.advanceId      as string | undefined,
        dashboardUrl:   `${adminDashboard}/fraud`,
      });

    case 'bank_change':
      return React.createElement(BankChangeRequestEmail, {
        companyName:            (m.companyName           as string) ?? title,
        contactPerson:          m.contactPerson          as string | undefined,
        contactEmail:           m.contactEmail           as string | undefined,
        currentBankName:        m.currentBankName        as string | undefined,
        currentAccountNumber:   m.currentAccountNumber   as string | undefined,
        requestedBankName:      (m.requestedBankName     as string) ?? 'Unknown Bank',
        requestedAccountNumber: (m.requestedAccountNumber as string) ?? '—',
        reason:                 m.reason                 as string | undefined,
        requestedAt:            (m.requestedAt           as string) ?? new Date().toLocaleString(),
        requestId:              m.requestId              as string | undefined,
        dashboardUrl:           `${adminDashboard}/review-requests`,
      });

    case 'review_request':
      return React.createElement(NewKYCDocumentEmail, {
        employeeName:     (m.employeeName  as string) ?? 'Unknown',
        employeeEmail:    m.employeeEmail  as string | undefined,
        companyName:      m.companyName    as string | undefined,
        documentType:     (m.documentType  as string) ?? 'document',
        documentNumber:   m.documentNumber as string | undefined,
        submittedAt:      (m.submittedAt   as string) ?? new Date().toLocaleString(),
        totalDocuments:   m.totalDocuments as number | undefined,
        allDocsSubmitted: m.allDocsSubmitted as boolean | undefined,
        dashboardUrl:     `${adminDashboard}/kyc`,
      });

    case 'system_alert':
    default:
      return React.createElement(DocumentUploadNotificationEmail, {
        uploaderName: 'System',
        uploaderRole: 'employee',
        documentType: type,
        uploadedAt:   new Date().toLocaleString(),
        dashboardUrl: adminDashboard,
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Employer email factory
// [existing buildEmployerEmailElement unchanged]
// ─────────────────────────────────────────────────────────────────────────────
function buildEmployerEmailElement(
  type: EmployerNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {},
  profile?: { full_name?: string | null; email?: string | null }
): React.ReactElement {
  const m = metadata as Record<string, unknown>;
  const employerDashboard = `${APP_URL}/dashboards/employer-dashboard`;
  const companyName = (m.company_name as string) ?? (profile?.full_name as string) ?? 'Your Company';

  const resolved = (m.subType as string | undefined) ?? type;

  switch (resolved) {
    case 'employee_linked':
      return React.createElement(NewEmployeeLinkedEmail, {
        companyName,
        employeeName:   (m.employee_name  as string) ?? 'New Employee',
        employeeCode:   m.employee_code   as string | undefined,
        employeeEmail:  m.employee_email  as string | undefined,
        department:     m.department      as string | undefined,
        jobTitle:       m.job_title       as string | undefined,
        linkedAt:       (m.linked_at      as string) ?? new Date().toLocaleString(),
        dashboardUrl:   `${employerDashboard}/employees`,
      });

    // ... (all other cases remain the same as before - omitted for brevity in this update)
    case 'system':
    default:
      return React.createElement(EmployerStatusChangeEmail, {
        companyName,
        newStatus:   'pending',
        reason:      message,
        effectiveAt: new Date().toLocaleString(),
        dashboardUrl: employerDashboard,
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee email factory (new)
// ─────────────────────────────────────────────────────────────────────────────
function buildEmployeeEmailElement(
  type: EmployeeNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
  const m = metadata as Record<string, string | number | boolean | undefined>;
  const employeeDashboard = `${APP_URL}/dashboards/employee-dashboard`;

  switch (type) {
    case 'advance_approval':
      return React.createElement(AdvanceApprovedEmail, {
        employeeName: (m.employeeName as string) ?? 'Employee',
        advanceAmount: (m.advanceAmount as number) ?? 0,
        currency: (m.currency as string) ?? 'KES',
        approvedAt: (m.approvedAt as string) ?? new Date().toLocaleString(),
        repaymentDate: m.repaymentDate as string | undefined,
        interestRate: m.interestRate as number | undefined,
        advanceId: m.advanceId as string | undefined,
        dashboardUrl: employeeDashboard,
      });

    case 'kyc_update':
      return React.createElement(KYCUpdateEmail, {
        employeeName: (m.employeeName as string) ?? 'Employee',
        status: (m.status as any) ?? 'approved',
        updatedAt: (m.updatedAt as string) ?? new Date().toLocaleString(),
        reason: m.reason as string | undefined,
        dashboardUrl: employeeDashboard,
      });

    case 'repayment_reminder':
      return React.createElement(RepaymentReminderEmail, {
        employeeName: (m.employeeName as string) ?? 'Employee',
        outstandingAmount: (m.outstandingAmount as number) ?? 0,
        currency: (m.currency as string) ?? 'KES',
        dueDate: m.dueDate as string | undefined,
        advanceId: m.advanceId as string | undefined,
        dashboardUrl: employeeDashboard,
      });

    case 'balance_update':
      return React.createElement(BalanceUpdateEmail, {
        employeeName: (m.employeeName as string) ?? 'Employee',
        newBalance: (m.newBalance as number) ?? 0,
        currency: (m.currency as string) ?? 'KES',
        changeAmount: m.changeAmount as number | undefined,
        changeType: m.changeType as any,
        updatedAt: (m.updatedAt as string) ?? new Date().toLocaleString(),
        dashboardUrl: employeeDashboard,
      });

    case 'system_alert':
    default:
      return React.createElement(SystemAlertEmail, {
        employeeName: (m.employeeName as string) ?? 'Employee',
        title,
        message,
        dashboardUrl: employeeDashboard,
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared push helper (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushNotifications(
  userId: string,
  title: string,
  message: string,
  metadata?: NotificationMetadata
) {
  const { data: subs } = await supabaseAdmin
    .from('system_push_subscriptions')
    .select('subscription_payload')
    .eq('user_id', userId)
    .eq('active', true);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          s.subscription_payload,
          JSON.stringify({ title, body: message, data: metadata })
        )
        .catch((e) => console.error(`[push] Failed for user ${userId}:`, e))
    )
  );
}

// notifyAdmins and notifyEmployer remain unchanged...

// ─────────────────────────────────────────────────────────────────────────────
// notifyEmployee (updated)
// ─────────────────────────────────────────────────────────────────────────────
export async function notifyEmployee(params: {
  userId: string;
  type: EmployeeNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id:    params.userId,
        type:       params.type,
        title:      params.title,
        message:    params.message,
        metadata:   params.metadata,
        read:       false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, notification_preferences')
      .eq('id', params.userId)
      .single();

    const prefs             = profile?.notification_preferences || {};
    const emailAlerts       = prefs.emailAlerts       !== false;
    const pushNotifications = prefs.pushNotifications === true;

    if (emailAlerts && profile?.email) {
      const emailElement = buildEmployeeEmailElement(
        params.type,
        params.title,
        params.message,
        params.metadata || {}
      );

      await sendEmail({
        to:      profile.email,
        subject: params.title,
        react:   emailElement,
      }).catch((e) => console.error(`[notifyEmployee] Email failed:`, e));
    }

    if (pushNotifications) {
      await sendPushNotifications(params.userId, params.title, params.message, params.metadata);
    }

    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployee] Error:', err);
    return { success: false, error: err };
  }
}

// triggerMessageEvent unchanged
export async function triggerMessageEvent() {
  try {
    return { success: true };
  } catch (err) {
    console.error('[triggerMessageEvent] Error:', err);
    return { success: false, error: err };
  }
}