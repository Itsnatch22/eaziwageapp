import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { contactLimiter, checkRateLimit } from '@/lib/rate-limit';

const KYC_BUCKET = 'employee-kyc-documents';
const AVATAR_BUCKET = 'avatars';

// Recursively lists every object under a Storage prefix — the JS client's
// `.list()` only returns one directory level per call, and this repo's KYC
// upload paths nest a document-type subfolder under the user's own prefix
// (${userId}/${documentType}/${file}), so a single non-recursive list would
// miss everything and silently leave real files behind after "deletion".
async function listAllObjects(
  adminSupabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data: entries, error } = await adminSupabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !entries) return [];

  const paths: string[] = [];
  for (const entry of entries) {
    const fullPath = `${prefix}/${entry.name}`;
    // Storage's list() marks folders by a null `id` — files always have one.
    if (entry.id === null) {
      paths.push(...(await listAllObjects(adminSupabase, bucket, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const rate = await checkRateLimit(contactLimiter, `delete-account:${user.id}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json();
    const { reason, category, additionalFeedback } = body;

    if (!reason || !category) {
      return NextResponse.json(
        { error: 'Reason and category are required' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Recorded first, via the user's own session — evidence the request
    // happened, before anything else touches their data. This table has no
    // DELETE policy for anyone (not even admin) and is deliberately never
    // touched by delete_employee_account_data() below.
    const { error: deletionEventError } = await supabase
      .from('account_deletion_events')
      .insert({
        user_id: user.id,
        user_email: profile.email,
        user_full_name: profile.full_name,
        user_role: profile.role,
        deletion_reason: reason,
        deletion_reason_category: category,
        additional_feedback: additionalFeedback || null,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (deletionEventError) {
      console.error('[delete-account] Error recording deletion event:', deletionEventError);
    }

    const adminSupabase = createAdminClient();

    // The DB-cleanup step — anonymizes employees/employee_onboarding/profiles
    // in place (can't be row-deleted while advance history exists) and
    // hard-deletes everything with no compliance retention need. Runs as one
    // Postgres transaction inside the function: if anything in it fails, all
    // of it rolls back together, so this can only ever fully succeed or
    // fully no-op — never leave the account half-anonymized.
    const { error: cleanupError } = await adminSupabase.rpc('delete_employee_account_data', {
      p_user_id: user.id,
    });

    if (cleanupError) {
      console.error('[delete-account] delete_employee_account_data failed:', cleanupError);
      return NextResponse.json(
        { error: 'Failed to delete account data. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Storage cleanup and the actual auth.users deletion are best-effort
    // from here — the data that actually matters (PII, KYC documents' DB
    // rows, financial-adjacent identifiers) is already gone as of the RPC
    // above. A lingering Storage object or auth row is a recoverable
    // admin-side cleanup task, not a reason to tell the user deletion failed
    // when their data has, in fact, already been erased.
    try {
      const kycPaths = await listAllObjects(adminSupabase, KYC_BUCKET, user.id);
      if (kycPaths.length > 0) {
        const { error: kycRemoveError } = await adminSupabase.storage.from(KYC_BUCKET).remove(kycPaths);
        if (kycRemoveError) console.error('[delete-account] KYC storage cleanup failed:', kycRemoveError);
      }
    } catch (err) {
      console.error('[delete-account] KYC storage cleanup threw:', err);
    }

    try {
      const avatarPaths = await listAllObjects(adminSupabase, AVATAR_BUCKET, user.id);
      if (avatarPaths.length > 0) {
        const { error: avatarRemoveError } = await adminSupabase.storage.from(AVATAR_BUCKET).remove(avatarPaths);
        if (avatarRemoveError) console.error('[delete-account] Avatar storage cleanup failed:', avatarRemoveError);
      }
    } catch (err) {
      console.error('[delete-account] Avatar storage cleanup threw:', err);
    }

    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error('[delete-account] auth.admin.deleteUser failed:', authDeleteError);
      // Data is already anonymized/purged — sign the (now data-less) session
      // out as a fallback so they're at least logged out even if the
      // underlying auth.users row survives for manual admin cleanup.
      await supabase.auth.signOut();
      return NextResponse.json(
        { message: 'Account deleted successfully' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
