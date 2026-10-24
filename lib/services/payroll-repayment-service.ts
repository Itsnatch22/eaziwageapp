import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateOutstandingRepayment,
  type OutstandingRepayment,
  type PayrollAdvanceBalanceInput,
  type PayrollScheduleBalanceInput,
} from "@/lib/payroll-repayment";

interface PayrollEmployeeIdentity {
  employee_code: string | null;
  user_id: string | null;
  currency: string | null;
}

interface LiveEmployeeRow {
  id: string;
  user_id: string;
}

interface AdvanceRow extends PayrollAdvanceBalanceInput {
  employee_id: string;
}

interface ScheduleRow extends PayrollScheduleBalanceInput {
  id: string;
  employee_id: string;
}

const PAGE_SIZE = 1000;
const FILTER_BATCH_SIZE = 500;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function loadEmployeeOutstandingRepayments(
  supabase: SupabaseClient,
  employerId: string,
  employees: PayrollEmployeeIdentity[],
): Promise<Map<string, OutstandingRepayment>> {
  const result = new Map<string, OutstandingRepayment>();
  if (employees.length === 0) return result;

  const userIds = [
    ...new Set(
      employees
        .map((employee) => employee.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const userIdCounts = new Map<string, number>();
  for (const employee of employees) {
    if (employee.user_id) {
      userIdCounts.set(
        employee.user_id,
        (userIdCounts.get(employee.user_id) ?? 0) + 1,
      );
    }
  }
  const duplicateUserIds = new Set(
    [...userIdCounts].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const employeeWithoutUser = employees.filter((employee) => !employee.user_id);
  for (const employee of employeeWithoutUser) {
    if (!employee.employee_code) continue;
    result.set(employee.employee_code, {
      amount: 0,
      issues: [
        "Employee identity is not linked to a live employee; EWA repayment needs review",
      ],
    });
  }

  for (const employee of employees) {
    if (!employee.employee_code || !employee.user_id) continue;
    if (duplicateUserIds.has(employee.user_id)) {
      result.set(employee.employee_code, {
        amount: 0,
        issues: [
          "Employee onboarding identity is duplicated; EWA repayment needs review",
        ],
      });
    }
  }

  const uniqueUserIds = userIds.filter((id) => !duplicateUserIds.has(id));
  if (uniqueUserIds.length === 0) return result;

  const liveEmployees: LiveEmployeeRow[] = [];
  for (const userIdBatch of chunks(uniqueUserIds, FILTER_BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id")
        .eq("employer_id", employerId)
        .in("user_id", userIdBatch)
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `Failed to resolve payroll employees for repayment calculation: ${error.message}`,
        );
      }

      const page = (data ?? []) as LiveEmployeeRow[];
      liveEmployees.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  const liveEmployeesByUserId = new Map<string, LiveEmployeeRow[]>();
  for (const employee of liveEmployees) {
    const current = liveEmployeesByUserId.get(employee.user_id) ?? [];
    current.push(employee);
    liveEmployeesByUserId.set(employee.user_id, current);
  }
  const identityByLiveEmployeeId = new Map<string, PayrollEmployeeIdentity>();

  for (const employee of employees) {
    if (!employee.user_id || !employee.employee_code) continue;
    if (duplicateUserIds.has(employee.user_id)) continue;
    const matches = liveEmployeesByUserId.get(employee.user_id) ?? [];
    if (matches.length !== 1) {
      result.set(employee.employee_code, {
        amount: 0,
        issues: [
          matches.length === 0
            ? "Employee is not linked to the active employer record; EWA repayment needs review"
            : "Employee has multiple live identity records; EWA repayment needs review",
        ],
      });
      continue;
    }
    const [liveEmployee] = matches;
    identityByLiveEmployeeId.set(liveEmployee.id, employee);
  }

  const liveEmployeeIds = [...identityByLiveEmployeeId.keys()];
  if (liveEmployeeIds.length === 0) return result;

  const advanceRows: AdvanceRow[] = [];
  for (const employeeIdBatch of chunks(liveEmployeeIds, FILTER_BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("advances")
        .select("id, employee_id, currency")
        .eq("employer_id", employerId)
        .eq("status", "completed")
        .not("disbursed_at", "is", null)
        .in("employee_id", employeeIdBatch)
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `Failed to load disbursed advances for payroll: ${error.message}`,
        );
      }

      const page = (data ?? []) as AdvanceRow[];
      advanceRows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  const advanceIds = advanceRows.map((advance) => advance.id);
  const scheduleRows: ScheduleRow[] = [];

  for (const advanceIdBatch of chunks(advanceIds, FILTER_BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("repayment_schedules")
        .select(
          "id, advance_id, employee_id, repayment_amount, paid_amount, status, currency",
        )
        .eq("employer_id", employerId)
        .in("advance_id", advanceIdBatch)
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `Failed to load repayment schedules for payroll: ${error.message}`,
        );
      }

      const page = (data ?? []) as ScheduleRow[];
      scheduleRows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  const advancesByEmployee = new Map<string, AdvanceRow[]>();
  for (const advance of advanceRows) {
    const current = advancesByEmployee.get(advance.employee_id) ?? [];
    current.push(advance);
    advancesByEmployee.set(advance.employee_id, current);
  }
  const schedulesByAdvance = new Map<string, ScheduleRow[]>();
  for (const schedule of scheduleRows) {
    const current = schedulesByAdvance.get(schedule.advance_id) ?? [];
    current.push(schedule);
    schedulesByAdvance.set(schedule.advance_id, current);
  }

  for (const [employeeId, identity] of identityByLiveEmployeeId) {
    if (!identity.employee_code) continue;
    const employeeAdvances = advancesByEmployee.get(employeeId) ?? [];
    const employeeSchedules: ScheduleRow[] = [];
    let unexpectedSchedule = false;
    for (const advance of employeeAdvances) {
      for (const schedule of schedulesByAdvance.get(advance.id) ?? []) {
        if (schedule.employee_id === employeeId) {
          employeeSchedules.push(schedule);
        } else {
          unexpectedSchedule = true;
        }
      }
    }
    const balance = calculateOutstandingRepayment(
      employeeAdvances,
      employeeSchedules,
      identity.currency,
    );

    if (unexpectedSchedule) {
      balance.issues.push(
        "Repayment schedule employee does not match its advance",
      );
    }

    result.set(identity.employee_code, balance);
  }

  return result;
}
