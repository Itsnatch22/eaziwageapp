import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { buildCsv } from "@/lib/server/export-utils";
import { dbErrorResponse } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { calculatePayrollRepayment } from "@/lib/payroll-repayment";
import { loadEmployeeOutstandingRepayments } from "@/lib/services/payroll-repayment-service";

export const runtime = "nodejs";

interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  monthly_salary: number | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

interface OnboardingIdentityRow {
  employee_code: string | null;
  user_id: string | null;
  currency: string | null;
}

function parseMonthRange(monthParam: string | null): {
  key: string;
  fromIso: string;
  toIso: string;
} {
  const now = new Date();
  const [year, month] = monthParam?.split("-").map(Number) ?? [
    now.getFullYear(),
    now.getMonth() + 1,
  ];
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthParam = req.nextUrl.searchParams.get("month");
  const range = parseMonthRange(monthParam);

  const { data: employer, error: employerError } = await supabase
    .from("employers")
    .select("id, onboarding_id, company_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/reconciliation-file",
      employerError,
    );
  }
  if (!employer) {
    const { data: obFallback } = await supabase
      .from("employer_onboarding")
      .select("id, company_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const companyName = obFallback?.company_name ?? "Employer";
    const csv = buildCsv([
      ["Report", "Payroll Deduction Reconciliation"],
      ["Company", companyName],
      ["Month", range.key],
      [
        "Message",
        "No active employer account found. Please complete onboarding.",
      ],
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-deductions-${range.key}.csv"`,
      },
    });
  }

  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select("id, user_id, employee_code, monthly_salary")
    .eq("employer_id", employer.id)
    .eq("status", "Active");

  if (employeeError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/reconciliation-file",
      employeeError,
    );
  }

  const employeeRows = (employees ?? []) as EmployeeRow[];
  const employeeIds = employeeRows.map((row) => row.id);
  if (employeeIds.length === 0) {
    const csv = buildCsv([
      ["Report", "Payroll Deduction Reconciliation"],
      ["Company", employer.company_name ?? "Employer"],
      ["Month", range.key],
      ["Message", "No employees found for this employer."],
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-deductions-${range.key}.csv"`,
      },
    });
  }

  const userIds = employeeRows
    .map((row) => row.user_id)
    .filter((id): id is string => Boolean(id));
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] };
  const profilesMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]),
  );

  const adminSupabase = createAdminClient();
  const { data: onboardingRows, error: onboardingError } = await adminSupabase
    .from("employee_onboarding")
    .select("employee_code, user_id, currency")
    .eq("live_employer_id", employer.id)
    .in("user_id", userIds);

  if (onboardingError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/reconciliation-file",
      onboardingError,
    );
  }

  const onboardingByUserId = new Map<string, OnboardingIdentityRow>(
    ((onboardingRows ?? []) as OnboardingIdentityRow[])
      .filter((row) => row.user_id)
      .map((row) => [row.user_id!, row]),
  );
  const onboardingCodeCounts = new Map<string, number>();
  for (const row of onboardingRows ?? []) {
    if (row.employee_code) {
      onboardingCodeCounts.set(
        row.employee_code,
        (onboardingCodeCounts.get(row.employee_code) ?? 0) + 1,
      );
    }
  }
  const liveCodeCounts = new Map<string, number>();
  for (const employee of employeeRows) {
    if (employee.employee_code) {
      liveCodeCounts.set(
        employee.employee_code,
        (liveCodeCounts.get(employee.employee_code) ?? 0) + 1,
      );
    }
  }
  const repaymentBalances = await loadEmployeeOutstandingRepayments(
    adminSupabase,
    employer.id,
    (onboardingRows ?? []) as OnboardingIdentityRow[],
  ).catch((error: unknown) => {
    console.error(
      "[payroll/reconciliation-file] repayment balance lookup failed:",
      error,
    );
    return null;
  });

  if (!repaymentBalances) {
    return NextResponse.json(
      { error: "Failed to calculate outstanding employee repayments" },
      { status: 500 },
    );
  }

  const rows: Array<Array<string | number>> = [
    ["Report", "Employee EWA Payroll Deduction Review"],
    ["Company", employer.company_name ?? "Employer"],
    ["Month", range.key],
    ["Generated At", new Date().toISOString()],
    [
      "Note",
      "Proposed payroll calculation only. This does not transfer salary or mark advances repaid.",
    ],
    [""],
    [
      "Employee Code",
      "Employee Name",
      "Gross Salary",
      "Outstanding EWA Balance",
      "Proposed EWA Deduction",
      "Remaining Balance to Carry Forward",
      "Net Salary After EWA",
      "Review Notes",
    ],
  ];

  let totalGross = 0;
  let totalDeductions = 0;

  for (const employee of employeeRows) {
    const gross = Number(employee.monthly_salary ?? 0);
    const fullName = employee.user_id
      ? profilesMap.get(employee.user_id)?.full_name
      : null;
    const identity = employee.user_id
      ? onboardingByUserId.get(employee.user_id)
      : undefined;
    const balance = identity?.employee_code
      ? repaymentBalances.get(identity.employee_code)
      : undefined;
    const reviewIssues = balance?.issues
      ? [...balance.issues]
      : [
          "Employee onboarding identity or currency is missing; manual review required",
        ];
    if (
      identity?.employee_code &&
      ((onboardingCodeCounts.get(identity.employee_code) ?? 0) > 1 ||
        (liveCodeCounts.get(identity.employee_code) ?? 0) > 1)
    ) {
      reviewIssues.push(
        "Employee code is not unique; EWA repayment needs review",
      );
    }
    const calculation =
      reviewIssues.length === 0 && balance
        ? calculatePayrollRepayment(balance.amount, gross, 0)
        : {
            ewaDeduction: 0,
            netSalary: gross,
            remainingBalance: balance?.amount ?? 0,
          };

    if (!balance || (balance.amount <= 0 && reviewIssues.length === 0))
      continue;

    totalGross += gross;
    totalDeductions += calculation.ewaDeduction;

    rows.push([
      employee.employee_code ?? "",
      fullName ?? employee.employee_code ?? "Employee",
      gross.toFixed(2),
      (balance?.amount ?? 0).toFixed(2),
      calculation.ewaDeduction.toFixed(2),
      calculation.remainingBalance.toFixed(2),
      calculation.netSalary.toFixed(2),
      reviewIssues.join("; "),
    ]);
  }

  rows.push([""]);
  rows.push([
    "Totals",
    "",
    totalGross.toFixed(2),
    "",
    totalDeductions.toFixed(2),
    "",
    Math.max(0, totalGross - totalDeductions).toFixed(2),
    "",
  ]);

  const csv = buildCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-deductions-${range.key}.csv"`,
    },
  });
}
