/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central notification service for EaziWage.
 *
 * Delivery chain (per notifyEmployee / notifyEmployer call):
 *   1. Write in-app notification row with delivery_status = 'pending'
 *   2. Try web push → on success: status = 'sent'
 *      On 410/404 stale endpoint: delete the subscription row, fall through
 *      On other error: log warning, fall through
 *   3. Try email via Resend → on success: status = 'fallback_email'
 *      On failure: status = 'failed', failure_reason set
 *   4. No throw — in-app row is always the guaranteed fallback
 */

import { createClient } from '@supabase/supabase-js';
import React from 'react';
import webpush from 'web-push';

import { getEnv } from '@/env';
import { sendEmail } from './email-service';

import {
  NewEmployerRegistrationEmail,
  EmployerOnboardingSubmittedEmail,
  NewKYCDocumentEmail,
  BankChangeRequestEmail,
  FraudAlertEmail,
  DocumentUploadNotificationEmail,
  ErrorAlertEmail,
  AdminSystemAlertEmail,
} from './emails/AdminNotifications';

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
} from './emails/EmployerNotifications';

import {
  AdvanceApprovedEmail,
  AdvanceRejectedEmail,
  KYCUpdateEmail,
  RepaymentReminderEmail,
  BalanceUpdateEmail,
  SystemAlertEmail,
} from './emails/EmployeeNotifications';

export type AdminNotificationType =
  | 'new_employer'
  | 'employer_kyc'
  | 'flagged_advance'
  | 'bank_change'
  | 'review_request'
  | 'system_alert';

export type EmployerNotificationType =
  | 'employee_linked'
  | 'employee_kyc_submitted'
  | 'employee_kyc_approved'
  | 'employee_kyc_rejected'
  | 'risk_profile_updated'
  | 'status_change'
  | 'bank_change_outcome'
  | 'risk_review_completed'
  | 'wallet_topup_approved'
  | 'advance_request_received'
  | 'wallet_funded'
  | 'system'
  | 'employee'
  | 'advance'
  | 'kyc_update'
  | 'risk_update';

export type EmployeeNotificationType =
  | 'advance_approval'
  | 'advance_rejected'
  | 'kyc_update'
  | 'repayment_reminder'
  | 'balance_update'
  | 'system_alert';

type NotificationMetadata = Record<string, unknown>;

const env = getEnv();
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

