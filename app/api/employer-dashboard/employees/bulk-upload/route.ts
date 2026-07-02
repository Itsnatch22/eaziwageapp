import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabaseAdmin';

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: employer, error: employerError } = await adminSupabase
      .from('employers')
      .select('id, onboarding_id, company_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found or not approved' }, { status: 403 });
    }

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

    const seenEmails = new Set<string>();
    const seenCodes = new Set<string>();

    for (const emp of employees) {
      const email = emp.email.toLowerCase();
      
      if (seenEmails.has(email)) {
        results.failed++;
        results.errors.push({ email, message: 'Duplicate email in this file' });
        continue;
      }
      if (seenCodes.has(emp.employee_code)) {
        results.failed++;
        results.errors.push({ email, message: `Duplicate employee code in this file: ${emp.employee_code}` });
        continue;
      }
      seenEmails.add(email);
      seenCodes.add(emp.employee_code);

      try {
        const { data: existingProfile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        const { data: duplicateCheck } = await adminSupabase
          .from('employee_onboarding')
          .select('id, email_placeholder, employee_code')
          .eq('employer_id', employer.onboarding_id)
          .or(`email_placeholder.eq.${email},employee_code.eq.${emp.employee_code}`)
          .maybeSingle();

        if (duplicateCheck) {
          results.failed++;
          const reason = duplicateCheck.email_placeholder === email 
            ? 'Email already exists for this employer' 
            : `Employee code ${emp.employee_code} is already in use`;
          results.errors.push({ email, message: reason });
          continue;
        }

        const { error: insertError } = await adminSupabase
          .from('employee_onboarding')
          .insert({
            employer_id: employer.onboarding_id,
            user_id: existingProfile?.id || null,
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
      } catch (err: unknown) {
        console.error('[Bulk Upload row error]', err);
        results.failed++;
        results.errors.push({ email: emp.email, message: 'Failed to import this row. Please check the data and try again.' });
      }
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('[Bulk Upload Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
