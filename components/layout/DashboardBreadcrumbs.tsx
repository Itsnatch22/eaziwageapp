"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  admin: "Admin Hub",
  advances: "Advances",
  "kyc-review": "KYC Review",
  employers: "Employers",
  employees: "Employees",
  "review-requests": "Review Requests",
  "risk-scoring": "Risk Scoring",
  notifications: "Notifications",
  support: "Support",
  "fraud-detection": "Fraud Detection",
  reconciliation: "Reconciliation",
  billing: "Billing & Revenue",
  "api-health": "System Health",
  settings: "Settings",
  "employee-dashboard": "Dashboard",
  "employer-dashboard": "Dashboard",
  "request-advance": "Request Advance",
  transactions: "Transactions",
  employment: "Employment",
  "payment-methods": "Payment Methods",
  wellness: "Wellness Tools",
  payroll: "Payroll",
  wallet: "Wallet & Funding",
  messages: "Communication",
  reports: "Reports",
  "risk-insights": "Risk Insights",
  docs: "Documentation",
  onboarding: "Onboarding",
  kyc: "KYC Verification",
  terminated: "Terminated Employees",
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);




  const filteredSegments = segments.filter(s => s !== "dashboards");


  if (filteredSegments.length <= 1 && (filteredSegments[0] === "admin" || filteredSegments[0] === "employee-dashboard" || filteredSegments[0] === "employer-dashboard")) {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={segments[0] === "admin" ? "/admin" : segments[1] === "employer-dashboard" ? "/dashboards/employer-dashboard" : "/dashboards/employee-dashboard"} className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {filteredSegments.map((segment, index) => {
          const isLast = index === filteredSegments.length - 1;
          const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
          

          const originalIndex = segments.indexOf(segment);
          const href = "/" + segments.slice(0, originalIndex + 1).join("/");

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
