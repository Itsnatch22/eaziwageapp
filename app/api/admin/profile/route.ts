import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { dbErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';

const AdminProfilePatchSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  avatar_url: z.string().url().max(2000).optional(),
});

// Admins live only in system_admins — there is no matching profiles row for
// them (profiles.role only ever has 'employee'/'employer'). Both
// AvatarUpload and the account tab's Full Name field previously wrote to
// profiles directly, which silently affected zero rows for an admin (no
// error, no persisted change) — this route updates the actual table admins
// are stored in.
export async function PATCH(req: NextRequest) {
  const rateLimitResponse = await checkAdminRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const raw = await req.json().catch(() => null);
  const parsed = AdminProfilePatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: updated, error } = await adminSupabase
    .from('system_admins')
    .update(parsed.data)
    .eq('id', user.id)
    .select('id, full_name, avatar_url')
    .maybeSingle();

  if (error) return dbErrorResponse('admin/profile', error, 'Failed to update profile.');
  if (!updated) return NextResponse.json({ error: 'Admin record not found' }, { status: 404 });

  void adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: user.email,
    target_id: user.id,
    target_type: 'system_admin',
    action: 'admin_profile_updated',
    old_value: null,
    new_value: parsed.data,
  }).then(({ error: auditErr }) => { if (auditErr) console.error('[audit] admin_profile_updated:', auditErr); });

  return NextResponse.json({ success: true, profile: updated });
}
