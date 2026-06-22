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

  // Prefer metadata.subType for granular routing, fall back to the type itself
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

    case 'employee_kyc_submitted':
      return React.createElement(EmployeeKYCSubmittedEmail, {
        companyName,
        employeeName:  (m.employee_name as string) ?? 'Employee',
        employeeCode:  m.employee_code  as string | undefined,
        documentTypes: m.document_types as string[] | undefined,
        submittedAt:   (m.submitted_at  as string) ?? new Date().toLocaleString(),
        dashboardUrl:  `${employerDashboard}/employees`,
      });

    case 'employee_kyc_approved':
    case 'kyc_update':
      return React.createElement(EmployeeKYCApprovedEmail, {
        companyName,
        employeeName:         (m.employee_name         as string) ?? 'Employee',
        employeeCode:         m.employee_code          as string | undefined,
        approvedAt:           (m.approved_at           as string) ?? new Date().toLocaleString(),
        maxAdvancePercentage: m.max_advance_percentage as number | undefined,
        currency:             (m.currency              as string) ?? 'KES',
        dashboardUrl:         `${employerDashboard}/employees`,
      });

    case 'employee_kyc_rejected':
      return React.createElement(EmployeeKYCRejectedEmail, {
        companyName,
        employeeName: (m.employee_name as string) ?? 'Employee',
        employeeCode: m.employee_code  as string | undefined,
        rejectedAt:   (m.rejected_at   as string) ?? new Date().toLocaleString(),
        reason:       m.reason         as string | undefined,
        canResubmit:  m.can_resubmit   as boolean | undefined,
        dashboardUrl: `${employerDashboard}/employees`,
      });

    case 'risk_profile_updated':
      return React.createElement(RiskProfileUpdatedEmail, {
        companyName,
        contactPerson:  m.contact_person  as string | undefined,
        previousScore:  m.previous_score  as number | undefined,
        newScore:       (m.new_score       as number) ?? 3.0,
        previousRating: m.previous_rating as 'A' | 'B' | 'C' | 'D' | undefined,
        newRating:      (m.new_rating      as 'A' | 'B' | 'C' | 'D') ?? 'B',
        applicationFee: m.application_fee as number | undefined,
        updatedAt:      (m.updated_at      as string) ?? new Date().toLocaleString(),
        dashboardUrl:   `${employerDashboard}/risk-insights`,
      });

    case 'status_change':
      return React.createElement(EmployerStatusChangeEmail, {
        companyName,
        contactPerson:  m.contact_person  as string | undefined,
        previousStatus: m.previous_status as 'approved' | 'suspended' | 'rejected' | 'pending' | 'under_review' | undefined,
        newStatus:      (m.new_status      as 'approved' | 'suspended' | 'rejected' | 'pending' | 'under_review') ?? 'approved',
        reason:         m.reason          as string | undefined,
        effectiveAt:    (m.effective_at   as string) ?? new Date().toLocaleString(),
        dashboardUrl:   employerDashboard,
      });

    case 'bank_change_outcome':
      return React.createElement(BankDetailsChangeOutcomeEmail, {
        companyName,
        contactPerson:          m.contact_person            as string | undefined,
        outcome:                (m.outcome                   as 'approved' | 'rejected') ?? 'approved',
        requestedBankName:      (m.requested_bank_name       as string) ?? 'Unknown Bank',
        requestedAccountNumber: (m.requested_account_number  as string) ?? '—',
        currentBankName:        m.current_bank_name          as string | undefined,
        reason:                 m.reason                     as string | undefined,
        effectiveAt:            (m.effective_at               as string) ?? new Date().toLocaleString(),
        dashboardUrl:           `${employerDashboard}/settings`,
      });

    case 'risk_review_completed':
      return React.createElement(RiskReviewCompletedEmail, {
        companyName,
        contactPerson:     m.contact_person    as string | undefined,
        outcome:           (m.outcome           as 'improved' | 'unchanged' | 'declined') ?? 'unchanged',
        newScore:          (m.new_score         as number) ?? 3.0,
        newRating:         (m.new_rating        as 'A' | 'B' | 'C' | 'D') ?? 'B',
        newApplicationFee: m.new_application_fee as number | undefined,
        reviewNotes:       m.review_notes       as string | undefined,
        completedAt:       (m.completed_at      as string) ?? new Date().toLocaleString(),
        dashboardUrl:      `${employerDashboard}/risk-insights`,
      });

    case 'wallet_topup_approved':
      return React.createElement(WalletTopUpApprovedEmail, {
        companyName,
        contactPerson:  m.contact_person  as string | undefined,
        approvedAmount: (m.approved_amount as number) ?? 0,
        currency:       (m.currency        as string) ?? 'KES',
        newBalance:     m.new_balance      as number | undefined,
        reference:      m.reference        as string | undefined,
        approvedAt:     (m.approved_at     as string) ?? new Date().toLocaleString(),
        dashboardUrl:   `${employerDashboard}/wallet`,
      });

    case 'advance':
      return React.createElement(AdvanceRequestReceivedEmail, {
        companyName,
        contactPerson:      m.contact_person       as string | undefined,
        employeeName:       (m.employee_name        as string) ?? 'An employee',
        employeeCode:       m.employee_code         as string | undefined,
        requestedAmount:    (m.requested_amount      as number) ?? 0,
        currency:           (m.currency              as string) ?? 'KES',
        disbursementMethod: m.disbursement_method   as string | undefined,
        requestedAt:        (m.requested_at          as string) ?? new Date().toLocaleString(),
        advanceId:          m.advance_id            as string | undefined,
        dashboardUrl:       `${employerDashboard}/advances`,
      });

    case 'wallet_funded':
    case 'repayment':
      return React.createElement(WalletFundedEmail, {
        companyName,
        contactPerson:   m.contact_person   as string | undefined,
        fundedAmount:    (m.funded_amount    as number) ?? 0,
        currency:        (m.currency         as string) ?? 'KES',
        newBalance:      (m.new_balance      as number) ?? 0,
        previousBalance: m.previous_balance  as number | undefined,
        fundingSource:   m.funding_source    as string | undefined,
        reference:       m.reference         as string | undefined,
        fundedAt:        (m.funded_at        as string) ?? new Date().toLocaleString(),
        dashboardUrl:    `${employerDashboard}/wallet`,
      });

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
// Shared push helper
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

