export interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number;
  availableWage: number;
  withdrawnThisMonth: number;
  status: "Approved" | "Pending" | "Denied";
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  status: "Completed" | "Pending" | "Failed";
  type: "Withdrawal" | "Repayment";
}

export interface Partner {
  name: string;
  logo: string;
  blurb: string;
  href?: string;
}
