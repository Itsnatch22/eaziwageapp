'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, Download, UserCheck, Clock,
  MoreHorizontal, Eye, CreditCard, 
  CheckCircle2, XCircle, X, Edit, Shield, Mail, Phone,
  Ban, RefreshCw, FileText, User, Briefcase, MapPin,
} from 'lucide-react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { Label }                   from '@/components/ui/label';
import { Slider }                  from '@/components/ui/slider';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AdminPortalLayout }       from '@/components/admin/AdminLayout';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast }                   from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

type KYCStatus = 'approved' | 'pending' | 'submitted' | 'rejected';

type EmploymentType = 'full-time' | 'part-time' | 'contract';

type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'repaid' | 'defaulted';

interface Employee {
  id:               string;
  employer_id:      string;
  employee_code:    string;
  full_name:        string;
  email:            string;
  phone:            string | null;
  national_id:      string | null;
  country:          string | null;
  job_title:        string;
  department:       string | null;
  monthly_salary:   number;
  advance_limit:    number;
  earned_wages:     number;
  employment_type:  EmploymentType;
  status:           EmployeeStatus;
  kyc_status:       KYCStatus;
  risk_score:       number | null;
  
  // KYC documents (booleans indicating if uploaded)
  id_document_front?:   boolean;
  id_document_back?:    boolean;
  selfie?:              boolean;
  address_proof?:       boolean;
  payslip_1?:           boolean;
  payslip_2?:           boolean;
  bank_statement?:      boolean;
  employment_contract?: boolean;

  // Joined data
  employer_name?:  string;
  advance_stats?: {
    advance_count:      number;
    total_advances:     number;
    pending_repayment:  number;
    total_fees_paid:    number;
  };
  advances?: Advance[];

  created_at: string;
  updated_at: string;
}

interface Advance {
  id:          string;
  employer_id: string;
  employee_id: string;
  amount:      number;
  fee_amount:  number;
  status:      AdvanceStatus;
  created_at:  string;
}

interface Stats {
  total:       number;
  active:      number;
  pending_kyc: number;
  suspended:   number;
}

type TabKey = 'overview' | 'advances' | 'kyc' | 'actions';

type VariantColor = 'green' | 'slate' | 'black';

interface EditData {
  job_title:        string;
  department:       string;
  monthly_salary:   number;
  employment_type:  EmploymentType;
}

interface RiskOverride {
  score:  number;
  reason: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface GradientIconBoxProps {
  icon:     React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?:    'sm' | 'md' | 'lg';
  variant?: VariantColor;
}

const GradientIconBox: React.FC<GradientIconBoxProps> = ({ 
  icon: Icon, 
  size = 'md', 
  variant = 'green',
}) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };
  const variants: Record<VariantColor, string> = {
    green: 'from-green-600 to-green-700',
    slate: 'from-slate-600 to-slate-800',
    black: 'from-slate-800 to-black',
  };
  
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg',
        sizes[size],
        variants[variant],
      )}
    >
      <Icon className={cn('text-white', iconSizes[size])} />
    </div>
  );
};

interface MetricCardProps {
  icon:     React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label:    string;
  value:    string | number;
  subtext?: string;
  variant?: VariantColor;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  icon, 
  label, 
  value, 
  subtext, 
  variant = 'green',
}) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
);

interface StatusBadgeProps {
  status: EmployeeStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<EmployeeStatus, { bg: string; text: string; label: string }> = {
    approved: { 
      bg:    'bg-green-100 dark:bg-green-500/20', 
      text:  'text-green-700 dark:text-green-300', 
      label: 'Active',
    },
    pending: { 
      bg:    'bg-slate-100 dark:bg-slate-500/20', 
      text:  'text-slate-700 dark:text-slate-300', 
      label: 'Pending',
    },
    rejected: { 
      bg:    'bg-slate-200 dark:bg-slate-600/20', 
      text:  'text-slate-800 dark:text-slate-400', 
      label: 'Rejected',
    },
    suspended: { 
      bg:    'bg-slate-100 dark:bg-slate-500/20', 
      text:  'text-slate-700 dark:text-slate-300', 
      label: 'Suspended',
    },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', bg, text)}>
      {label}
    </span>
  );
};

