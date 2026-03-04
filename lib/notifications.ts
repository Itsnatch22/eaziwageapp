import pusherServer from "./pusher-server";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/env";

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

interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
}

/**
 * Send a notification to all admins
 */
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

    // Trigger real-time event
    await pusherServer.trigger('admin-notifications', 'new-notification', data);
    
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

    // Trigger real-time event for specific employer channel
    await pusherServer.trigger(`employer-${params.userId}`, 'new-notification', data);
    
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

    // Trigger real-time event for specific user channel
    await pusherServer.trigger(`user-${params.userId}`, 'new-notification', data);
    
    return { success: true, data };
  } catch (err) {
    console.error('[notifyEmployee] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Trigger real-time message event
 */
export async function triggerMessageEvent(userId: string, message: NotificationPayload) {
    try {
        await pusherServer.trigger(`user-${userId}-messages`, 'new-message', message);
        return { success: true };
    } catch (err) {
        console.error('[triggerMessageEvent] Error:', err);
        return { success: false, error: err };
    }
}
