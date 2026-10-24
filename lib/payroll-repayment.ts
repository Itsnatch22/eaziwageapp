export interface PayrollAdvanceBalanceInput {
  id: string;
  currency: string | null;
}

export interface PayrollScheduleBalanceInput {
  advance_id: string;
  repayment_amount: number | string;
  paid_amount: number | string;
  status: string;
  currency: string | null;
}

export interface OutstandingRepayment {
  amount: number;
  issues: string[];
}

export interface PayrollRepaymentCalculation {
  ewaDeduction: number;
  totalDeductions: number;
  netSalary: number;
  remainingBalance: number;
}

const UNPAID_SCHEDULE_STATUSES = new Set(["pending", "overdue", "partial"]);

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateOutstandingRepayment(
  advances: PayrollAdvanceBalanceInput[],
  schedules: PayrollScheduleBalanceInput[],
  payrollCurrency: string | null,
): OutstandingRepayment {
  if (advances.length === 0) return { amount: 0, issues: [] };

  const currency = payrollCurrency?.trim().toUpperCase();
  if (!currency) {
    return {
      amount: 0,
      issues: [
        "Employee payroll currency is missing; EWA repayment needs review",
      ],
    };
  }

  const schedulesByAdvance = new Map<string, PayrollScheduleBalanceInput[]>();
  for (const schedule of schedules) {
    const current = schedulesByAdvance.get(schedule.advance_id) ?? [];
    current.push(schedule);
    schedulesByAdvance.set(schedule.advance_id, current);
  }

  const issues: string[] = [];
  let amount = 0;

  for (const advance of advances) {
    if (advance.currency?.trim().toUpperCase() !== currency) {
      issues.push(
        `Advance ${advance.id} currency does not match payroll currency`,
      );
      continue;
    }

    const advanceSchedules = schedulesByAdvance.get(advance.id) ?? [];
    if (advanceSchedules.length !== 1) {
      issues.push(
        advanceSchedules.length === 0
          ? `Advance ${advance.id} has no repayment schedule`
          : `Advance ${advance.id} has multiple repayment schedules`,
      );
      continue;
    }

    const [schedule] = advanceSchedules;
    if (schedule.currency?.trim().toUpperCase() !== currency) {
      issues.push(
        `Repayment schedule for advance ${advance.id} has a different currency`,
      );
      continue;
    }
    const repaymentAmount = Number(schedule.repayment_amount);
    const paidAmount = Number(schedule.paid_amount);
    if (
      !Number.isFinite(repaymentAmount) ||
      !Number.isFinite(paidAmount) ||
      repaymentAmount < 0 ||
      paidAmount < 0
    ) {
      issues.push(
        `Repayment schedule for advance ${advance.id} has an invalid balance`,
      );
      continue;
    }

    if (schedule.status === "paid") {
      if (paidAmount < repaymentAmount) {
        issues.push(
          `Paid repayment schedule for advance ${advance.id} has an unpaid balance`,
        );
      }
      continue;
    }
    if (!UNPAID_SCHEDULE_STATUSES.has(schedule.status)) {
      issues.push(
        `Repayment schedule for advance ${advance.id} has unsupported status`,
      );
      continue;
    }

    amount += Math.max(0, repaymentAmount - paidAmount);
  }

  return { amount: roundMoney(amount), issues };
}

export function calculatePayrollRepayment(
  outstandingBalance: number,
  grossSalary: number,
  uploadedDeductions: number,
): PayrollRepaymentCalculation {
  const availablePay = Math.max(0, grossSalary - uploadedDeductions);
  const ewaDeduction = roundMoney(
    Math.min(Math.max(0, outstandingBalance), availablePay),
  );
  const totalDeductions = roundMoney(
    Math.max(uploadedDeductions, ewaDeduction),
  );

  return {
    ewaDeduction,
    totalDeductions,
    netSalary: roundMoney(Math.max(0, grossSalary - totalDeductions)),
    remainingBalance: roundMoney(
      Math.max(0, outstandingBalance - ewaDeduction),
    ),
  };
}