// ─────────────────────────────────────────────────────────────────────────────
// notifyAdmins
// ─────────────────────────────────────────────────────────────────────────────
export async function notifyAdmins(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
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

    const { data: globalSettings } = await supabaseAdmin
      .from('global_settings')
      .select('notification_settings')
      .eq('id', 'default')
      .single();

    const ns = globalSettings?.notification_settings || {};

    const emailEnabledByType: Record<AdminNotificationType, boolean> = {
      new_employer:    ns.email_new_employer  !== false,
      employer_kyc:    ns.email_new_employer  !== false,
      flagged_advance: ns.email_fraud_alert   !== false,
      system_alert:    ns.email_daily_summary !== false,
      review_request:  ns.email_large_advance !== false,
      bank_change:     ns.email_fraud_alert   !== false,
    };

    const shouldEmail = emailEnabledByType[params.type] ?? true;

    if (shouldEmail) {
      const isFraudType = params.type === 'flagged_advance' || params.type === 'bank_change';
      let recipients: string[] = [];

      if (isFraudType && ns.fraud_alert_emails) {
        recipients = (ns.fraud_alert_emails as string)
          .split(',')
          .map((e: string) => e.trim())
          .filter(Boolean);
      } else {
        const { data: adminEmails } = await supabaseAdmin
          .from('system_admins')
          .select('email');
        recipients = (adminEmails || [])
          .map((a: { email: string }) => a.email)
          .filter(Boolean);
      }

      const emailElement = buildAdminEmailElement(
        params.type,
        params.title,
        params.message,
        params.metadata
      );

      await Promise.allSettled(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: `[ADMIN ALERT] ${params.title}`,
            react: emailElement,
          }).catch((e) => console.error(`[notifyAdmins] Email failed for ${to}:`, e))
        )
      );
    }

    return { success: true, data };
  } catch (err) {
    console.error('[notifyAdmins] Error:', err);
    return { success: false, error: err };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyEmployer
// ─────────────────────────────────────────────────────────────────────────────
export async function notifyEmployer(params: {
  userId: string;
  type: EmployerNotificationType;
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

    const [{ data: employer }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from('employers')
        .select('notification_preferences, company_name')
        .eq('user_id', params.userId)
        .single(),
      supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', params.userId)
        .single(),
    ]);

    const prefs             = employer?.notification_preferences || {};
    const emailAlerts       = prefs.emailNotifications !== false;
    const pushNotifications = prefs.pushNotifications  === true;

    if (emailAlerts && profile?.email) {
      const emailElement = buildEmployerEmailElement(
        params.type,
        params.title,
        params.message,
        {
          ...params.metadata,
          company_name: (params.metadata?.company_name as string) ?? employer?.company_name ?? undefined,
        },
        { full_name: profile.full_name, email: profile.email }
      );

      await sendEmail({
        to:      profile.email,
        subject: params.title,
        react:   emailElement,
      }).catch((e) => console.error(`[notifyEmployer] Email failed:`, e));
    }

    if (pushNotifications) {
      await sendPushNotifications(params.userId, params.title, params.message, params.metadata);
    }

    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployer] Error:', err);
    return { success: false, error: err };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyEmployee
// TODO: swap with EmployeeNotifications templates once that file is built.
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
    const pushNotifications = prefs.pushNotifications === true; // BUG FIX: was !== true

    if (emailAlerts && profile?.email) {
      await sendEmail({
        to:      profile.email,
        subject: params.title,
        react:   React.createElement(DocumentUploadNotificationEmail, {
          uploaderName: profile.full_name || 'Employee',
          uploaderRole: 'employee',
          documentType: params.type,
          uploadedAt:   new Date().toLocaleString(),
          dashboardUrl: `${APP_URL}/dashboards/employee-dashboard`,
        }),
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

// ─────────────────────────────────────────────────────────────────────────────
// triggerMessageEvent — Supabase Realtime handles delivery
// ─────────────────────────────────────────────────────────────────────────────
export async function triggerMessageEvent() {
  try {
    return { success: true };
  } catch (err) {
    console.error('[triggerMessageEvent] Error:', err);
    return { success: false, error: err };
  }
}