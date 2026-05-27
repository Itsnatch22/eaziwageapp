'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Search, Download, Users, Clock,
  MoreHorizontal, Eye, CheckCircle2, XCircle, X,
  Mail, Phone, Calendar, MapPin, FileText, Briefcase,
  Ban, RefreshCw, DollarSign,
} from 'lucide-react';
import { Input }                   from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { toast }                   from 'sonner';

type EmployerStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

type PayrollCycle = 'weekly' | 'biweekly' | 'monthly';

interface Employer {
  id:                  string;
  company_name:        string;
  employer_code:       string;
  industry:            string;
  country:             string;
  registration_number: string | null;
  tax_id:              string | null;
  address:             string | null;
  contact_person:      string | null;
  contact_email:       string;
  contact_phone:       string | null;
  payroll_cycle:       PayrollCycle | null;
  status:              EmployerStatus;
  employee_count:      number;
  total_advances:      number;
  monthly_payroll:     number;
  risk_score:          number | null;
  deleted_at:          string | null;
  created_at:          string;
  updated_at:          string;
}

interface Employee {
  id:             string;
  employer_id:    string;
  employee_code:  string;
  full_name:      string;
  job_title:      string;
  monthly_salary: number;
  status:         'active' | 'inactive' | 'pending';
}

interface Stats {
  total:           number;
  active:          number;
  pending:         number;
  total_employees: number;
}

interface EmployersApiResponse {
  data: Employer[];
  stats: Stats;
  filters?: {
    countries?: string[];
    industries?: string[];
  };
}

type TabKey = 'overview' | 'employees' | 'advances' | 'actions';

type VariantColor = 'green' | 'slate' | 'black';

interface GradientIconBoxProps {
  icon:    React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?:   'sm' | 'md' | 'lg';
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
  status: EmployerStatus | Employee['status'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
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
    active: { 
      bg:    'bg-green-100 dark:bg-green-500/20', 
      text:  'text-green-700 dark:text-green-300', 
      label: 'Active',
    },
    inactive: { 
      bg:    'bg-slate-100 dark:bg-slate-500/20', 
      text:  'text-slate-700 dark:text-slate-300', 
      label: 'Inactive',
    },
    termination_pending: {
      bg:    'bg-amber-100 dark:bg-amber-500/20',
      text:  'text-amber-700 dark:text-amber-300',
      label: 'Termination Pending',
    },
  };

  const { bg, text, label } = config[status] || config.pending;

  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', bg, text)}>
      {label}
    </span>
  );
};

