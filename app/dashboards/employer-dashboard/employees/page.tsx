"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  TrendingUp,
  UserCheck,
  Clock,
  Eye,
  Settings,
  XCircle,
  Calendar,
  Building2,
  Globe,
  LucideIcon,
  AlertCircle,
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  LucideCheckCircle2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/ExportButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployerPortalLayout } from "@/components/employer/EmployerLayout";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/realtime-js';
import {
  GradientIconBox,
  GradientAvatar,
  currencies,
  countries,
} from "@/components/employer/SharedComponents";

interface EWASettings {
  ewa_enabled: boolean;
  max_advance_percentage: number;
  min_advance_amount: number;
  max_advance_amount: number;
  cooldown_period: number;
}

interface BulkUploadError {
  email: string;
  message: string;
}

interface BulkUploadResults {
  total: number;
  success: number;
  failed: number;
  errors: BulkUploadError[];
}

interface EmployeeKycUpdateEvent {
  employeeId?: string;
  status?: string;
}

interface RiskUpdateEvent {
  type?: string;
  risk_rating?: string;
}

interface Employee {
  id: string;
  full_name?: string;
  name?: string;
  employee_code?: string;
  job_title?: string;
  department?: string;
  monthly_salary?: number;
  tenure_months?: number;
  kyc_status?: string;
  status?: string;
  country?: string;
  city?: string;
  employment_type?: string;
  start_date?: string;
  submitted_at?: string;
  ewa_settings?: EWASettings | null;
}

interface Employer {
  id?: string;
  company_name: string;
  full_name?: string;
}

interface DashboardAdvance {
  id: string;
  employee_id: string;
  status: string;
}

interface ExtendedStats {
  total_employees: number;
  active_employees: number;
  kyc_completion_rate: number;
  retention_rate: number;
  avg_tenure_months: number;
  new_hires_30_days: number;
  department_breakdown?: Record<string, number>;
}

const DEFAULT_EWA: EWASettings = {
  ewa_enabled: true,
  max_advance_percentage: 50,
  min_advance_amount: 500,
  max_advance_amount: 50000,
  cooldown_period: 7,
};

// Visually distinct hues (not several near-identical shades of the same
// color in a row) — order doesn't matter since colors are assigned by a
// stable hash of the department name below, not by array position.
const CHART_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#6366f1", // indigo
  "#f97316", // orange
  "#14b8a6", // teal
  "#d946ef", // fuchsia
];

// Deterministic color-per-department: hashes the department name itself
// (from what the employee entered during onboarding), not its position in
// the current data — so "Operations" is always the same color regardless of
// what order departments happen to come back in from the API.
function departmentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

const BulkOnboardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkUploadResults | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const downloadTemplate = () => {
    const headers = [
      [
        "full_name",
        "email",
        "employee_code",
        "job_title",
        "department",
        "monthly_salary",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "eaziwage_employee_template.csv");
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const res = await fetch(
            "/api/employer-dashboard/employees/bulk-upload",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ employees: json }),
            },
          );

          const resultData = await res.json();
          if (!res.ok) throw new Error(resultData.error || "Upload failed");

          setResults(resultData);
          if (resultData.success > 0) {
            toast.success(
              `Successfully onboarded ${resultData.success} employees`,
            );
            onSuccess();
          }
        } catch (innerErr: unknown) {
          toast.error(
            innerErr instanceof Error ? innerErr.message : "Upload failed",
          );
        } finally {
          setUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Bulk Onboard Employees
              </h2>
              <p className="text-white/70 text-sm">
                Upload a CSV/Excel file to invite your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!results ? (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    How it works
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Download our template, fill in your employee details, and
                    upload it here. We&apos;ll create pending profiles and send
                    invitations to each email.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="text-xs font-bold text-blue-600 hover:underline mt-2"
                  >
                    Download CSV Template
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="bulk-file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label htmlFor="bulk-file" className="cursor-pointer">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  {file ? (
                    <p className="font-bold text-slate-900 dark:text-white">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Click to select file
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        CSV or Excel (Max 5MB)
                      </p>
                    </>
                  )}
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="flex-1 bg-primary text-white"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? "Processing..." : "Upload & Invite"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {results.total}
                  </p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {results.success}
                  </p>
                  <p className="text-xs text-emerald-600">Successful</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {results.failed}
                  </p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {results.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                            {err.email}
                          </td>
                          <td className="px-3 py-2 text-red-500">
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button
                onClick={onClose}
                className="w-full bg-primary text-white"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext: string;
  trend?: string;
  trendUp?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  trendUp,
}) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between mb-3">
      <GradientIconBox icon={Icon} size="md" />
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
            trendUp
              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"
              : "bg-red-100 dark:bg-red-500/20 text-red-600",
          )}
        >
          <TrendingUp className={cn("w-3 h-3", !trendUp && "rotate-180")} />
          {trend}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
      {label}
    </p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
      {value}
    </p>
    {subtext && (
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {subtext}
      </p>
    )}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = {
    approved: {
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      label: "Active",
    },
    pending: {
      bg: "bg-amber-100 dark:bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-300",
      label: "Pending",
    },
    rejected: {
      bg: "bg-red-100 dark:bg-red-500/20",
      text: "text-red-700 dark:text-red-300",
      label: "Rejected",
    },
  };
  const { bg, text, label } =
    config[status as keyof typeof config] ?? config.pending;
  return (
    <span
      className={cn("px-3 py-1 rounded-full text-xs font-semibold", bg, text)}
    >
      {label}
    </span>
  );
};

const KYCBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = {
    approved: { icon: LucideCheckCircle2, color: "text-emerald-600" },
    pending: { icon: Clock, color: "text-amber-600" },
    under_review: { icon: Clock, color: "text-blue-600" },
    rejected: { icon: XCircle, color: "text-red-600" },
  };
  const { icon: Icon, color } =
    config[status as keyof typeof config] ?? config.pending;
  return <Icon className={cn("w-5 h-5", color)} />;
};

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-primary text-white shadow-lg shadow-primary/25"
        : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800",
    )}
  >
    {children}
  </button>
);

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: { name: string; value: number };
    value: number;
    name: string;
  }[];
  totalEmployees: number;
}

const CustomTooltip = ({
  active,
  payload,
  totalEmployees,
}: CustomTooltipProps) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    const value = d.value as number;
    const name = d.name as string;
    return (
      <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {name}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {value} employees (
          {totalEmployees > 0 ? ((value / totalEmployees) * 100).toFixed(1) : 0}
          %)
        </p>
      </div>
    );
  }
  return null;
};

const DepartmentPieChart: React.FC<{
  data: Record<string, number>;
  totalEmployees: number;
}> = ({ data, totalEmployees }) => {
  if (!data || Object.keys(data).length === 0) return null;

  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: Number(value),
    color: departmentColor(name),
  }));

  return (
    <div className="flex items-center gap-6" data-testid="department-pie-chart">
      <div className="relative w-40 h-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip totalEmployees={totalEmployees} />}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {totalEmployees}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Total
          </span>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2">
        {chartData.slice(0, 8).map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {item.name}
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white ml-auto">
              {item.value}
            </span>
          </div>
        ))}
        {chartData.length > 8 && (
          <div className="text-xs text-slate-500 col-span-2">
            +{chartData.length - 8} more departments
          </div>
        )}
      </div>
    </div>
  );
};

