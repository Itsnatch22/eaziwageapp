import { describe, expect, it } from "vitest";
import {
  calculateOutstandingRepayment,
  calculatePayrollRepayment,
} from "@/lib/payroll-repayment";

describe("payroll EWA repayment calculation", () => {
  it("uses only unpaid disbursed advance schedules in the matching currency", () => {
    const result = calculateOutstandingRepayment(
      [
        { id: "advance-1", currency: "KES" },
        { id: "advance-2", currency: "KES" },
      ],
      [
        {
          advance_id: "advance-1",
          repayment_amount: 20_000,
          paid_amount: 5_000,
          status: "partial",
          currency: "KES",
        },
        {
          advance_id: "advance-2",
          repayment_amount: 10_000,
          paid_amount: 10_000,
          status: "paid",
          currency: "KES",
        },
      ],
      "kes",
    );

    expect(result).toEqual({ amount: 15_000, issues: [] });
  });

  it("fails closed when a disbursed advance has no repayment schedule", () => {
    const result = calculateOutstandingRepayment(
      [{ id: "advance-1", currency: "KES" }],
      [],
      "KES",
    );

    expect(result.amount).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("no repayment schedule");
  });

  it("flags a paid schedule whose amount still shows an unpaid balance", () => {
    const result = calculateOutstandingRepayment(
      [{ id: "advance-1", currency: "KES" }],
      [
        {
          advance_id: "advance-1",
          repayment_amount: 25_000,
          paid_amount: 10_000,
          status: "paid",
          currency: "KES",
        },
      ],
      "KES",
    );

    expect(result.amount).toBe(0);
    expect(result.issues[0]).toContain("has an unpaid balance");
  });

  it("does not mix balances denominated in another currency", () => {
    const result = calculateOutstandingRepayment(
      [{ id: "advance-1", currency: "UGX" }],
      [
        {
          advance_id: "advance-1",
          repayment_amount: 25_000,
          paid_amount: 0,
          status: "pending",
          currency: "UGX",
        },
      ],
      "KES",
    );

    expect(result).toEqual({
      amount: 0,
      issues: ["Advance advance-1 currency does not match payroll currency"],
    });
  });

  it("avoids double-counting an EWA amount already included in uploaded deductions", () => {
    expect(calculatePayrollRepayment(25_000, 60_000, 25_000)).toEqual({
      ewaDeduction: 25_000,
      totalDeductions: 25_000,
      netSalary: 35_000,
      remainingBalance: 0,
    });
  });

  it("adds the EWA amount when the uploaded deductions do not cover it and carries the capped remainder", () => {
    expect(calculatePayrollRepayment(25_000, 60_000, 10_000)).toEqual({
      ewaDeduction: 25_000,
      totalDeductions: 25_000,
      netSalary: 35_000,
      remainingBalance: 0,
    });

    expect(calculatePayrollRepayment(25_000, 20_000, 10_000)).toEqual({
      ewaDeduction: 10_000,
      totalDeductions: 10_000,
      netSalary: 10_000,
      remainingBalance: 15_000,
    });
  });
});
