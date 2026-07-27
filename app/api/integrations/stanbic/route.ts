import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOrganization } from '@/lib/auth';
import { getEnv } from '@/env';
import { randomUUID } from 'crypto';

// This endpoint initiates the Stanbic OAuth flow
// Expected behavior:
// 1. Generate a random state value for CSRF protection
// 2. Store the state in an HTTP-only cookie
// 3. Redirect to Stanbic's OAuth authorization URL
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const organization = await requireOrganization();
    
    if (!organization) {
      return NextResponse.redirect(
        new URL(`/dashboards/employer-dashboard/wallet?error=unauthorized`, origin)
      );
    }

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

    // Set the state cookie (HttpOnly for security, but we need to read it in the callback)
    // Using regular cookie since we need to read it in the callback route
    const cookieStore = await cookies();
    cookieStore.set('stanbic_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes - should be enough for OAuth flow
    });

    // Redirect to Stanbic's authorization page
    return NextResponse.redirect(authorizationUrlWithParams);
  } catch (error) {
    console.error('Stanbic OAuth initiation error:', error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/dashboards/employer-dashboard/wallet?error=initiation_failed`, origin)
    );
  }
}