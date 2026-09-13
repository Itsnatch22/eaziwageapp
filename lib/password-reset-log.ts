import { SupabaseClient } from '@supabase/supabase-js';

export type PasswordResetStage =
  | 'rate_limited'
  | 'recaptcha_failed'
  | 'profile_not_found'
  | 'token_created'
  | 'email_sent'
  | 'email_failed'
  | 'token_invalid'
  | 'token_expired'
  | 'token_used'
  | 'password_updated'
  | 'confirmation_email_sent'
  | 'confirmation_email_failed'
  | 'error';

interface LogParams {
  supabase: SupabaseClient;
  stage: PasswordResetStage;
  email: string;
  ip?: string;
  userId?: string | null;
  detail?: string;
}

/**
 * Best-effort audit log for the password reset flow. Failures to log are
 * swallowed (and console.error'd) so a logging hiccup never blocks the
 * actual reset flow for the user.
 */
export async function logPasswordResetEvent({
  supabase,
  stage,
  email,
  ip,
  userId,
  detail,
}: LogParams): Promise<void> {
  try {
    const { error } = await supabase.from('password_reset_events').insert({
      user_id: userId ?? null,
      email,
      ip: ip ?? null,
      stage,
      detail: detail ?? null,
    });

    if (error) {
      console.error('[password-reset-log] Failed to write audit event:', {
        stage,
        error: error.message,
      });
    }
  } catch (err) {
    console.error('[password-reset-log] Unexpected error writing audit event:', {
      stage,
      err,
    });
  }
}
