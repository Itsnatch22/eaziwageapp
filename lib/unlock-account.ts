import type { SupabaseClient } from '@supabase/supabase-js';

export interface UnlockAccountResult {
  success: boolean;
  alreadyUnlocked?: boolean;
  error?: string;
}

type LockRecord = {
  id: string;
  locked_until: string | null;
  failed_login_attempts: number | null;
};

async function fetchLockRecord(
  supabase: SupabaseClient,
  email: string,
  userId?: string,
  isAdmin?: boolean,
): Promise<{ record: LockRecord; isAdmin: boolean } | null> {
  if (userId != null && isAdmin != null) {
    const table = isAdmin ? 'system_admins' : 'profiles';
    const { data } = await supabase
      .from(table)
      .select('id, locked_until, failed_login_attempts')
      .eq('id', userId)
      .maybeSingle<LockRecord>();

    return data ? { record: data, isAdmin } : null;
  }

  const normalizedEmail = email.toLowerCase();

  const { data: adminRecord } = await supabase
    .from('system_admins')
    .select('id, locked_until, failed_login_attempts')
    .eq('email', normalizedEmail)
    .maybeSingle<LockRecord>();

  if (adminRecord) {
    return { record: adminRecord, isAdmin: true };
  }

  const { data: profileRecord } = await supabase
    .from('profiles')
    .select('id, locked_until, failed_login_attempts')
    .eq('email', normalizedEmail)
    .maybeSingle<LockRecord>();

  if (profileRecord) {
    return { record: profileRecord, isAdmin: false };
  }

  return null;
}

function isCurrentlyLocked(record: LockRecord): boolean {
  if (record.locked_until) {
    return new Date(record.locked_until) > new Date();
  }
  return (record.failed_login_attempts ?? 0) >= 5;
}

export async function unlockUserAccount(
  supabase: SupabaseClient,
  email: string,
  userId?: string,
  isAdmin?: boolean,
): Promise<UnlockAccountResult> {
  const lookup = await fetchLockRecord(supabase, email, userId, isAdmin);
  if (!lookup) {
    return { success: false, error: 'Account not found.' };
  }

  const { record, isAdmin: resolvedIsAdmin } = lookup;
  const table = resolvedIsAdmin ? 'system_admins' : 'profiles';

  if (!isCurrentlyLocked(record)) {
    return { success: true, alreadyUnlocked: true };
  }

  const { error } = await supabase
    .from(table)
    .update({ failed_login_attempts: 0, locked_until: null })
    .eq('id', record.id);

  if (error) {
    console.error('[unlock-account] Failed to clear lock:', error);
    return { success: false, error: 'Failed to unlock account. Please try again.' };
  }

  return { success: true };
}
