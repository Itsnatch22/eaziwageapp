async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing env vars NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const target = process.argv[2] || '7e44b730-e7e1-4971-88c0-da37cd35930f';
  console.log('Testing upsert for onboarding/user id:', target);

  const { data: onboarding } = await admin
    .from('employee_onboarding')
    .select('*')
    .or(`id.eq.${target},user_id.eq.${target}`)
    .maybeSingle();

  const userId = onboarding?.user_id || target;

  if (!onboarding) {
    console.warn('No onboarding record found; will try updating existing employee only');
  }

  let resolvedEmployerId = null;
  if (onboarding?.employer_id) {
    const { data: byId } = await admin.from('employers').select('id').eq('id', onboarding.employer_id).maybeSingle();
    if (byId?.id) resolvedEmployerId = byId.id;
    else {
      const { data: byRef } = await admin.from('employers').select('id').eq('employer_id', onboarding.employer_id).maybeSingle();
      if (byRef?.id) resolvedEmployerId = byRef.id;
    }
  }

  const payload = {
    user_id: userId,
    status: 'Active',
    kyc_status: 'approved',
    updated_at: new Date().toISOString(),
  };

  if (onboarding) {
    if (!resolvedEmployerId) {
      console.error('No employer mapping found for onboarding.employer_id:', onboarding.employer_id);
      process.exit(3);
    }
    payload.employer_id = resolvedEmployerId;
    payload.employee_code = onboarding.employee_code;
    payload.full_name = onboarding.full_name || 'Test User';
    payload.name = onboarding.full_name || 'Test User';
    payload.email = onboarding.email || null;
    payload.phone = onboarding.phone || null;
    payload.job_title = onboarding.job_title || null;
    payload.department = onboarding.department || null;
    payload.monthly_salary = onboarding.monthly_salary || null;
  } else {
    const { data: existing } = await admin.from('employees').select('id').eq('user_id', userId).maybeSingle();
    if (!existing) {
      console.error('No onboarding and no existing employee for user:', userId);
      process.exit(4);
    }
  }

  console.log('Attempting upsert with payload:', payload);
  const { data, error } = await admin.from('employees').upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.error('Upsert error:', error);
    process.exit(5);
  }

  console.log('Upsert succeeded:', data);
  process.exit(0);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
