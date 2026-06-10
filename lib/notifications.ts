import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/env";
import { sendEmail } from "./email-service";
import { DocumentApprovedEmail } from "./emails/AdminKYCNotification";
import React from 'react';

const env = getEnv();
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type AdminNotificationType = 'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert' | 'new_employer' | 'bank_change';
export type EmployerNotificationType = 'advance' | 'system' | 'employee' | 'repayment' | 'kyc_update';
export type EmployeeNotificationType = 'advance_approval' | 'kyc_update' | 'system_alert' | 'repayment_reminder';
type NotificationMetadata = Record<string, unknown>;

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

    // ── Email Notification for Admins ──
    const { data: adminEmails } = await supabaseAdmin
      .from('system_admins')
      .select('email');
    
    if (adminEmails && adminEmails.length > 0) {
      for (const admin of adminEmails) {
        if (admin.email) {
          await sendEmail({
            to: admin.email,
            subject: `[ADMIN ALERT] ${params.title}`,
            react: React.createElement(DocumentApprovedEmail, {
              employeeName: 'Admin',
              documentType: params.type.replace('_', ' '),
              approvedDate: new Date().toLocaleDateString(),
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin`,
            })
          }).catch(e => console.error(`[notifyAdmins] Email failed for ${admin.email}:`, e));
        }
      }
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[notifyAdmins] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Send a notification to a specific employer (User with employer role)
 */
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

    // Supabase Realtime will deliver notifications via postgres_changes; no pusher trigger needed.

    // ── Email Notification ──
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', params.userId)
      .single();

    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: params.title,
        react: React.createElement(DocumentApprovedEmail, {
          employeeName: profile.full_name || 'Employer',
          documentType: params.type === 'advance' ? 'New Advance Request' : 'System Update',
          approvedDate: new Date().toLocaleDateString(),
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboards/employer-dashboard`,
        })
      }).catch(e => console.error(`[notifyEmployer] Email failed:`, e));
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployer] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Send a notification to a specific employee (User with employee role)
 */
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

    // Supabase Realtime will deliver notifications via postgres_changes; no pusher trigger needed.

    // ── Email Notification ──
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', params.userId)
      .single();

    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: params.title,
        react: React.createElement(DocumentApprovedEmail, {
          employeeName: profile.full_name || 'Employee',
          documentType: params.type === 'advance_approval' ? 'Advance Request' : 'Profile Update',
          approvedDate: new Date().toLocaleDateString(),
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboards/employee-dashboard`,
        })
      }).catch(e => console.error(`[notifyEmployee] Email failed:`, e));
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployee] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Trigger real-time message event
 */
export async function triggerMessageEvent() {
    try {
        // Supabase Realtime handles message notifications via DB changes; no pusher trigger needed.
        return { success: true };
    } catch (err) {
        console.error('[triggerMessageEvent] Error:', err);
        return { success: false, error: err };
    }
}
