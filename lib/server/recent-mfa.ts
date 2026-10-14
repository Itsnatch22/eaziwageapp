import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_RECENT_MFA_WINDOW_MS = 10 * 60 * 1000;

type AuthenticationMethod = string | {
  method?: string;
  timestamp?: number;
};

type AssuranceData = {
  currentLevel?: string | null;
  currentAuthenticationMethods?: AuthenticationMethod[] | null;
};

export function hasRecentTotpVerification(
  assurance: AssuranceData,
  now = Date.now(),
  maxAgeMs = DEFAULT_RECENT_MFA_WINDOW_MS,
): boolean {
  if (assurance.currentLevel !== 'aal2') return false;

  return (assurance.currentAuthenticationMethods ?? []).some((method) => {
    if (
      typeof method === 'string'
      || !['totp', 'mfa/totp'].includes(method.method ?? '')
      || typeof method.timestamp !== 'number'
    ) {
      return false;
    }

    const verifiedAt = method.timestamp * 1000;
    return verifiedAt <= now && now - verifiedAt <= maxAgeMs;
  });
}

export async function requireRecentMfa(
  supabase: SupabaseClient,
  userId: string,
  maxAgeMs = DEFAULT_RECENT_MFA_WINDOW_MS,
): Promise<NextResponse | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    console.error('[step-up] Could not read MFA assurance level:', { userId, error });
  }

  if (!data || !hasRecentTotpVerification(data, Date.now(), maxAgeMs)) {
    return NextResponse.json(
      { error: 'Verify your authenticator code to continue.', code: 'STEP_UP_REQUIRED' },
      { status: 403 },
    );
  }

  return null;
}
