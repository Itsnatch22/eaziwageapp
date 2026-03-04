import React from 'react';
import { Resend } from 'resend';
import {
  DocumentApprovedEmail,
  DocumentRejectedEmail,
  DocumentSubmittedEmail,
} from '@/lib/emails/AdminKYCNotification';
import { DocumentType, DocumentStatus, DOCUMENT_TYPE_LABELS } from '@/lib/validations/kyc-validation';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string;
  subject: string;
  react: React.ReactNode;
}

export interface SendKYCNotificationParams {
  recipientEmail: string;
  recipientName: string;
  documentType: DocumentType;
  documentStatus: DocumentStatus;
  documentNumber?: string;
  reviewerNotes?: string;
  dashboardUrl?: string;
}

/**
 * Send email using Resend
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'KYC System <noreply@eaziwage.com>',
      to: options.to,
      subject: options.subject,
      react: options.react,
    });

    if (error) {
      console.error('[sendEmail] Error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[sendEmail] Exception:', error);
    throw error;
  }
}

/**
 * Get document type label for human-readable text
 */
function getDocumentLabel(documentType: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[documentType] || documentType;
}

/**
 * Send KYC document notification based on status
 */
export async function sendKYCNotification(params: SendKYCNotificationParams) {
  const {
    recipientEmail,
    recipientName,
    documentType,
    documentStatus,
    documentNumber,
    reviewerNotes,
    dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com/dashboard',
  } = params;

  const documentLabel = getDocumentLabel(documentType);
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    switch (documentStatus) {
      case 'approved':
        return await sendEmail({
          to: recipientEmail,
          subject: `✅ Your ${documentLabel} has been approved`,
          react: DocumentApprovedEmail({
            employeeName: recipientName,
            documentType: documentLabel,
            approvedDate: currentDate,
            dashboardUrl,
          }),
        });

      case 'rejected':
        return await sendEmail({
          to: recipientEmail,
          subject: `⚠️ Action Required: ${documentLabel} needs revision`,
          react: DocumentRejectedEmail({
            employeeName: recipientName,
            documentType: documentLabel,
            rejectedDate: currentDate,
            rejectionReason: reviewerNotes,
            dashboardUrl,
          }),
        });

      case 'pending':
        return await sendEmail({
          to: recipientEmail,
          subject: `📄 We've received your ${documentLabel}`,
          react: DocumentSubmittedEmail({
            employeeName: recipientName,
            documentType: documentLabel,
            submittedDate: currentDate,
            documentNumber,
            dashboardUrl,
          }),
        });

      default:
        throw new Error(`Unknown document status: ${documentStatus}`);
    }
  } catch (error) {
    console.error('[sendKYCNotification] Error:', error);
    throw error;
  }
}

/**
 * Send bulk KYC notifications
 */
export async function sendBulkKYCNotifications(
  notifications: SendKYCNotificationParams[]
) {
  const results = await Promise.allSettled(
    notifications.map((notification) => sendKYCNotification(notification))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return {
    total: notifications.length,
    successful,
    failed,
    results,
  };
}

/**
 * Log email to database
 */
export async function logEmail(params: {
  recipientId?: string;
  recipientEmail: string;
  subject: string;
  templateName: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  // This would be implemented with your database client
  // For example, using Supabase:
  /*
  const { createAdminClient } = await import('@/utils/supabase/server');
  const supabase = createAdminClient();
  
  const { error } = await supabase.from('email_logs').insert({
    recipient_id: params.recipientId,
    recipient_email: params.recipientEmail,
    subject: params.subject,
    template_name: params.templateName,
    status: params.status,
    provider_message_id: params.providerMessageId,
    error_message: params.errorMessage,
    metadata: params.metadata,
    sent_at: params.status === 'sent' ? new Date().toISOString() : null,
  });

  if (error) {
    console.error('[logEmail] Error:', error);
  }
  */

  console.log('[logEmail]', params);
}

/**
 * Utility to test email templates
 */
export async function sendTestEmail(recipientEmail: string) {
  return await sendEmail({
    to: recipientEmail,
    subject: 'Test Email - KYC Notification System',
    react: DocumentApprovedEmail({
      employeeName: 'Test User',
      documentType: 'National ID',
      approvedDate: new Date().toLocaleDateString(),
      dashboardUrl: 'https://app.eaziwage.com/dashboard',
    }),
  });
}

// Export email templates for direct use if needed
export { DocumentApprovedEmail, DocumentRejectedEmail, DocumentSubmittedEmail };