const EmployeeRow: React.FC<{
  employee: Employee;
  onViewDetails: (e: Employee) => void;
  onEditEWA: (e: Employee) => void;
  currency: string;
  pendingAdvancesCount?: number;
}> = ({
  employee,
  onViewDetails,
  onEditEWA,
  currency,
  pendingAdvancesCount = 0,
}) => (
  <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
    <GradientAvatar
      initials={
        employee.full_name
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) ||
        employee.job_title?.charAt(0).toUpperCase() ||
        "E"
      }
      size="md"
    />
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-white truncate">
        {employee.full_name ||
          employee.name ||
          `Employee ${employee.employee_code || ""}`}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {[
          employee.employee_code,
          employee.job_title,
          employee.department || "General",
        ]
          .filter(Boolean)
          .join(" • ")}
      </p>
    </div>
    <div className="text-right hidden sm:block">
      <p className="font-bold text-slate-900 dark:text-white">
        {formatCurrency(employee.monthly_salary ?? 0, currency)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Monthly</p>
    </div>
    <div className="text-center hidden md:block w-20">
      <p className="font-semibold text-slate-900 dark:text-white">
        {employee.tenure_months ?? 0}m
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Tenure</p>
    </div>
    <div className="hidden lg:flex items-center justify-center w-12">
      <KYCBadge status={employee.kyc_status ?? "pending"} />
    </div>
    <StatusBadge status={employee.status ?? "pending"} />
    <div className="hidden xl:block">
      {employee.ewa_settings?.ewa_enabled === false ? (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          EWA Off
        </span>
      ) : employee.ewa_settings?.max_advance_percentage ? (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
          {employee.ewa_settings.max_advance_percentage}% limit
        </span>
      ) : (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          Default
        </span>
      )}
    </div>
    {pendingAdvancesCount > 0 && (
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
          {pendingAdvancesCount} pending
        </span>
      </div>
    )}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onViewDetails(employee)}
        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => onEditEWA(employee)}
        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
        title="EWA Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const EWASettingsModal: React.FC<{
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (employeeId: string, settings: EWASettings) => void;
}> = ({ employee, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<EWASettings>(() => {
    if (employee?.ewa_settings) {
      return {
        ewa_enabled: employee.ewa_settings.ewa_enabled ?? true,
        max_advance_percentage:
          employee.ewa_settings.max_advance_percentage ?? 50,
        min_advance_amount: employee.ewa_settings.min_advance_amount ?? 500,
        max_advance_amount: employee.ewa_settings.max_advance_amount ?? 50000,
        cooldown_period: employee.ewa_settings.cooldown_period ?? 7,
      };
    }
    return DEFAULT_EWA;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!employee?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employer-dashboard/employees/${employee.id}/ewa-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = Array.isArray(data.detail)
          ? data.detail.map((e: { msg: string }) => e.msg).join(", ")
          : (data.error ?? "Failed to update settings");
        throw new Error(msg);
      }

      toast.success("EWA settings updated");
      onSave(employee.id, settings);
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update settings",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary p-6">
          <h2 className="text-xl font-bold text-white">EWA Settings</h2>
          <p className="text-white/80 text-sm mt-1">
            {employee.full_name || employee.employee_code}
          </p>
        </div>

        <div className="p-6 space-y-6">
          
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Enable EWA Access
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Allow this employee to request advances
              </p>
            </div>
            <Switch
              checked={settings.ewa_enabled}
              onCheckedChange={(v) =>
                setSettings((prev) => ({ ...prev, ewa_enabled: v }))
              }
            />
          </div>

          {settings.ewa_enabled && (
            <>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Max Advance Percentage
                  </Label>
                  <span className="text-xl font-bold text-primary">
                    {settings.max_advance_percentage}%
                  </span>
                </div>
                <Slider
                  value={[settings.max_advance_percentage]}
                  onValueChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      max_advance_percentage: v[0],
                    }))
                  }
                  max={100}
                  min={10}
                  step={5}
                />
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Min Amount (KES)
                  </Label>
                  <Input
                    type="number"
                    value={settings.min_advance_amount}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        min_advance_amount: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Max Amount (KES)
                  </Label>
                  <Input
                    type="number"
                    value={settings.max_advance_amount}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        max_advance_amount: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">
                  Cooldown Period (Days)
                </Label>
                <Input
                  type="number"
                  value={settings.cooldown_period}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      cooldown_period: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  max={30}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-white"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface EmployeePaymentMethod {
  id: string;
  method_type: 'mobile_money' | 'bank_account';
  provider_name: string;
  account_name: string | null;
  account_number: string | null;
  phone_number: string | null;
  country_code: string | null;
  is_default: boolean;
  is_verified: boolean;
}

