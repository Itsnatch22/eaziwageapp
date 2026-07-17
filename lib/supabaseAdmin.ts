import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Constructed lazily, not at module scope — this file is imported
// transitively by dozens of routes (via lib/server/admin-auth.ts and
// direct imports). An eager createClient() call here throws synchronously
// ("supabaseUrl is required") the instant NEXT_PUBLIC_SUPABASE_URL isn't
// present, which crashed the production build during Next.js's "collect
// page data" step — that phase imports route modules for static analysis
// and doesn't guarantee env vars are populated. Same reasoning as
// lib/sendOtp.ts's getSmsClient().
//
// supabaseAdmin is still exported as a ready-to-use SupabaseClient (not a
// function) so every existing `supabaseAdmin.from(...)` / `.rpc(...)` call
// site keeps working unchanged — the Proxy defers the real construction to
// first actual property access, and binds methods to the real client so
// `this` resolves correctly regardless of how the proxy is invoked.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('supabaseAdmin: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as SupabaseClient;

export function createAdminClient(): SupabaseClient {
  return supabaseAdmin;
}
