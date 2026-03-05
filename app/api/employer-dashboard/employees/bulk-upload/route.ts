import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { z } from 'zod';

const BulkEmployeeSchema = z.object({
  employees: z.array(z.object({
    full_name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    employee_code: z.string().min(1, 'Employee code is required'),
    job_title: z.string().optional(),
    department: z.string().optional(),
    monthly_salary: z.number().nonnegative().optional(),
    phone: z.string().optional(),
  }))
});

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    // 1. Authenticate & Verify Employer
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await adminSupabase
      .from('employer_onboarding')
      .select('id, company_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found or not approved' }, { status: 403 });
    }

    // 2. Parse & Validate Payload
    const body = await req.json();
    const validation = BulkEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid data format', details: validation.error.issues }, { status: 400 });
    }

    const { employees } = validation.data;
    const results = {
      total: employees.length,
      success: 0,
      failed: 0,
      errors: [] as { email: string; message: string }[]
    };

    // 3. Process Batch
    // For each employee in CSV:
    // a. Check if a profile with that email exists
    // b. If exists, check if already linked to this employer in employee_onboarding
    // c. If not linked, create a pending onboarding record
    
    for (const emp of employees) {
      try {
        // Find existing user by email
        const { data: existingProfile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('email', emp.email.toLowerCase())
          .maybeSingle();

        // Check if already has onboarding record for THIS employer
        const { data: existingOnboarding } = await adminSupabase
          .from('employee_onboarding')
          .select('id')
          .eq('employer_id', employer.id)
          .eq(existingProfile ? 'user_id' : 'id', existingProfile ? existingProfile.id : '00000000-0000-0000-0000-000000000000') // Dummy check if no profile
          .maybeSingle();

        if (existingOnboarding) {
          results.failed++;
          results.errors.push({ email: emp.email, message: 'Already on-boarded or pending' });
          continue;
        }

        // Create onboarding placeholder
        const { error: insertError } = await adminSupabase
          .from('employee_onboarding')
          .insert({
            employer_id: employer.id,
            user_id: existingProfile?.id || null, // Link if they exist, otherwise null (invitation needed)
            full_name_placeholder: emp.full_name,
            email_placeholder: emp.email.toLowerCase(),
            employee_code: emp.employee_code,
            job_title: emp.job_title,
            department: emp.department,
            monthly_salary: emp.monthly_salary,
            status: 'pending',
            invitation_sent: false
          });

        if (insertError) throw insertError;
        
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ email: emp.email, message: err.message });
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Bulk Upload Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
