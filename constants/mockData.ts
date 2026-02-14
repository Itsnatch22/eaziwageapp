import type { Employee, Transaction } from "@/types/dashboard";

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Sarah Jenkins",
    role: "Software Engineer",
    salary: 8500,
    availableWage: 2400,
    withdrawnThisMonth: 800,
    status: "Approved",
  },
  {
    id: "2",
    name: "Michael Chen",
    role: "Product Manager",
    salary: 9200,
    availableWage: 3100,
    withdrawnThisMonth: 0,
    status: "Approved",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    role: "UX Designer",
    salary: 7800,
    availableWage: 1200,
    withdrawnThisMonth: 1500,
    status: "Approved",
  },
  {
    id: "4",
    name: "David Kim",
    role: "Marketing Lead",
    salary: 7200,
    availableWage: 2000,
    withdrawnThisMonth: 200,
    status: "Pending",
  },
  {
    id: "5",
    name: "James Wilson",
    role: "Data Analyst",
    salary: 8100,
    availableWage: 2800,
    withdrawnThisMonth: 0,
    status: "Denied",
  },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    date: "2024-05-15",
    amount: 450.0,
    status: "Completed",
    type: "Withdrawal",
  },
  {
    id: "tx-2",
    date: "2024-05-01",
    amount: 800.0,
    status: "Completed",
    type: "Repayment",
  },
  {
    id: "tx-3",
    date: "2024-04-18",
    amount: 200.0,
    status: "Completed",
    type: "Withdrawal",
  },
];
