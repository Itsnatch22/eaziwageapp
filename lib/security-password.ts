import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sendPasswordChangedEmail } from '@/lib/security-alerts';

export async function verifyCurrentPassword(email: string, currentPassword: string): Promise<boolean> {
  const env = getEnv();
  const statelessClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await statelessClient.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  return !error;
}

export async function finishPasswordChange(
  supabase: SupabaseClient,
  user: User,
): Promise<{ otherSessionsRevoked: boolean; auditLogged: boolean }> {
  let otherSessionsRevoked = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    otherSessionsRevoked = !error;
    if (error) {
      console.error('[password-change] Could not revoke other sessions:', { userId: user.id, error });
    }
  } catch (error) {
    console.error('[password-change] Could not revoke other sessions:', { userId: user.id, error });
  }

  let auditLogged = false;
  try {
    const { error } = await createAdminClient().from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email ?? null,
      target_id: user.id,
      target_type: 'user',
      action: 'password_changed',
      metadata: { changed_at: new Date().toISOString() },
    });
    auditLogged = !error;
    if (error) {
      console.error('[password-change] Audit insert failed:', { userId: user.id, error });
    }
  } catch (error) {
    console.error('[password-change] Audit insert failed:', { userId: user.id, error });
  }

  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : user.email ?? 'there';
  if (user.email) {
    void sendPasswordChangedEmail(user.email, fullName).catch((error: unknown) => {
      console.error('[password-change] Notification failed:', { userId: user.id, error });
    });
  }

  return {
    otherSessionsRevoked,
    auditLogged,
  };
}