interface KYCBadgeProps {
  status: KYCStatus;
}

const KYCBadge: React.FC<KYCBadgeProps> = ({ status }) => {
  const config: Record<KYCStatus, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; bg: string }> = {
    approved: { 
      icon:  CheckCircle2, 
      color: 'text-green-600', 
      bg:    'bg-green-100 dark:bg-green-500/20',
    },
    pending: { 
      icon:  Clock, 
      color: 'text-slate-600', 
      bg:    'bg-slate-100 dark:bg-slate-500/20',
    },
    submitted: { 
      icon:  FileText, 
      color: 'text-slate-600', 
      bg:    'bg-slate-100 dark:bg-slate-500/20',
    },
    rejected: { 
      icon:  XCircle, 
      color: 'text-slate-600', 
      bg:    'bg-slate-200 dark:bg-slate-600/20',
    },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', bg)}>
      <Icon className={cn('w-3.5 h-3.5', color)} />
      <span className={color}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </div>
  );
};

interface FilterButtonProps {
  active:   boolean;
  onClick:  () => void;
  children: React.ReactNode;
}

const FilterButton: React.FC<FilterButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-4 py-2 rounded-xl text-sm font-medium transition-all',
      active 
        ? 'bg-green-600 text-white shadow-lg shadow-green-500/25'
        : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800',
    )}
  >
    {children}
  </button>
);

interface EmployeeRowProps {
  employee:       Employee;
  isSelected:     boolean;
  onToggleSelect: (id: string) => void;
  onViewDetails:  (employee: Employee) => void;
  onQuickAction:  (employee: Employee) => void;
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({ 
  employee, 
  isSelected, 
  onToggleSelect, 
  onViewDetails, 
  onQuickAction,
}) => (
  <div
    className={cn(
      'flex items-center gap-4 p-4 rounded-xl transition-colors group',
      isSelected 
        ? 'bg-green-50/80 dark:bg-green-900/20 ring-1 ring-green-300 dark:ring-green-700'
        : 'bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-800/60',
    )}
  >
    {/* Checkbox */}
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggleSelect(employee.id)}
      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer shrink-0"
      data-testid={`select-employee-${employee.id}`}
    />
    
    {/* Avatar */}
    <div className="w-11 h-11 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center shadow-md shrink-0">
      <span className="text-white font-bold text-sm">
        {employee.full_name.split(' ').map(n => n[0]).join('').toUpperCase() || 
         employee.job_title.charAt(0) || 'E'}
      </span>
    </div>
    
    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-white truncate">
        {employee.full_name || `Employee ${employee.employee_code}`}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {employee.job_title} {employee.employer_name ? `• ${employee.employer_name}` : ''}
      </p>
    </div>
    
