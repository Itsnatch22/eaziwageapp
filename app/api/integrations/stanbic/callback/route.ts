import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Redis } from '@upstash/redis';
import { getEnv } from '@/env';
import { requireAdmin } from '@/lib/server/admin-auth';

// This endpoint handles the OAuth callback from Stanbic Bank.
// Admin-only -- see initiation route for why this changed from requireOrganization()
// to requireAdmin(). The token obtained here belongs to EaziWage's own Stanbic
// account, not any individual employer, so it's cached under a single
// environment-scoped key rather than one key per organization.
//
// Expected query parameters: code, state
// We expect a cookie named 'stanbic_oauth_state' to be set during the initiation of the OAuth flow
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('stanbic_oauth_state')?.value;

    // Validate state to prevent CSRF
    if (!state || !stateCookie || state !== stateCookie) {
      return NextResponse.redirect(
        new URL(`/admin/wallet?error=invalid_state`, origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/admin/wallet?error=missing_code`, origin)
      );
    }

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    // Prepare token request
    const env = getEnv();
    const tokenUrlValue =
      process.env.STANBIC_ENVIRONMENT === 'production'
        ? env.STANBIC_PRODUCTION_TOKEN_URL ?? env.STANBIC_TOKEN_URL
        : env.STANBIC_SANDBOX_TOKEN_URL ?? env.STANBIC_TOKEN_URL;

    if (!tokenUrlValue) {
      throw new Error('STANBIC_TOKEN_URL not configured');
    }

    const clientId =
      process.env.STANBIC_ENVIRONMENT === 'production'
        ? env.STANBIC_PRODUCTION_API_KEY ?? env.STANBIC_API_KEY ?? ''
        : env.STANBIC_SANDBOX_API_KEY ?? env.STANBIC_API_KEY ?? '';

    const clientSecret =
      process.env.STANBIC_ENVIRONMENT === 'production'
        ? env.STANBIC_PRODUCTION_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? ''
        : env.STANBIC_SANDBOX_CLIENT_SECRET ?? env.STANBIC_CLIENT_SECRET ?? '';

    if (!clientId || !clientSecret) {
      throw new Error('STANBIC credentials not configured');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/integrations/stanbic/callback`, // Must match the registered redirect URI
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch(tokenUrlValue, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return NextResponse.redirect(
        new URL(`/admin/wallet?error=token_exchange_failed&details=${encodeURIComponent(
          errorText.substring(0, 100)
        )}`, origin)
      );
    }

    const tokenData = await tokenResponse.json();

    // Store the token in Redis -- scoped to EaziWage's own account + environment,
    // NOT per-organization, since this is a single shared corporate connection.
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    const environment = process.env.STANBIC_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    const redisKey = `stanbic:oauth_token:${environment}`;
    const tokenObj = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_in: tokenData.expires_in ?? 3600,
      obtained_at: Date.now(),
      connected_by: user.id,
    };

    await redis.set(redisKey, JSON.stringify(tokenObj), {
      ex: Math.max(60, Math.floor((tokenData.expires_in ?? 3600) - 60)), // expire 60 seconds before expiry
    });

    // Audit trail, consistent with other admin actions in this codebase
    void adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.email,
      target_type: 'stanbic_integration',
      action: 'stanbic_oauth_connected',
      new_value: { environment },
    }).then(({ error }: { error: unknown }) => {
      if (error) console.error('[audit] stanbic_oauth_connected:', error);
    });

    // Remove the state cookie on response
    const response = NextResponse.redirect(
      new URL(`/admin/wallet?success=stanbic_connected`, origin)
    );
    response.cookies.delete('stanbic_oauth_state');
    return response;
  } catch (error) {
    console.error('Stanbic OAuth callback error:', error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/admin/wallet?error=internal_error`, origin)
    );
  }
}