interface RiskBadgeProps {
  score: number;
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ score }) => {
  const level = score >= 4 ? 'low' : score >= 2.5 ? 'medium' : 'high';

  const config = {
    low: { 
      bg:    'bg-green-100 dark:bg-green-500/20', 
      text:  'text-green-700 dark:text-green-300', 
      label: 'Low Risk',
    },
    medium: { 
      bg:    'bg-slate-100 dark:bg-slate-500/20', 
      text:  'text-slate-700 dark:text-slate-300', 
      label: 'Medium Risk',
    },
    high: { 
      bg:    'bg-slate-200 dark:bg-slate-600/20', 
      text:  'text-slate-800 dark:text-slate-400', 
      label: 'High Risk',
    },
  };

  const { bg, text, label } = config[level];

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', bg, text)}>
      {score.toFixed(1)} - {label}
    </span>
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

interface EmployerRowProps {
  employer:       Employer;
  currency:       string;
  isSelected:     boolean;
  onToggleSelect: (id: string) => void;
  onViewDetails:  (employer: Employer) => void;
  onQuickAction:  (employer: Employer) => void;
}

const EmployerRow: React.FC<EmployerRowProps> = ({ 
  employer, 
  currency,
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
      onChange={() => onToggleSelect(employer.id)}
      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer shrink-0"
    />
    
    {/* Avatar */}
    <div className="w-11 h-11 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center shadow-md shrink-0">
      <span className="text-white font-bold text-sm">
        {employer.company_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
      </span>
    </div>
    
    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-white truncate">
        {employer.company_name}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {employer.industry.replace('_', ' ')} • {employer.country}
      </p>
    </div>
    
    {/* Employee Count */}
    <div className="text-right hidden sm:block w-20 shrink-0">
      <p className="font-bold text-slate-900 dark:text-white">{employer.employee_count}</p>
      <p className="text-xs text-slate-500">Employees</p>
    </div>
    
    {/* Monthly Advances */}
    <div className="text-right hidden md:block w-28 shrink-0">
      <p className="font-bold text-green-600">{formatCurrency(employer.total_advances, currency)}</p>
      <p className="text-xs text-slate-500">Advances</p>
    </div>
    
    {/* Risk Score */}
    <div className="hidden lg:block w-28">
      {employer.risk_score ? (
        <RiskBadge score={employer.risk_score} />
      ) : (
        <span className="text-slate-400 text-sm">-</span>
      )}
    </div>
    
    {/* Status */}
    <div className="w-24">
      <StatusBadge status={employer.status} />
    </div>
    
    {/* Actions */}
    <div className="flex items-center gap-1 w-20 justify-end">
      <button 
        onClick={() => onViewDetails(employer)}
        className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
        title="View Details"
        data-testid={`view-employer-${employer.id}`}
      >
        <Eye className="w-4 h-4" />
      </button>
      <button 
        onClick={() => onQuickAction(employer)}
        className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
        title="Quick Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  </div>
);

interface EmployerDetailModalProps {
  employer:  Employer | null;
  currency:  string;
  isOpen:    boolean;
  onClose:   () => void;
  onRefresh: () => void;
}

const EmployerDetailModal: React.FC<EmployerDetailModalProps> = ({ 
  employer, 
  currency,
  isOpen, 
  onClose, 
  onRefresh, 
}) => {
  const [activeTab,      setActiveTab]      = useState<TabKey>('overview');
  const [loading,        setLoading]        = useState(false);
  const [employerDetail, setEmployerDetail] = useState<Employer | null>(null);
  const [employees,      setEmployees]      = useState<Employee[]>([]);

  const fetchEmployerDetail = useCallback(async () => {
    if (!employer) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employers/${employer.id}`);
      if (res.ok) {
        const data: Employer = await res.json();
        setEmployerDetail(data);
      }

      const empRes = await fetch(`/api/admin/employees?employer_id=${employer.id}`);
      if (empRes.ok) {
        const empPayload = await empRes.json();
        const empData: Employee[] = Array.isArray(empPayload) ? empPayload : (empPayload.data ?? []);
        // The API already filters by employer_id, so we can set it directly
        setEmployees(empData);
      }
    } catch (err) {
      console.error('[EmployerDetailModal] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [employer]);

  useEffect(() => {
    if (isOpen && employer?.id) {
      fetchEmployerDetail();
    }
  }, [isOpen, employer?.id, fetchEmployerDetail]);

  const handleStatusChange = async (newStatus: EmployerStatus) => {
    if (!employer) return;

    try {
      // PATCH /api/admin/employers/:id/status
      const res = await fetch(`/api/admin/employers/${employer.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Employer ${newStatus}`);
        fetchEmployerDetail();
        onRefresh();
      } else {
        toast.error('Failed to update status.');
      }
    } catch {
      toast.error('Failed to update status.');
    }
  };

  if (!isOpen) return null;

  const data = employerDetail || employer;
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
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{data.company_name}</h2>
                <p className="text-white/80 text-sm">
                  {data.industry.replace('_', ' ')} • {data.country}
                </p>
                <p className="text-white/60 text-xs mt-1">Code: {data.employer_code}</p>
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
          {(['overview', 'employees', 'advances', 'actions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors capitalize',
                activeTab === tab
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-slate-500 hover:text-slate-700',
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
              {/* Stats */}
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">{data.employee_count}</p>
                  <p className="text-xs text-slate-500">Total Employees</p>
                </div>
                <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.total_advances, currency)}
                  </p>
                  <p className="text-xs text-slate-500">Total Advances</p>
                </div>
                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(data.monthly_payroll, currency)}
                  </p>
                  <p className="text-xs text-slate-500">Monthly Payroll</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      data.risk_score && data.risk_score >= 4
                        ? 'text-green-600'
                        : data.risk_score && data.risk_score >= 2.5
                        ? 'text-slate-600'
                        : 'text-slate-700',
                    )}
                  >
                    {data.risk_score?.toFixed(1) || '-'}
                  </p>
                  <p className="text-xs text-slate-500">Risk Score</p>
                </div>
              </div>

              {/* Details */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Company Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-32">Reg. Number</span>
                      <span className="text-slate-900 dark:text-white">
                        {data.registration_number || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-32">Tax ID</span>
                      <span className="text-slate-900 dark:text-white">{data.tax_id || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-32">Address</span>
                      <span className="text-slate-900 dark:text-white">{data.address || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-32">Payroll Cycle</span>
                      <span className="text-slate-900 dark:text-white capitalize">
                        {data.payroll_cycle || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4" /> Contact Person
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900 dark:text-white">
                        {data.contact_person || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {data.contact_email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {data.contact_phone || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-24">Registered</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {formatDateTime(data.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'employees' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Employees ({employees.length})
                </h3>
              </div>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No employees found</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {employees.slice(0, 20).map(emp => (
                    <div
                      key={emp.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-3"
                    >
                      <div className="w-9 h-9 bg-linear-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {emp.full_name?.charAt(0) || emp.employee_code?.charAt(0) || 'E'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                          {emp.full_name || emp.employee_code}
                        </p>
                        <p className="text-xs text-slate-500">
                          {emp.job_title} • {formatCurrency(emp.monthly_salary, currency)}
                        </p>
                      </div>
                      <StatusBadge status={emp.status} />
                    </div>
                  ))}
                  {employees.length > 20 && (
                    <p className="text-center text-sm text-slate-500 py-2">
                      +{employees.length - 20} more employees
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'advances' ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Advances</h3>
              <div className="text-center py-8 text-slate-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Advance data available in detailed reports</p>
              </div>
            </div>
          ) : activeTab === 'actions' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Account Actions</h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  Current Status: <span className="capitalize text-primary">{data.status}</span>
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleStatusChange('approved')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group',
                    data.status === 'approved'
                      ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-green-300',
                  )}
                >
                  {data.status === 'approved' && (
                    <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                  )}
                  <CheckCircle2 className="w-6 h-6 text-green-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Approve</p>
                  <p className="text-xs text-slate-500">Activate employer account</p>
                </button>

                <button
                  onClick={() => handleStatusChange('suspended')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group',
                    data.status === 'suspended'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300',
                  )}
                >
                  {data.status === 'suspended' && (
                    <div className="absolute top-2 right-2">
                        <Ban className="w-4 h-4 text-orange-600" />
                    </div>
                  )}
                  <Ban className="w-6 h-6 text-orange-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Suspend</p>
                  <p className="text-xs text-slate-500">Temporarily disable account</p>
                </button>

                <button
                  onClick={() => handleStatusChange('rejected')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group',
                    data.status === 'rejected'
                      ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-red-300',
                  )}
                >
                  {data.status === 'rejected' && (
                    <div className="absolute top-2 right-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                  )}
                  <XCircle className="w-6 h-6 text-red-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Reject</p>
                  <p className="text-xs text-slate-500">Deny employer application</p>
                </button>

                <button
                  onClick={() => handleStatusChange('pending')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group',
                    data.status === 'pending'
                      ? 'border-slate-500 bg-slate-50 dark:bg-slate-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  {data.status === 'pending' && (
                    <div className="absolute top-2 right-2">
                        <Clock className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  <Clock className="w-6 h-6 text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-900 dark:text-white">Set Pending</p>
                  <p className="text-xs text-slate-500">Require re-verification</p>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ─── Quick Actions Modal ──────────────────────────────────────────────────────

interface QuickActionsModalProps {
  employer: Employer | null;
  isOpen:   boolean;
  onClose:  () => void;
  onAction: (status: EmployerStatus) => void;
}

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ 
  employer, 
  isOpen, 
  onClose, 
  onAction,
}) => {
  if (!isOpen || !employer) return null;

  const actions: Array<{
    label:  string;
    status: EmployerStatus;
    icon:   React.ComponentType<React.SVGProps<SVGSVGElement>>;
    color:  string;
  }> = [
    { label: 'Approve',     status: 'approved',   icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Suspend',     status: 'suspended',  icon: Ban,          color: 'text-slate-600' },
    { label: 'Reject',      status: 'rejected',   icon: XCircle,      color: 'text-slate-600' },
    { label: 'Set Pending', status: 'pending',    icon: Clock,        color: 'text-slate-600' },
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
          {employer.company_name}
        </p>
        <div className="space-y-1">
          {actions.map(({ label, status, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => onAction(status)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors group',
                employer.status === status && 'bg-slate-50 dark:bg-slate-800 border-l-4 border-primary',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('w-4 h-4', color)} />
                <span className={cn(employer.status === status && 'font-bold text-primary')}>
                    {label}
                </span>
              </div>
              {employer.status === status && (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminEmployers() {
  const { currency } = useCurrency();
  const [employers,         setEmployers]         = useState<Employer[]>([]);
  const [stats,             setStats]             = useState<Stats>({
    total: 0,
    active: 0,
    pending: 0,
    total_employees: 0,
  });
  const [countries,         setCountries]         = useState<string[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [searchTerm,        setSearchTerm]        = useState('');
  const [debouncedSearch,   setDebouncedSearch]   = useState('');
  const [statusFilter,      setStatusFilter]      = useState<EmployerStatus | ''>('');
  const [countryFilter,     setCountryFilter]     = useState('');
  const [selectedEmployer,  setSelectedEmployer]  = useState<Employer | null>(null);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showQuickActions,  setShowQuickActions]  = useState(false);
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Fetch employers ───────────────────────────────────────────────────────
  const fetchEmployers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (countryFilter) params.set('country', countryFilter);

      const res = await fetch(`/api/admin/employers${params.toString() ? `?${params.toString()}` : ''}`);
      if (res.ok) {
        const payload = await res.json();

        if (Array.isArray(payload)) {
          const data = payload as Employer[];
          setEmployers(data);
          setStats({
            total: data.length,
            active: data.filter((e) => e.status === 'approved').length,
            pending: data.filter((e) => e.status === 'pending').length,
            total_employees: data.reduce((sum, e) => sum + e.employee_count, 0),
          });
          setCountries([...new Set(data.map((e) => e.country).filter(Boolean))]);
        } else {
          const data = payload as EmployersApiResponse;
          const employers = data.data || [];
          setEmployers(employers);
          setStats(data.stats);
          setCountries(
            data.filters?.countries ??
            [...new Set(employers.map((e) => e.country).filter(Boolean))],
          );
        }
      } else {
        toast.error('Failed to fetch employers.');
      }
    } catch {
      toast.error('Failed to fetch employers.');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchEmployers();
  }, [fetchEmployers]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, statusFilter, countryFilter]);

  // ── Quick action handler ───────────────────────────────────────────────────
  const handleQuickAction = async (newStatus: EmployerStatus) => {
    if (!selectedEmployer) return;

    try {
      // PATCH /api/admin/employers/:id/status
      const res = await fetch(`/api/admin/employers/${selectedEmployer.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Employer ${newStatus}`);
        fetchEmployers();
      } else {
        toast.error('Action failed.');
      }
    } catch {
      toast.error('Action failed.');
    }

    setShowQuickActions(false);
  };

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === employers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employers.map(e => e.id)));
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

  const handleBulkAction = async (actionType: EmployerStatus) => {
    if (selectedIds.size === 0) {
      toast.error('No employers selected');
      return;
    }
    
    setBulkActionLoading(true);

    let successCount = 0;
    for (const id of selectedIds) {
      try {
        // PATCH /api/admin/employers/:id/status
        const res = await fetch(`/api/admin/employers/${id}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: actionType }),
        });

        if (res.ok) successCount++;
      } catch {
         //Continue bulk operation
      }
    }

    setBulkActionLoading(false);
    setSelectedIds(new Set());
    fetchEmployers();
    toast.success(`Successfully updated ${successCount} employer(s)`);
  };

    return (
    <>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-employers-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="admin-employers-title"
            >
              Employer Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage employer accounts and verifications
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 dark:bg-slate-800/60"
              onClick={fetchEmployers}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </button>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 dark:bg-slate-800/60"
            >
              <Download className="w-4 h-4 mr-2" /> Export
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Building2} label="Total Employers" value={stats.total} variant="green" />
          <MetricCard icon={CheckCircle2} label="Active Employers" value={stats.active} variant="green" />
          <MetricCard icon={Clock} label="Pending Approval" value={stats.pending} variant="slate" />
          <MetricCard icon={Users} label="Total Employees" value={stats.total_employees} variant="slate" />
        </div>

        {/* Search & Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by company name or email"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                data-testid="search-employers"
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
              <FilterButton active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')}>
                Rejected
              </FilterButton>
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
              
              <Select
                value={countryFilter || 'all'}
                onValueChange={v => setCountryFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-40 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
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
              <button
                onClick={() => handleBulkAction('approved')}
                disabled={bulkActionLoading}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 dark:bg-slate-800/60"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve All
              </button>
              <button
                onClick={() => handleBulkAction('suspended')}
                disabled={bulkActionLoading}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 dark:bg-slate-800/60"
              >
                <Ban className="w-4 h-4 mr-1.5" /> Suspend All
              </button>
              {bulkActionLoading && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* Employers List */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
          ) : employers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No employers found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {searchTerm || statusFilter || countryFilter
                  ? 'Try adjusting your search or filters'
                  : 'No employers have registered yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {/* Header */}
              <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedIds.size === employers.length && employers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
                <div className="w-11" />
                <div className="flex-1">Company</div>
                <div className="w-20 text-right">Employees</div>
                <div className="w-28 text-right">Advances</div>
                <div className="w-28">Risk</div>
                <div className="w-24">Status</div>
                <div className="w-20" />
              </div>
              
              {employers.map(employer => (
                <EmployerRow 
                  key={employer.id} 
                  employer={employer}
                  currency={currency}
                  isSelected={selectedIds.has(employer.id)}
                  onToggleSelect={toggleSelectOne}
                  onViewDetails={e => {
                    setSelectedEmployer(e);
                    setShowDetailModal(true);
                  }}
                  onQuickAction={e => {
                    setSelectedEmployer(e);
                    setShowQuickActions(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {employers.length > 0 && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing {employers.length} of {stats.total} employers
          </div>
        )}
      </div>

      {/* Modals */}
      <EmployerDetailModal 
        employer={selectedEmployer}
        currency={currency}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedEmployer(null);
        }}
        onRefresh={fetchEmployers}
      />

      <QuickActionsModal
        employer={selectedEmployer}
        isOpen={showQuickActions}
        onClose={() => {
          setShowQuickActions(false);
          setSelectedEmployer(null);
        }}
        onAction={handleQuickAction}
      />
    </>
  );
}


