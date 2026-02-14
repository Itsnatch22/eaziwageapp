import React from "react";

export enum UserRole {
  EMPLOYER = "employer",
  EMPLOYEE = "employee",
}

export enum RequestStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  DENIED = "Denied",
  PAID = "Paid",
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  availableBalance: number;
  salary: number;
  status: "Active" | "Inactive";
}

export interface WageRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  status: RequestStatus;
  fee: number;
}

export interface AnalyticsData {
  month: string;
  disbursed: number;
  requests: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}
