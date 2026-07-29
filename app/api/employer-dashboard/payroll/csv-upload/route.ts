
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { uploadPayrollSchema } from '@/lib/validations/payroll-validation';

export const runtime = 'nodejs';

function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.trim().split('\n');
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const month = formData.get('month') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!month) {
      return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 });
    }

    const csvContent = await file.text();
    const rows = parseCSV(csvContent);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV must contain headers and at least one data row' }, { status: 400 });
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const employeeCodeIdx = headers.findIndex(h => h === 'employee_code' || h === 'employee code');
    const daysWorkedIdx = headers.findIndex(h => h === 'days_worked' || h === 'days worked');
    const grossSalaryIdx = headers.findIndex(h => h === 'gross_salary' || h === 'gross salary' || h === 'gross');
    const deductionsIdx = headers.findIndex(h => h === 'deductions' || h === 'deduction');

    if (employeeCodeIdx === -1 || grossSalaryIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must contain "employee_code" and "gross_salary" columns' },
        { status: 400 }
      );
    }

    const employees: Array<{ employee_code: string; days_worked?: number; gross_salary: number; deductions: number }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const employeeCode = row[employeeCodeIdx]?.trim();
      const daysWorkedStr = daysWorkedIdx >= 0 ? row[daysWorkedIdx]?.trim() : undefined;
      const grossSalaryStr = row[grossSalaryIdx]?.trim();
      const deductionsStr = deductionsIdx >= 0 ? row[deductionsIdx]?.trim() : '0';

      if (!employeeCode || !grossSalaryStr) {
        continue;
      }

      const grossSalary = parseFloat(grossSalaryStr);
      const deductions = parseFloat(deductionsStr || '0');
      const daysWorked = daysWorkedStr ? parseFloat(daysWorkedStr) : undefined;

      if (isNaN(grossSalary)) {
        continue;
      }

      const emp: { employee_code: string; days_worked?: number; gross_salary: number; deductions: number } = {
        employee_code: employeeCode,
        gross_salary: grossSalary,
        deductions: isNaN(deductions) ? 0 : deductions,
      };

      if (daysWorked !== undefined && !isNaN(daysWorked)) {
        emp.days_worked = daysWorked;
      }

      employees.push(emp);
    }

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No valid employee rows found in CSV' }, { status: 400 });
    }

    const payload = {
      month,
      employees,
      file_name: file.name,
      file_size_bytes: file.size,
    };

    const parsed = uploadPayrollSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', detail: parsed.error.issues.map(e => ({ field: e.path.join('.'), msg: e.message })) },
        { status: 422 },
      );
    }

    const uploadRes = await fetch(new URL('/api/employer-dashboard/payroll/upload', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.json();
      return NextResponse.json(error, { status: uploadRes.status });
    }

    const result = await uploadRes.json();
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[payroll/csv-upload] error:', err);
    return NextResponse.json({ error: 'Failed to process CSV file' }, { status: 500 });
  }
}
