import { createRouteHandlerClient } from '@/utils/supabase/server';
import { z } from 'zod';

const employeeUpdateSchema = z.object({
  address_line1: z.string().min(5, 'Address too short').optional(),
  city: z.string().min(2).optional(),
  postal_code: z.string().min(4).optional(),
});

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: any = { updated_at: new Date().toISOString() };
  Object.assign(updates, parsed.data);

  const { error } = await supabase
    .from('employees')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });

  if (error) {
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }

  // Return full profile for UI consistency
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      employee:employees(*)
    `)
    .eq('id', user.id)
    .single();

  // Reuse same KYC computation logic as profile route
  const docMap: Record<string, string> = {
    id_front: 'id_document_front',
    address_proof: 'address_proof',
    payslip_1: 'payslip_1',
    employment_contract: 'employment_contract',
    selfie: 'selfie',
  };

  const kycDocuments = Object.entries(docMap).map(([docType, field]) => ({
    document_type: docType,
    status: (profile?.employee as any)?.[field] ? ('submitted' as const) : null,
  }));

  return Response.json({
    profile: {
      ...profile,
      employee: profile?.employee || {},
      kycDocuments,
    },
  });
}