const EmployeeViewModal: React.FC<{
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ employee, isOpen, onClose }) => {
  const { currency } = useCurrency();
  const [paymentMethods, setPaymentMethods] = React.useState<EmployeePaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !employee?.id) return;
    Promise.resolve().then(() => setPmLoading(true));
    fetch(`/api/employer-dashboard/employees/${employee.id}/payment-methods`)
      .then(r => r.ok ? r.json() : { methods: [] })
      .then(d => setPaymentMethods(d.methods ?? []))
      .catch(() => setPaymentMethods([]))
      .finally(() => setPmLoading(false));
  }, [isOpen, employee?.id]);

  if (!isOpen || !employee) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6">
          <div className="flex items-center gap-4">
            <GradientAvatar
              initials={
                employee.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "E"
              }
              size="lg"
              className="border-2 border-white/30"
            />
            <div>
              <h2 className="text-xl font-bold text-white">
                {employee.full_name || "Employee"}
              </h2>
              <p className="text-white/80 text-sm">
                {employee.job_title} • {employee.department || "General"}
              </p>
              <p className="text-white/60 text-xs mt-1">
                ID: {employee.employee_code}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly Salary
              </p>
              <p className="font-bold text-slate-900 dark:text-white">
                {formatCurrency(employee.monthly_salary ?? 0, currency)}
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tenure
              </p>
              <p className="font-bold text-slate-900 dark:text-white">
                {employee.tenure_months ?? 0} months
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge status={employee.status ?? "pending"} />
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                KYC Status
              </p>
              <div className="flex items-center gap-2 mt-1">
                <KYCBadge status={employee.kyc_status ?? "pending"} />
                <span className="text-sm capitalize text-slate-700 dark:text-slate-300">
                  {employee.kyc_status ?? "pending"}
                </span>
              </div>
            </div>
            {employee.country && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Location
                </p>
                <p className="font-bold text-slate-900 dark:text-white">
                  {employee.city ? `${employee.city}, ` : ""}
                  {employee.country}
                </p>
              </div>
            )}
            {employee.employment_type && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Employment Type
                </p>
                <p className="font-bold text-slate-900 dark:text-white capitalize">
                  {employee.employment_type.replace("_", " ")}
                </p>
              </div>
            )}
          </div>

          {employee.ewa_settings && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm font-semibold text-primary mb-2">
                EWA Settings
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Max Advance:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {employee.ewa_settings.max_advance_percentage ?? 50}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {employee.ewa_settings.ewa_enabled === false
                      ? "Disabled"
                      : "Enabled"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Cooldown:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {employee.ewa_settings.cooldown_period} days
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Disbursement destination — read-only for employer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              Disbursement Destination
            </p>
            {pmLoading ? (
              <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
            ) : paymentMethods.length === 0 ? (
              <p className="text-xs text-slate-400">No payment method set. Employee has not added a disbursement account yet.</p>
            ) : (() => {
              // API orders by is_default desc, so [0] is the primary method (or the only one).
              const pm = paymentMethods[0];
              return (
                <div className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border text-sm',
                  pm.is_default
                    ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700',
                )}>
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    {pm.method_type === 'mobile_money'
                      ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      : <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {pm.provider_name}
                      {pm.is_default && <span className="ml-2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Default</span>}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {pm.method_type === 'mobile_money' ? pm.phone_number : pm.account_number}
                      {pm.account_name ? ` · ${pm.account_name}` : ''}
                    </p>
                  </div>
                  {!pm.is_verified && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">Unverified</span>
                  )}
                </div>
              );
            })()}
          </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      "animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl",
      className,
    )}
  />
);



