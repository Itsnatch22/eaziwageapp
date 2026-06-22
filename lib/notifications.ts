/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central notification service for EaziWage.
 * Handles in-app notifications, email (React Email), and web push.
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
  | 'advance'| 'kyc_update';

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

function buildAdminEmailElement(
  type: AdminNotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): React.ReactElement {
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
    default:
      return React.createElement(DocumentUploadNotificationEmail, {
        uploaderName: 'System',
        uploaderRole: 'employee',
        documentType: 'system',
        uploadedAt: new Date().toLocaleString(),
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
        newStatus: (m.newStatus as any) ?? 'pending',
        reason: m.reason ?? message,
        effectiveAt: m.effectiveAt ?? new Date().toLocaleString(),
        dashboardUrl: employerDashboard,
      });

    case 'bank_change_outcome':
      return React.createElement(BankDetailsChangeOutcomeEmail, {
        companyName,
        contactPerson: m.contactPerson,
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
        outcome: (m.outcome as any) ?? 'unchanged',
        newScore: m.newScore ?? 3.5,
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

async function sendPushNotifications(
  userId: string,
  title: string,
  body: string,
  metadata?: NotificationMetadata
) {
  const { data: subs } = await supabaseAdmin
    .from('system_push_subscriptions')
    .select('subscription_payload')
    .eq('user_id', userId)
    .eq('active', true);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          sub.subscription_payload as any,
          JSON.stringify({ title, body, data: metadata })
        )
        .catch((e) => console.error(`[push] Failed for user ${userId}:`, e))
    )
  );
}

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

    const emailElement = buildAdminEmailElement(
      params.type,
      params.title,
      params.message,
      params.metadata ?? {}
    );
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

if (emailEnabledByType[params.type]) {
  const emailElement = buildAdminEmailElement(
    params.type,
    params.title,
    params.message,
    params.metadata ?? {}
  );

  await sendEmail({
    to: env.ADMIN_NOTIFICATION_EMAIL ?? 'admin@eaziwage.com',
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
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata,
        read: false,
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

    const prefs = profile?.notification_preferences || {};
    const shouldSendEmail = prefs.emailAlerts !== false;

    if (shouldSendEmail && profile?.email) {
      const emailElement = buildEmployerEmailElement(
        params.type,
        params.title,
        params.message,
        params.metadata ?? {}
      );

      await sendEmail({
        to: profile.email,
        subject: params.title,
        react: emailElement,
      }).catch((e) => console.error('[notifyEmployer] Email failed:', e));
    }

    if (prefs.pushNotifications === true) {
      await sendPushNotifications(params.userId, params.title, params.message, params.metadata);
    }

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
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata,
        read: false,
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

    const prefs = profile?.notification_preferences || {};
    const shouldSendEmail = prefs.emailAlerts !== false;

    if (shouldSendEmail && profile?.email) {
      const emailElement = buildEmployeeEmailElement(
        params.type,
        params.title,
        params.message,
        params.metadata ?? {}
      );

      await sendEmail({
        to: profile.email,
        subject: params.title,
        react: emailElement,
      }).catch((e) => console.error('[notifyEmployee] Email failed:', e));
    }

    if (prefs.pushNotifications === true) {
      await sendPushNotifications(params.userId, params.title, params.message, params.metadata);
    }

    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployee] Error:', err);
    return { success: false, error: err };
  }
}

export async function triggerNotification(params: {
  target: 'admin' | 'employer' | 'employee';
  userId?: string;
  type: any;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}) {
  if (params.target === 'admin') {
    return notifyAdmin({ type: params.type, title: params.title, message: params.message, metadata: params.metadata });
  } else if (params.target === 'employer' && params.userId) {
    return notifyEmployer({ userId: params.userId, type: params.type, title: params.title, message: params.message, metadata: params.metadata });
  } else if (params.target === 'employee' && params.userId) {
    return notifyEmployee({ userId: params.userId, type: params.type, title: params.title, message: params.message, metadata: params.metadata });
  }
  throw new Error('Invalid notification target');
}

export const notifyAdmins = notifyAdmin;