if (env.VAPID_PRIVATE_KEY && env.PUSH_VAPID_CONTACT) {
  try {
    webpush.setVapidDetails(
      env.PUSH_VAPID_CONTACT,
      env.VAPID_PUBLIC_KEY ?? '',
      env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.error('[notifications] Failed to set VAPID details:', e);
  }
}

// ─── Email element builders ───────────────────────────────────────────────────

function buildAdminEmailElement(
  type: AdminNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = metadata as Record<string, any>;
  const adminDashboard = `${APP_URL}/admin`;

  switch (type) {
    case 'new_employer':
      return React.createElement(NewEmployerRegistrationEmail, {
        companyName: m.companyName ?? title,
        contactPerson: m.contactPerson ?? 'Unknown',
        contactEmail: m.contactEmail ?? '',
        contactPhone: m.contactPhone,
        country: m.country ?? 'Kenya',
        industry: m.industry,
        registeredAt: m.registeredAt ?? new Date().toLocaleString(),
        dashboardUrl: `${adminDashboard}/employers`,
      });

    case 'employer_kyc':
      return React.createElement(EmployerOnboardingSubmittedEmail, {
        companyName: m.companyName ?? title,
        contactPerson: m.contactPerson ?? 'Unknown',
        contactEmail: m.contactEmail ?? '',
        country: m.country ?? 'Kenya',
        industry: m.industry,
        registrationNumber: m.registrationNumber,
        payrollCycle: m.payrollCycle,
        submittedAt: m.submittedAt ?? new Date().toLocaleString(),
        onboardingId: m.onboardingId,
        dashboardUrl: `${adminDashboard}/employers`,
      });

    case 'flagged_advance':
      return React.createElement(FraudAlertEmail, {
        employeeName: m.employeeName ?? 'Unknown',
        employeeEmail: m.employeeEmail,
        employeeCode: m.employeeCode,
        companyName: m.companyName ?? 'Unknown',
        advanceAmount: m.advanceAmount ?? 0,
        currency: m.currency ?? 'KES',
        flagType: m.flagType ?? 'unknown',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        severity: (m.severity as any) ?? 'high',
        description: message,
        flags: m.flags as string[] | undefined,
        triggeredAt: m.triggeredAt ?? new Date().toLocaleString(),
        advanceId: m.advanceId,
        dashboardUrl: `${adminDashboard}/fraud`,
      });

    case 'bank_change':
      return React.createElement(BankChangeRequestEmail, {
        companyName: m.companyName ?? title,
        contactPerson: m.contactPerson,
        contactEmail: m.contactEmail,
        currentBankName: m.currentBankName,
        currentAccountNumber: m.currentAccountNumber,
        requestedBankName: m.requestedBankName ?? 'Unknown',
        requestedAccountNumber: m.requestedAccountNumber ?? '—',
        reason: m.reason,
        requestedAt: m.requestedAt ?? new Date().toLocaleString(),
        requestId: m.requestId,
        dashboardUrl: `${adminDashboard}/review-requests`,
      });

    case 'review_request':
      return React.createElement(NewKYCDocumentEmail, {
        employeeName: m.employeeName ?? 'Unknown',
        employeeEmail: m.employeeEmail,
        companyName: m.companyName,
        documentType: m.documentType ?? 'document',
        documentNumber: m.documentNumber,
        submittedAt: m.submittedAt ?? new Date().toLocaleString(),
        totalDocuments: m.totalDocuments,
        allDocsSubmitted: m.allDocsSubmitted,
        dashboardUrl: `${adminDashboard}/kyc`,
      });

    case 'system_alert':
      if (m.error_log_id) {
        return React.createElement(ErrorAlertEmail, {
          role: m.role === 'employer' ? 'employer' : 'employee',
          url: m.url ?? null,
          message: m.message ?? null,
          digest: m.digest ?? null,
          errorLogId: String(m.error_log_id),
          severity: m.severity === 'critical' ? 'critical' : m.severity === 'high' ? 'high' : 'low',
          logsUrl: `${adminDashboard}/logs`,
        });
      }
      return React.createElement(AdminSystemAlertEmail, {
        title,
        message,
        metadata: metadata as Record<string, unknown>,
        dashboardUrl: adminDashboard,
      });

    default:
      return React.createElement(AdminSystemAlertEmail, {
        title,
        message,
        metadata: metadata as Record<string, unknown>,
        dashboardUrl: adminDashboard,
      });
  }
}

function buildEmployerEmailElement(
  type: EmployerNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = metadata as Record<string, any>;
  const employerDashboard = `${APP_URL}/dashboards/employer-dashboard`;
  const companyName = m.companyName ?? 'Your Company';

  switch (type) {
    case 'employee_linked':
      return React.createElement(NewEmployeeLinkedEmail, {
        companyName,
        employeeName: m.employeeName ?? 'New Employee',
        employeeCode: m.employeeCode,
        employeeEmail: m.employeeEmail,
        department: m.department,
        jobTitle: m.jobTitle,
        linkedAt: m.linkedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/employees`,
      });

    case 'employee_kyc_submitted':
      return React.createElement(EmployeeKYCSubmittedEmail, {
        companyName,
        employeeName: m.employeeName ?? 'Employee',
        employeeCode: m.employeeCode,
        documentTypes: m.documentTypes ?? ['Identity Document'],
        submittedAt: m.submittedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/employees`,
      });

    case 'employee_kyc_approved':
      return React.createElement(EmployeeKYCApprovedEmail, {
        companyName,
        employeeName: m.employeeName ?? 'Employee',
        employeeCode: m.employeeCode,
        approvedAt: m.approvedAt ?? new Date().toLocaleString(),
        maxAdvancePercentage: m.maxAdvancePercentage ?? 50,
        currency: m.currency ?? 'KES',
        dashboardUrl: `${employerDashboard}/employees`,
      });

    case 'employee_kyc_rejected':
      return React.createElement(EmployeeKYCRejectedEmail, {
        companyName,
        employeeName: m.employeeName ?? 'Employee',
        employeeCode: m.employeeCode,
        rejectedAt: m.rejectedAt ?? new Date().toLocaleString(),
        reason: m.reason,
        canResubmit: m.canResubmit !== false,
        dashboardUrl: `${employerDashboard}/employees`,
      });

    case 'risk_profile_updated':
      return React.createElement(RiskProfileUpdatedEmail, {
        companyName,
        contactPerson: m.contactPerson,
        previousScore: m.previousScore,
        newScore: m.newScore ?? 3.5,
        previousRating: m.previousRating,
        newRating: m.newRating ?? 'B',
        applicationFee: m.applicationFee,
        updatedAt: m.updatedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/risk-insights`,
      });

    case 'status_change':
      return React.createElement(EmployerStatusChangeEmail, {
        companyName,
        contactPerson: m.contactPerson,
        previousStatus: m.previousStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newStatus: (m.newStatus as any) ?? 'pending',
        reason: m.reason ?? message,
        effectiveAt: m.effectiveAt ?? new Date().toLocaleString(),
        dashboardUrl: employerDashboard,
      });

    case 'bank_change_outcome':
      return React.createElement(BankDetailsChangeOutcomeEmail, {
        companyName,
        contactPerson: m.contactPerson,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outcome: (m.outcome as any) ?? 'approved',
        requestedBankName: m.requestedBankName ?? 'New Bank',
        requestedAccountNumber: m.requestedAccountNumber ?? '••••••••',
        currentBankName: m.currentBankName,
        reason: m.reason,
        effectiveAt: m.effectiveAt,
        dashboardUrl: `${employerDashboard}/settings`,
      });

    case 'risk_review_completed':
      return React.createElement(RiskReviewCompletedEmail, {
        companyName,
        contactPerson: m.contactPerson,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outcome: (m.outcome as any) ?? 'unchanged',
        newScore: m.newScore ?? 3.5,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newRating: (m.newRating as any) ?? 'B',
        newApplicationFee: m.newApplicationFee,
        reviewNotes: m.reviewNotes,
        completedAt: m.completedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/risk-insights`,
      });

    case 'wallet_topup_approved':
      return React.createElement(WalletTopUpApprovedEmail, {
        companyName,
        contactPerson: m.contactPerson,
        approvedAmount: m.approvedAmount ?? 0,
        currency: m.currency ?? 'KES',
        newBalance: m.newBalance,
        reference: m.reference,
        approvedAt: m.approvedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/wallet`,
      });

    case 'advance_request_received':
      return React.createElement(AdvanceRequestReceivedEmail, {
        companyName,
        contactPerson: m.contactPerson,
        employeeName: m.employeeName ?? 'Employee',
        employeeCode: m.employeeCode,
        requestedAmount: m.requestedAmount ?? 0,
        currency: m.currency ?? 'KES',
        disbursementMethod: m.disbursementMethod ?? 'M-PESA',
        requestedAt: m.requestedAt ?? new Date().toLocaleString(),
        advanceId: m.advanceId,
        dashboardUrl: `${employerDashboard}/advances`,
      });

    case 'wallet_funded':
      return React.createElement(WalletFundedEmail, {
        companyName,
        contactPerson: m.contactPerson,
        fundedAmount: m.fundedAmount ?? 0,
        currency: m.currency ?? 'KES',
        newBalance: m.newBalance ?? 0,
        previousBalance: m.previousBalance,
        fundingSource: m.fundingSource,
        reference: m.reference,
        fundedAt: m.fundedAt ?? new Date().toLocaleString(),
        dashboardUrl: `${employerDashboard}/wallet`,
      });

    case 'system':
    case 'risk_update':
    default:
      return React.createElement(EmployerStatusChangeEmail, {
        companyName,
        newStatus: 'pending',
        reason: message,
        effectiveAt: new Date().toLocaleString(),
        dashboardUrl: employerDashboard,
      });
  }
}

function buildEmployeeEmailElement(
  type: EmployeeNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = metadata as Record<string, any>;
  const employeeDashboard = `${APP_URL}/dashboards/employee-dashboard`;

  switch (type) {
    case 'advance_approval':
      return React.createElement(AdvanceApprovedEmail, {
        employeeName: m.employeeName ?? 'Employee',
        advanceAmount: m.advanceAmount ?? 0,
        currency: m.currency ?? 'KES',
        approvedAt: m.approvedAt ?? new Date().toLocaleString(),
        repaymentDate: m.repaymentDate,
        interestRate: m.interestRate,
        advanceId: m.advanceId,
        dashboardUrl: employeeDashboard,
      });

    case 'advance_rejected':
      return React.createElement(AdvanceRejectedEmail, {
        employeeName: m.employeeName ?? 'Employee',
        requestedAmount: m.requestedAmount ?? 0,
        currency: m.currency ?? 'KES',
        rejectedAt: m.rejectedAt ?? new Date().toLocaleString(),
        reason: m.reason,
        advanceId: m.advanceId,
        dashboardUrl: employeeDashboard,
      });

    case 'kyc_update':
      return React.createElement(KYCUpdateEmail, {
        employeeName: m.employeeName ?? 'Employee',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (m.status as any) ?? 'approved',
        updatedAt: m.updatedAt ?? new Date().toLocaleString(),
        reason: m.reason,
        dashboardUrl: employeeDashboard,
      });

    case 'repayment_reminder':
      return React.createElement(RepaymentReminderEmail, {
        employeeName: m.employeeName ?? 'Employee',
        outstandingAmount: m.outstandingAmount ?? 0,
        currency: m.currency ?? 'KES',
        dueDate: m.dueDate,
        advanceId: m.advanceId,
        dashboardUrl: employeeDashboard,
      });

    case 'balance_update':
      return React.createElement(BalanceUpdateEmail, {
        employeeName: m.employeeName ?? 'Employee',
        newBalance: m.newBalance ?? 0,
        currency: m.currency ?? 'KES',
        changeAmount: m.changeAmount,
        changeType: m.changeType,
        updatedAt: m.updatedAt ?? new Date().toLocaleString(),
        dashboardUrl: employeeDashboard,
      });

    case 'system_alert':
    default:
      return React.createElement(SystemAlertEmail, {
        employeeName: m.employeeName ?? 'Employee',
        title,
        message,
        dashboardUrl: employeeDashboard,
      });
  }
}

// ─── Core fallback chain ──────────────────────────────────────────────────────

async function deliverWithFallback(params: {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  emailElement: React.ReactElement | null;
  userEmail: string | null;
  metadata?: NotificationMetadata;
}): Promise<'push' | 'email' | 'failed'> {
  const { notificationId, userId, title, body, emailElement, userEmail, metadata } = params;

  // Step 2: Try each active push subscription
  const { data: subs } = await supabaseAdmin
    .from('system_push_subscriptions')
    .select('endpoint, subscription_payload')
    .eq('user_id', userId)
    .eq('active', true);

  if (subs?.length) {
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sub.subscription_payload as any,
          JSON.stringify({ title, body, data: metadata })
        );
        await supabaseAdmin
          .from('notifications')
          .update({
            delivery_status: 'sent',
            delivery_channel: 'push',
            delivered_at: new Date().toISOString(),
          })
          .eq('id', notificationId);
        return 'push';
      } catch (pushErr: unknown) {
        const statusCode = (pushErr as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Stale endpoint — delete it so it doesn't accumulate
          await supabaseAdmin
            .from('system_push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        } else {
          console.warn(`[push] Non-fatal failure for user ${userId}:`, pushErr);
        }
        // Fall through to next subscription or email
      }
    }
  }

  // Step 3: Email fallback
  if (emailElement && userEmail) {
    try {
      await sendEmail({ to: userEmail, subject: title, react: emailElement });
      await supabaseAdmin
        .from('notifications')
        .update({
          delivery_status: 'fallback_email',
          delivery_channel: 'email',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', notificationId);
      return 'email';
    } catch (emailErr: unknown) {
      const reason = emailErr instanceof Error ? emailErr.message : String(emailErr);
      await supabaseAdmin
        .from('notifications')
        .update({ delivery_status: 'failed', failure_reason: `Email: ${reason}` })
        .eq('id', notificationId);
      console.error(`[notify] Email fallback failed for notification ${notificationId}:`, emailErr);
      return 'failed';
    }
  }

  // Step 4: Both channels unavailable or failed
  const reason = !userEmail
    ? 'No email configured and no active push subscription'
    : 'Push delivery failed and email was not available';
  await supabaseAdmin
    .from('notifications')
    .update({ delivery_status: 'failed', failure_reason: reason })
    .eq('id', notificationId);
  return 'failed';
}

// ─── Public notification functions ───────────────────────────────────────────

export async function notifyAdmin(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  try {
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata,
        created_at: new Date().toISOString(),
      });

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
      system_alert:    ns.email_fraud_alert   !== false,
      review_request:  ns.email_large_advance !== false,
      bank_change:     ns.email_fraud_alert   !== false,
    };

    if (emailEnabledByType[params.type]) {
      const emailElement = buildAdminEmailElement(
        params.type,
        params.title,
        params.message,
        params.metadata ?? {}
      );
      await sendEmail({
        to: (ns.fraud_alert_emails as string) || env.ADMIN_NOTIFICATION_EMAIL || 'support@eaziwage.com',
        subject: `[Admin] ${params.title}`,
        react: emailElement,
      });
    }

    return { success: true };
  } catch (err) {
    console.error('[notifyAdmin] Error:', err);
    return { success: false, error: err };
  }
}

export async function notifyEmployer(params: {
  userId: string;
  type: EmployerNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  try {
    // Step 1: Write in-app row first — guaranteed fallback even if push/email fail
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata,
        read: false,
        delivery_status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, notification_preferences')
      .eq('id', params.userId)
      .single();

    const prefs = (profile?.notification_preferences as Record<string, boolean> | null) ?? {};
    const shouldSendEmail = prefs.emailAlerts !== false;

    const emailElement = shouldSendEmail && profile?.email
      ? buildEmployerEmailElement(params.type, params.title, params.message, params.metadata ?? {})
      : null;

    await deliverWithFallback({
      notificationId: data.id,
      userId: params.userId,
      title: params.title,
      body: params.message,
      emailElement,
      userEmail: profile?.email ?? null,
      metadata: params.metadata,
    });

    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployer] Error:', err);
    return { success: false, error: err };
  }
}

export async function notifyEmployee(params: {
  userId: string;
  type: EmployeeNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  try {
    // Step 1: Write in-app row first — guaranteed fallback even if push/email fail
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata,
        read: false,
        delivery_status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, notification_preferences')
      .eq('id', params.userId)
      .single();

    const prefs = (profile?.notification_preferences as Record<string, boolean> | null) ?? {};
    const shouldSendEmail = prefs.emailAlerts !== false;

    const emailElement = shouldSendEmail && profile?.email
      ? buildEmployeeEmailElement(params.type, params.title, params.message, params.metadata ?? {})
      : null;

    await deliverWithFallback({
      notificationId: data.id,
      userId: params.userId,
      title: params.title,
      body: params.message,
      emailElement,
      userEmail: profile?.email ?? null,
      metadata: params.metadata,
    });

    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployee] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Re-attempt delivery for a previously failed notification row.
 * Resets status to 'pending', re-runs the full fallback chain.
 */
export async function redeliverNotification(
  notificationId: string
): Promise<{ success: boolean; channel: 'push' | 'email' | 'failed' | 'error' }> {
  try {
    const { data: notif, error } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id, type, title, message, metadata')
      .eq('id', notificationId)
      .single();

    if (error || !notif) return { success: false, channel: 'error' };

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, role, notification_preferences')
      .eq('id', notif.user_id)
      .single();

    const prefs = (profile?.notification_preferences as Record<string, boolean> | null) ?? {};
    const shouldSendEmail = prefs.emailAlerts !== false;

    let emailElement: React.ReactElement | null = null;
    if (shouldSendEmail && profile?.email) {
      const role = profile?.role as string | undefined;
      const meta = (notif.metadata ?? {}) as NotificationMetadata;
      if (role === 'employer') {
        emailElement = buildEmployerEmailElement(
          notif.type as EmployerNotificationType,
          notif.title,
          notif.message,
          meta
        );
      } else {
        emailElement = buildEmployeeEmailElement(
          notif.type as EmployeeNotificationType,
          notif.title,
          notif.message,
          meta
        );
      }
    }

    // Reset before re-attempting so delivered_at / failure_reason are cleared
    await supabaseAdmin
      .from('notifications')
      .update({ delivery_status: 'pending', failure_reason: null, delivered_at: null })
      .eq('id', notificationId);

    const channel = await deliverWithFallback({
      notificationId,
      userId: notif.user_id,
      title: notif.title,
      body: notif.message,
      emailElement,
      userEmail: profile?.email ?? null,
      metadata: notif.metadata as NotificationMetadata,
    });

    return { success: channel !== 'failed', channel };
  } catch (err) {
    console.error('[redeliverNotification] Error:', err);
    return { success: false, channel: 'error' };
  }
}

export async function triggerNotification(params: {
  target: 'admin' | 'employer' | 'employee';
  userId?: string;
  type: AdminNotificationType | EmployerNotificationType | EmployeeNotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  if (params.target === 'admin') {
    return notifyAdmin({ type: params.type as AdminNotificationType, title: params.title, message: params.message, metadata: params.metadata });
  } else if (params.target === 'employer' && params.userId) {
    return notifyEmployer({ userId: params.userId, type: params.type as EmployerNotificationType, title: params.title, message: params.message, metadata: params.metadata });
  } else if (params.target === 'employee' && params.userId) {
    return notifyEmployee({ userId: params.userId, type: params.type as EmployeeNotificationType, title: params.title, message: params.message, metadata: params.metadata });
  }
  throw new Error('Invalid notification target');
}

export const notifyAdmins = notifyAdmin;