const EmployerEmployees: React.FC = () => {
  const { currency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currency);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [stats, setStats] = useState<ExtendedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [pendingAdvancesByEmployee, setPendingAdvancesByEmployee] = useState<
    Record<string, number>
  >({});


  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [showEWAModal, setShowEWAModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);


  const fetchData = useCallback(async (options?: { silent?: boolean }) => {

    await Promise.resolve();
    if (!options?.silent) setLoading(true);
    setFetchError("");
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);

      const [profileRes, employeesRes, advancesRes] = await Promise.all([
        fetch("/api/employer-dashboard/profile"),
        fetch(`/api/employer-dashboard/employees?${params.toString()}`),
        fetch("/api/employer-dashboard/advances"),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error ?? "Failed to load profile");
      }
      if (!employeesRes.ok) {
        const data = await employeesRes.json();
        throw new Error(data.error ?? "Failed to load employees");
      }

      const profileData = await profileRes.json();
      const employeesData = await employeesRes.json();
      const advancesData = advancesRes.ok ? await advancesRes.json() : [];

      const profile = profileData.profile;
      setEmployer(
        profile
          ? {
              id: profile.id,
              full_name: profile.full_name,
              company_name:
                profile.company_name || profile.full_name || "Employer",
            }
          : null,
      );
      setEmployees(employeesData.employees ?? []);
      setStats(employeesData.stats ?? null);


      const pendingByEmployee: Record<string, number> = {};
      (Array.isArray(advancesData) ? advancesData : []).forEach(
        (advance: DashboardAdvance) => {
          if (advance.status === "pending") {
            const empId = advance.employee_id;
            pendingByEmployee[empId] = (pendingByEmployee[empId] || 0) + 1;
          }
        },
      );
      setPendingAdvancesByEmployee(pendingByEmployee);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData({ silent: true });
  }, [fetchData]);

  useEffect(() => {
    if (!employer?.id) return;

    const supabase = createClient();
    type RealtimeEmployeeKycPayload = { new: EmployeeKycUpdateEvent; old?: EmployeeKycUpdateEvent };
    type RealtimeRiskPayload = { new: RiskUpdateEvent; old?: RiskUpdateEvent };
    type SupabaseWithChannel = { channel: (name: string) => RealtimeChannel; removeChannel: (c: RealtimeChannel) => void };

    const channel = supabase
          .channel(`realtime:employer-${employer.id}:employees`)
          .on('postgres_changes' as const, { event: 'UPDATE', schema: 'public', table: 'employee_onboarding', filter: `employer_id=eq.${employer.id}` }, (payload: RealtimeEmployeeKycPayload) => {
        console.log("[Realtime] Employee KYC update received by employer:", payload.new);
        void fetchData();
      })
          .on('postgres_changes' as const, { event: 'UPDATE', schema: 'public', table: 'employee_kyc_documents', filter: `user_id=eq.${employer.id}` }, (payload: RealtimeRiskPayload) => {
        console.log("[Realtime] Risk score update received by admin:", payload.new);
        const data = payload.new;
        if (data.type === "risk_score_updated") {
          toast.success(`Risk score updated: ${data.risk_rating} rating`);
          void fetchData();
        }
      })
      .subscribe();



    return () => {

      (supabase as unknown as SupabaseWithChannel).removeChannel(channel);
    };
  }, [employer?.id, fetchData]);


  const handleEWASave = (employeeId: string, newSettings: EWASettings) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId ? { ...e, ewa_settings: newSettings } : e,
      ),
    );
  };


  const departments = [
    ...new Set(employees.map((e) => e.department).filter(Boolean)),
  ] as string[];

  const filteredEmployees = employees.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (departmentFilter && e.department !== departmentFilter) return false;
    if (countryFilter && e.country !== countryFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        e.full_name?.toLowerCase().includes(s) ||
        e.employee_code?.toLowerCase().includes(s) ||
        e.job_title?.toLowerCase().includes(s) ||
        e.department?.toLowerCase().includes(s)
      );
    }
    return true;
  });


  const displayStats: ExtendedStats = stats ?? {
    total_employees: employees.length,
    active_employees: employees.filter((e) => e.status === "approved").length,
    kyc_completion_rate:
      employees.length > 0
        ? Math.round(
            (employees.filter((e) => e.kyc_status === "approved").length /
              employees.length) *
              100,
          )
        : 0,
    retention_rate: 0,
    avg_tenure_months: 0,
    new_hires_30_days: 0,
  };


  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="employees-title"
            >
              Employees
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage your workforce and EWA settings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowBulkModal(true)}
              className="bg-primary text-white"
            >
              <Users className="w-4 h-4 mr-2" /> Bulk Onboard
            </Button>
          </div>
        </div>

        
        {fetchError && !loading && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800/30">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                {fetchError}
              </p>
            </div>
            <button
              onClick={() => void fetchData()}
              className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              label="Total Employees"
              value={displayStats.total_employees}
              subtext={`${displayStats.active_employees} active`}
            />
            <MetricCard
              icon={TrendingUp}
              label="Retention Rate"
              value={`${displayStats.retention_rate}%`}
              subtext="Employees with 12+ months"
              trend="+5.2%"
              trendUp
            />
            <MetricCard
              icon={UserCheck}
              label="KYC Completion"
              value={`${displayStats.kyc_completion_rate}%`}
              subtext="Fully verified"
            />
            <MetricCard
              icon={Clock}
              label="Avg. Tenure"
              value={`${displayStats.avg_tenure_months} months`}
              subtext={`${displayStats.new_hires_30_days} new this month`}
            />
          </div>
        )}

        
        {!loading &&
          displayStats.department_breakdown &&
          Object.keys(displayStats.department_breakdown).length > 0 && (
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center gap-3 mb-6">
                <GradientIconBox icon={Building2} size="md" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Department Distribution
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Employee utilization across departments
                  </p>
                </div>
              </div>
              <DepartmentPieChart
                data={displayStats.department_breakdown}
                totalEmployees={displayStats.total_employees}
              />
            </div>
          )}

        
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col gap-4">
            
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by name, ID, or job title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                  data-testid="search-employees"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 h-11 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        from: e.target.value,
                      }))
                    }
                    className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32"
                    placeholder="From"
                  />
                </div>
                <span className="text-slate-400">to</span>
                <div className="flex items-center gap-2 px-3 h-11 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, to: e.target.value }))
                    }
                    className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>

            
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton
                active={statusFilter === ""}
                onClick={() => setStatusFilter("")}
              >
                All
              </FilterButton>
              <FilterButton
                active={statusFilter === "approved"}
                onClick={() => setStatusFilter("approved")}
              >
                Active
              </FilterButton>
              <FilterButton
                active={statusFilter === "pending"}
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </FilterButton>

              {departments.length > 0 && (
                <Select
                  value={departmentFilter || "all"}
                  onValueChange={(v) =>
                    setDepartmentFilter(v === "all" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-40 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={countryFilter || "all"}
                onValueChange={(v) => setCountryFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-36 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
              >
                <SelectTrigger className="w-28 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                No employees found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter || departmentFilter || countryFilter
                  ? "Try adjusting your search or filters"
                  : "Add employees to get started"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              
              <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="w-11" />
                <div className="flex-1">Employee</div>
                <div className="w-24 text-right hidden sm:block">Salary</div>
                <div className="w-20 text-center hidden md:block">Tenure</div>
                <div className="w-12 text-center hidden lg:block">KYC</div>
                <div className="w-20">Status</div>
                <div className="w-24 hidden xl:block">EWA</div>
                <div className="w-20" />
              </div>

              {filteredEmployees.map((employee) => (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  currency={selectedCurrency}
                  pendingAdvancesCount={
                    pendingAdvancesByEmployee[employee.id] || 0
                  }
                  onViewDetails={(e) => {
                    setSelectedEmployee(e);
                    setShowViewModal(true);
                  }}
                  onEditEWA={(e) => {
                    setSelectedEmployee(e);
                    setShowEWAModal(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        
        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredEmployees.length} of {employees.length} employees
            </span>
            <ExportButton
              data={filteredEmployees}
              filename={`employees-${new Date().toISOString().split("T")[0]}`}
              headers={[
                "Name",
                "Code",
                "Job Title",
                "Department",
                "Salary",
                "KYC Status",
                "Status",
                "Country",
              ]}
              mapping={(e: Employee) => [
                e.full_name ?? "",
                e.employee_code ?? "",
                e.job_title ?? "",
                e.department ?? "",
                e.monthly_salary ?? 0,
                e.kyc_status ?? "",
                e.status ?? "",
                e.country ?? "",
              ]}
            />
          </div>
        )}
      </div>

      
      {showEWAModal && selectedEmployee && (
        <EWASettingsModal
          key={selectedEmployee.id}
          employee={selectedEmployee}
          isOpen={showEWAModal}
          onClose={() => {
            setShowEWAModal(false);
            setSelectedEmployee(null);
          }}
          onSave={handleEWASave}
        />
      )}
      <EmployeeViewModal
        employee={selectedEmployee}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedEmployee(null);
        }}
      />
      <BulkOnboardModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={fetchData}
      />
    </EmployerPortalLayout>
  );
};

export default EmployerEmployees;
