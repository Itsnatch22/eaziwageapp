import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getEnv } from '@/env';
import { randomUUID } from 'crypto';

// This endpoint initiates the Stanbic OAuth flow.
// Admin-only: this is EaziWage's own one-time authorization of its own Stanbic
// account (used for URL whitelisting with Stanbic), NOT a per-employer
// "connect your bank account" flow. Previously scoped to requireOrganization(),
// which meant any employer could trigger this and land on their own wallet page --
// corrected to requireAdmin() so only EaziWage admins can initiate it, and the
// registered redirect_uri stays a single, stable, whitelistable admin URL.
//
// Expected behavior:
// 1. Generate a random state value for CSRF protection
// 2. Store the state in an HTTP-only cookie
// 3. Redirect to Stanbic's OAuth authorization URL
export async function GET(request: Request) {
  try {
    const { origin } = new URL(request.url);

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    // Generate a random state value for CSRF protection
    const state = randomUUID();

    // Get environment configuration
    const env = getEnv();

    // Determine the authorization URL based on environment
    // Stanbic uses the same base URL for token and auth endpoints, replacing /token with /authorize
    const tokenUrl =
      process.env.STANBIC_ENVIRONMENT === 'production'
        ? (env.STANBIC_PRODUCTION_TOKEN_URL ?? env.STANBIC_TOKEN_URL)
        : (env.STANBIC_SANDBOX_TOKEN_URL ?? env.STANBIC_TOKEN_URL);

    if (!tokenUrl) {
      throw new Error('STANBIC_TOKEN_URL not configured');
    }

    // Construct authorization URL by replacing /token with /authorize
    const authorizationUrl = tokenUrl.replace('/token', '/authorize');

    if (!authorizationUrl || authorizationUrl === tokenUrl) {
      throw new Error('STANBIC authorization URL could not be constructed from token URL');
    }

    // Build the authorization URL with required parameters
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id:
        process.env.STANBIC_ENVIRONMENT === 'production'
          ? (env.STANBIC_PRODUCTION_API_KEY ?? env.STANBIC_API_KEY ?? '')
          : (env.STANBIC_SANDBOX_API_KEY ?? env.STANBIC_API_KEY ?? ''),
      redirect_uri: `${origin}/api/integrations/stanbic/callback`,
      scope: 'payments', // Adjust based on what Stanbic expects
      state,
    });

    const authorizationUrlWithParams = `${authorizationUrl}?${authParams.toString()}`;

    // Set the state cookie on the redirect response so browser receives Set-Cookie header
    const response = NextResponse.redirect(authorizationUrlWithParams);
    response.cookies.set('stanbic_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes - should be enough for OAuth flow
    });

    return response;
  } catch (error) {
    console.error('Stanbic OAuth initiation error:', error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/admin/wallet?error=initiation_failed`, origin)
    );
  }
}