    {/* Salary */}
    <div className="text-right hidden sm:block w-24 shrink-0">
      <p className="font-bold text-slate-900 dark:text-white">
        {formatCurrency(employee.monthly_salary)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Monthly</p>
    </div>
    
    {/* KYC Status */}
    <div className="hidden md:block w-28 shrink-0">
      <KYCBadge status={employee.kyc_status} />
    </div>
    
    {/* Status */}
    <div className="w-24 shrink-0">
      <StatusBadge status={employee.status} />
    </div>
    
    {/* Risk Score */}
    <div className="hidden lg:block text-center w-16 shrink-0">
      <p
        className={cn(
          'font-bold',
          employee.risk_score && employee.risk_score >= 4
            ? 'text-green-600'
            : employee.risk_score && employee.risk_score >= 3
            ? 'text-slate-600'
            : 'text-slate-700',
        )}
      >
        {employee.risk_score?.toFixed(1) || '-'}
      </p>
      <p className="text-xs text-slate-500">Risk</p>
    </div>
    
    {/* Actions */}
    <div className="flex items-center gap-1 w-20 justify-end shrink-0">
      <button 
        onClick={() => onViewDetails(employee)}
        className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
        title="View Details"
        data-testid={`view-employee-${employee.id}`}
      >
        <Eye className="w-4 h-4" />
      </button>
      <button 
        onClick={() => onQuickAction(employee)}
        className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
        title="Quick Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ─── Employee Detail Modal ────────────────────────────────────────────────────

interface EmployeeDetailModalProps {
  employee:  Employee | null;
  isOpen:    boolean;
  onClose:   () => void;
  onRefresh: () => void;
}

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ 
  employee, 
  isOpen, 
  onClose, 
  onRefresh,
}) => {
  const [activeTab,      setActiveTab]      = useState<TabKey>('overview');
  const [loading,        setLoading]        = useState(false);
  const [employeeDetail, setEmployeeDetail] = useState<Employee | null>(null);
  const [editMode,       setEditMode]       = useState(false);
  const [editData,       setEditData]       = useState<EditData>({
    job_title:       '',
    department:      '',
    monthly_salary:  0,
    employment_type: 'full-time',
  });
  const [riskOverride,   setRiskOverride]   = useState<RiskOverride>({ score: 3, reason: '' });
  const [showRiskModal,  setShowRiskModal]  = useState(false);

  useEffect(() => {
    if (isOpen && employee?.id) {
      fetchEmployeeDetail();
    }
  }, [isOpen, employee?.id]);

  const fetchEmployeeDetail = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      // GET /api/admin/employees/:id
      const res = await fetch(`/api/admin/employees/${employee.id}`);
      if (res.ok) {
        const data: Employee = await res.json();
        setEmployeeDetail(data);
        setEditData({
          job_title:       data.job_title || '',
          department:      data.department || '',
          monthly_salary:  data.monthly_salary || 0,
          employment_type: data.employment_type || 'full-time',
        });
        setRiskOverride({ score: data.risk_score || 3, reason: '' });
      }
    } catch (err) {
      toast.error('Failed to fetch employee details.');
      console.error('[EmployeeDetailModal] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: EmployeeStatus) => {
    if (!employee) return;

    try {
      // PATCH /api/admin/employees/:id/status
      const res = await fetch(`/api/admin/employees/${employee.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Employee status updated to ${newStatus}`);
        fetchEmployeeDetail();
        onRefresh();
      } else {
        toast.error('Failed to update status.');
      }
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleKYCChange = async (newStatus: KYCStatus) => {
    if (!employee) return;

    try {
      // PATCH /api/admin/employees/:id/kyc
      const res = await fetch(`/api/admin/employees/${employee.id}/kyc`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kyc_status: newStatus }),
      });

      if (res.ok) {
        toast.success(`KYC status updated to ${newStatus}`);
        fetchEmployeeDetail();
        onRefresh();
      } else {
        toast.error('Failed to update KYC status.');
      }
    } catch {
      toast.error('Failed to update KYC status.');
    }
  };

  const handleSaveEdit = async () => {
    if (!employee) return;

    try {
      // PUT /api/admin/employees/:id
      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editData),
      });

      if (res.ok) {
        toast.success('Employee updated successfully');
        setEditMode(false);
        fetchEmployeeDetail();
        onRefresh();
      } else {
        toast.error('Failed to update employee.');
      }
    } catch {
      toast.error('Failed to update employee.');
    }
  };

  const handleRiskOverride = async () => {
    if (!employee) return;

    try {
      // PATCH /api/admin/employees/:id/risk-score
      const res = await fetch(`/api/admin/employees/${employee.id}/risk-score`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          risk_score: riskOverride.score,
          reason:     riskOverride.reason,
        }),
      });

      if (res.ok) {
        toast.success('Risk score updated');
        setShowRiskModal(false);
        fetchEmployeeDetail();
        onRefresh();
      } else {
        toast.error('Failed to update risk score.');
      }
    } catch {
      toast.error('Failed to update risk score.');
    }
  };

  if (!isOpen) return null;

  const data = employeeDetail || employee;
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-green-600 to-green-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {data.full_name.split(' ').map(n => n[0]).join('').toUpperCase() || 'E'}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{data.full_name || 'Employee'}</h2>
                <p className="text-white/80 text-sm">
                  {data.job_title} {data.employer_name ? `• ${data.employer_name}` : ''}
                </p>
                <p className="text-white/60 text-xs mt-1">ID: {data.employee_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={data.status} />
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['overview', 'advances', 'kyc', 'actions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors capitalize',
                activeTab === tab
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 250px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Advance Stats */}
              {employeeDetail?.advance_stats && (
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {employeeDetail.advance_stats.advance_count}
                    </p>
                    <p className="text-xs text-slate-500">Total Advances</p>
                  </div>
                  <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(employeeDetail.advance_stats.total_advances)}
                    </p>
                    <p className="text-xs text-slate-500">Amount Advanced</p>
                  </div>
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl text-center">
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(employeeDetail.advance_stats.pending_repayment)}
                    </p>
                    <p className="text-xs text-slate-500">Pending Repayment</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(employeeDetail.advance_stats.total_fees_paid)}
                    </p>
                    <p className="text-xs text-slate-500">Fees Paid</p>
                  </div>
                </div>
              )}

              {/* Edit Mode */}
              {editMode ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Edit Employee
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={editData.job_title}
                        onChange={(e) => setEditData(prev => ({ ...prev, job_title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        value={editData.department}
                        onChange={(e) => setEditData(prev => ({ ...prev, department: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Salary (KES)</Label>
                      <Input
                        type="number"
                        value={editData.monthly_salary}
                        onChange={(e) => setEditData(prev => ({
                          ...prev,
                          monthly_salary: parseFloat(e.target.value) || 0,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Select
                        value={editData.employment_type}
                        onValueChange={(v: EmploymentType) => setEditData(prev => ({
                          ...prev,
                          employment_type: v,
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full Time</SelectItem>
                          <SelectItem value="part-time">Part Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* Info Grid */
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <User className="w-4 h-4" /> Personal Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">{data.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">{data.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          ID: {data.national_id || '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">{data.country || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Employment Details
                      <button
                        onClick={() => setEditMode(true)}
                        className="ml-auto text-green-600 hover:text-green-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Job Title</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {data.job_title || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Department</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {data.department || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Monthly Salary</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(data.monthly_salary)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Advance Limit</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(data.advance_limit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Earned Wages</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(data.earned_wages)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Score Section */}
              <div className="bg-linear-to-r from-green-50 to-green-50 dark:from-green-900/20 dark:to-green-900/20 rounded-xl p-5 border border-green-200/50 dark:border-green-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GradientIconBox icon={Shield} size="sm" variant="green" />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Risk Assessment
                      </h3>
                      <p className="text-xs text-slate-500">Current risk score and rating</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-3xl font-bold',
                        data.risk_score && data.risk_score >= 4
                          ? 'text-green-600'
                          : data.risk_score && data.risk_score >= 3
                          ? 'text-slate-600'
                          : 'text-slate-700',
                      )}
                    >
                      {data.risk_score?.toFixed(1) || '-'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.risk_score && data.risk_score >= 4
                        ? 'Low Risk'
                        : data.risk_score && data.risk_score >= 3
                        ? 'Medium Risk'
                        : 'High Risk'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowRiskModal(true)}
                >
                  <Shield className="w-4 h-4 mr-2" /> Override Risk Score
                </Button>
              </div>
            </div>
          ) : activeTab === 'advances' ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Advance History</h3>
              {!employeeDetail?.advances || employeeDetail.advances.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No advances found</div>
              ) : (
                <div className="space-y-3">
                  {employeeDetail.advances.map(adv => (
                    <div
                      key={adv.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-4"
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          adv.status === 'disbursed'
                            ? 'bg-green-100 dark:bg-green-500/20'
                            : adv.status === 'approved'
                            ? 'bg-slate-100 dark:bg-slate-500/20'
                            : 'bg-slate-100 dark:bg-slate-500/20',
                        )}
                      >
                        <CreditCard
                          className={cn(
                            'w-5 h-5',
                            adv.status === 'disbursed'
                              ? 'text-green-600'
                              : adv.status === 'approved'
                              ? 'text-slate-600'
                              : 'text-slate-600',
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(adv.amount)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(adv.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            adv.status === 'disbursed'
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                              : adv.status === 'approved'
                              ? 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300'
                              : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300',
                          )}
                        >
                          {adv.status.charAt(0).toUpperCase() + adv.status.slice(1)}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Fee: {formatCurrency(adv.fee_amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'kyc' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">KYC Status</h3>
                <KYCBadge status={data.kyc_status} />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: 'id_document_front' as const, label: 'ID Front' },
                  { key: 'id_document_back' as const, label: 'ID Back' },
                  { key: 'selfie' as const, label: 'Selfie' },
                  { key: 'address_proof' as const, label: 'Address Proof' },
                  { key: 'payslip_1' as const, label: 'Payslip 1' },
                  { key: 'payslip_2' as const, label: 'Payslip 2' },
                  { key: 'bank_statement' as const, label: 'Bank Statement' },
                  { key: 'employment_contract' as const, label: 'Employment Contract' },
                ].map(doc => (
                  <div
                    key={doc.key}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400">{doc.label}</span>
                    {data[doc.key] ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleKYCChange('approved')}
                  disabled={data.kyc_status === 'approved'}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve KYC
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-400 text-slate-700 hover:bg-slate-50"
                  onClick={() => handleKYCChange('rejected')}
                  disabled={data.kyc_status === 'rejected'}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject KYC
                </Button>
              </div>
            </div>
          ) : activeTab === 'actions' ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Account Actions</h3>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleStatusChange('approved')}
                  disabled={data.status === 'approved'}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    data.status === 'approved'
                      ? 'border-green-300 bg-green-50 dark:bg-green-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-green-300',
                  )}
                >
                  <CheckCircle2 className="w-6 h-6 text-green-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Activate Account</p>
                  <p className="text-xs text-slate-500">Enable EWA access for this employee</p>
                </button>

                <button
                  onClick={() => handleStatusChange('suspended')}
                  disabled={data.status === 'suspended'}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    data.status === 'suspended'
                      ? 'border-slate-400 bg-slate-100 dark:bg-slate-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  <Ban className="w-6 h-6 text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Suspend Account</p>
                  <p className="text-xs text-slate-500">Temporarily disable EWA access</p>
                </button>

                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={data.status === 'pending'}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    data.status === 'pending'
                      ? 'border-slate-300 bg-slate-50 dark:bg-slate-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300',
                  )}
                >
                  <Clock className="w-6 h-6 text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Set to Pending</p>
                  <p className="text-xs text-slate-500">Require re-verification</p>
                </button>

                <button
                  onClick={() => handleStatusChange('rejected')}
                  disabled={data.status === 'rejected'}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    data.status === 'rejected'
                      ? 'border-slate-400 bg-slate-100 dark:bg-slate-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  <XCircle className="w-6 h-6 text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Reject Account</p>
                  <p className="text-xs text-slate-500">Permanently deny EWA access</p>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Risk Override Modal */}
        {showRiskModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
            onClick={() => setShowRiskModal(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Override Risk Score
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Risk Score (0-5)</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[riskOverride.score]}
                      onValueChange={v => setRiskOverride(prev => ({ ...prev, score: v[0] }))}
                      max={5}
                      min={0}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xl font-bold w-12 text-right">
                      {riskOverride.score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Reason for Override</Label>
                  <Input
                    className="mt-2"
                    placeholder="Enter reason..."
                    value={riskOverride.reason}
                    onChange={(e) => setRiskOverride(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRiskModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleRiskOverride}
                >
                  Save Override
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Quick Actions Modal ──────────────────────────────────────────────────────

interface QuickActionsModalProps {
  employee: Employee | null;
  isOpen:   boolean;
  onClose:  () => void;
  onAction: (action: EmployeeStatus | 'kyc_approve') => void;
}

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ 
  employee, 
  isOpen, 
  onClose, 
  onAction,
}) => {
  if (!isOpen || !employee) return null;

  const actions: Array<{
    label:   string;
    action:  EmployeeStatus | 'kyc_approve';
    icon:    React.ComponentType<React.SVGProps<SVGSVGElement>>;
    color:   string;
  }> = [
    { label: 'Activate',    action: 'approved',     icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Suspend',     action: 'suspended',    icon: Ban,          color: 'text-slate-600' },
    { label: 'Set Pending', action: 'pending',      icon: Clock,        color: 'text-slate-600' },
    { label: 'Approve KYC', action: 'kyc_approve',  icon: FileText,     color: 'text-slate-600' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3 truncate">
          {employee.full_name || employee.employee_code}
        </p>
        <div className="space-y-1">
          {actions.map(({ label, action, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => onAction(action)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Icon className={cn('w-4 h-4', color)} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminEmployees() {
  const [employees,         setEmployees]         = useState<Employee[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [searchTerm,        setSearchTerm]        = useState('');
  const [statusFilter,      setStatusFilter]      = useState<EmployeeStatus | ''>('');
  const [kycFilter,         setKycFilter]         = useState<KYCStatus | ''>('');
  const [selectedEmployee,  setSelectedEmployee]  = useState<Employee | null>(null);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showQuickActions,  setShowQuickActions]  = useState(false);
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // ── Fetch employees ───────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/admin/employees (no employer_id filter → all employees)
      const res = await fetch('/api/admin/employees');
      if (res.ok) {
        const data: Employee[] = await res.json();
        setEmployees(data);
      } else {
        toast.error('Failed to fetch employees.');
      }
    } catch {
      toast.error('Failed to fetch employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Quick action handler ───────────────────────────────────────────────────
  const handleQuickAction = async (action: EmployeeStatus | 'kyc_approve') => {
    if (!selectedEmployee) return;

    try {
      if (action === 'kyc_approve') {
        // PATCH /api/admin/employees/:id/kyc
        const res = await fetch(`/api/admin/employees/${selectedEmployee.id}/kyc`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ kyc_status: 'approved' }),
        });
        if (res.ok) {
          toast.success('KYC approved');
        } else {
          toast.error('Action failed.');
        }
      } else {
        // PATCH /api/admin/employees/:id/status
        const res = await fetch(`/api/admin/employees/${selectedEmployee.id}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: action }),
        });
        if (res.ok) {
          toast.success(`Status updated to ${action}`);
        } else {
          toast.error('Action failed.');
        }
      }

      fetchEmployees();
    } catch {
      toast.error('Action failed.');
    }

    setShowQuickActions(false);
  };

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (actionType: EmployeeStatus | 'kyc_approve') => {
    if (selectedIds.size === 0) {
      toast.error('No employees selected');
      return;
    }
    
    setBulkActionLoading(true);

    let successCount = 0;
    let failCount    = 0;

    for (const id of selectedIds) {
      try {
        if (actionType === 'kyc_approve') {
          const res = await fetch(`/api/admin/employees/${id}/kyc`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ kyc_status: 'approved' }),
          });
          if (res.ok) successCount++;
          else failCount++;
        } else {
          const res = await fetch(`/api/admin/employees/${id}/status`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: actionType }),
          });
          if (res.ok) successCount++;
          else failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBulkActionLoading(false);
    setSelectedIds(new Set());
    fetchEmployees();

    if (failCount === 0) {
      toast.success(`Successfully updated ${successCount} employee(s)`);
    } else {
      toast.warning(`Updated ${successCount} employee(s), ${failCount} failed`);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredEmployees = employees.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (kycFilter && e.kyc_status !== kycFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        e.full_name.toLowerCase().includes(search) ||
        e.employee_code.toLowerCase().includes(search) ||
        e.job_title.toLowerCase().includes(search) ||
        e.employer_name?.toLowerCase().includes(search) ||
        e.email.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: Stats = {
    total:       employees.length,
    active:      employees.filter(e => e.status === 'approved').length,
    pending_kyc: employees.filter(e => e.kyc_status === 'submitted' || e.kyc_status === 'pending').length,
    suspended:   employees.filter(e => e.status === 'suspended').length,
  };

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-employees-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="admin-employees-title"
            >
              Employee Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage employee accounts, KYC, and risk scores
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-white/60 dark:bg-slate-800/60"
              onClick={fetchEmployees}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={Users}
            label="Total Employees"
            value={stats.total}
            subtext={`${stats.active} active`}
            variant="green"
          />
          <MetricCard 
            icon={UserCheck}
            label="Active Accounts"
            value={stats.active}
            subtext="Verified & approved"
            variant="green"
          />
          <MetricCard 
            icon={FileText}
            label="Pending KYC"
            value={stats.pending_kyc}
            subtext="Awaiting review"
            variant="slate"
          />
          <MetricCard 
            icon={Ban}
            label="Suspended"
            value={stats.suspended}
            subtext="Temporarily disabled"
            variant="slate"
          />
        </div>

        {/* Search & Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name, ID, email, job title, or employer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                data-testid="search-employees"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>
                All Status
              </FilterButton>
              <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>
                Active
              </FilterButton>
              <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>
                Pending
              </FilterButton>
              <FilterButton active={statusFilter === 'suspended'} onClick={() => setStatusFilter('suspended')}>
                Suspended
              </FilterButton>
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
              
              <Select
                value={kycFilter || 'all'}
                onValueChange={v => setKycFilter(v === 'all' ? '' : (v as KYCStatus))}
              >
                <SelectTrigger className="w-40 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="KYC Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All KYC</SelectItem>
                  <SelectItem value="approved">KYC Approved</SelectItem>
                  <SelectItem value="submitted">KYC Submitted</SelectItem>
                  <SelectItem value="pending">KYC Pending</SelectItem>
                  <SelectItem value="rejected">KYC Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div
            className="bg-green-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-green-500/25"
            data-testid="bulk-actions-bar"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 rounded-lg px-3 py-1.5 text-white font-semibold">
                {selectedIds.size} selected
              </span>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-white/70 hover:text-white text-sm underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('approved')}
                disabled={bulkActionLoading}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                data-testid="bulk-activate"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Activate All
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('suspended')}
                disabled={bulkActionLoading}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                data-testid="bulk-suspend"
              >
                <Ban className="w-4 h-4 mr-1.5" />
                Suspend All
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('kyc_approve')}
                disabled={bulkActionLoading}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                data-testid="bulk-kyc-approve"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Approve KYC
              </Button>
              {bulkActionLoading && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* Employees List */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No employees found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter || kycFilter
                  ? 'Try adjusting your search or filters'
                  : 'No employees have registered yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {/* Header */}
              <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer shrink-0"
                  data-testid="select-all-employees"
                />
                <div className="w-11" />
                <div className="flex-1">Employee</div>
                <div className="w-24 text-right hidden sm:block">Salary</div>
                <div className="w-28 hidden md:block">KYC Status</div>
                <div className="w-24">Status</div>
                <div className="w-16 text-center hidden lg:block">Risk</div>
                <div className="w-20" />
              </div>
              
              {filteredEmployees.map(employee => (
                <EmployeeRow 
                  key={employee.id} 
                  employee={employee}
                  isSelected={selectedIds.has(employee.id)}
                  onToggleSelect={toggleSelectOne}
                  onViewDetails={e => {
                    setSelectedEmployee(e);
                    setShowDetailModal(true);
                  }}
                  onQuickAction={e => {
                    setSelectedEmployee(e);
                    setShowQuickActions(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <EmployeeDetailModal 
        employee={selectedEmployee}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedEmployee(null);
        }}
        onRefresh={fetchEmployees}
      />

      {/* Quick Actions Modal */}
      <QuickActionsModal
        employee={selectedEmployee}
        isOpen={showQuickActions}
        onClose={() => {
          setShowQuickActions(false);
          setSelectedEmployee(null);
        }}
        onAction={handleQuickAction}
      />
    </AdminPortalLayout>
  );
}
