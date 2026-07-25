'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { RISK_SCORE } from '@/lib/constants/employer-schema';
import { 
  Shield, Calculator, Building2, Search,
  TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, Info,
  DollarSign, Users, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { StatTilesSkeleton, TableSkeleton } from '@/components/shared/Skeletons';

interface Employer {
  id: string;
  company_name: string;
  employer_code: string;
  industry: string;
  sector: string;
  country: string;
  city?: string;
  contact_email: string;
  contact_person: string | null;
  status: 'approved' | 'pending' | 'rejected' | 'suspended' | 'risk_review_in_progress';
  risk_score: number;
  risk_rating: 'A' | 'B' | 'C' | 'D';
  application_fee: number;
  risk_scored_at: string | null;
  has_risk_factors: boolean;
  employee_count: number;
  total_advances: number;
  monthly_payroll: number;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  rejected: number;
  risk_review: number;
  total_employees: number;
  risk_distribution: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    very_high_risk: number;
  };
  risk_stats: number[]; 
  avg_risk_score: number;
  avg_application_fee: number;
  needs_risk_assessment: number;
  base_currency: string;
}

interface ApiResponse {
  data: Employer[];
  stats: Stats;
  filters: {
    countries: string[];
    industries: string[];
    risk_ratings: string[];
    statuses: string[];
  };
  framework: {
    version: string;
    date: string;
    base_fee: number;
    risk_factor: number;
    rating_thresholds?: { low: number; medium: number };
  };
}

interface GradientIconBoxProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'purple' | 'green' | 'amber' | 'red' | 'blue';
}

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' };
  const variants = {
    purple: 'from-purple-600 to-purple-700',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600'
  };
  
  return (
    <div className={cn(
      "rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg",
      sizes[size], variants[variant]
    )}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

interface MetricCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: number | string;
  subtext?: string;
  variant?: 'purple' | 'green' | 'amber' | 'red' | 'blue';
  trend?: { value: number; isPositive: boolean };
}

const MetricCard = ({ icon, label, value, subtext, variant = 'purple', trend }: MetricCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trend.isPositive 
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
        )}>
          {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
);

interface RiskRatingBadgeProps {
  rating: 'A' | 'B' | 'C' | 'D';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const RiskRatingBadge = ({ rating, size = 'sm', showLabel = false }: RiskRatingBadgeProps) => {
  const config = {
    A: { label: 'Low Risk', color: 'bg-emerald-500 text-white', bgColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
    B: { label: 'Medium Risk', color: 'bg-blue-500 text-white', bgColor: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
    C: { label: 'High Risk', color: 'bg-amber-500 text-white', bgColor: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
    D: { label: 'Very High Risk', color: 'bg-red-500 text-white', bgColor: 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  };

  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  const cfg = config[rating as keyof typeof config] ?? { label: 'Unknown', color: 'bg-slate-400 text-white', bgColor: 'bg-slate-100 text-slate-700' };
  const { label, color, bgColor } = cfg;

  if (showLabel) {
    return (
      <span className={cn("px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1", bgColor)}>
        <span className={cn("rounded-full flex items-center justify-center font-bold", sizeClasses, color)}>
          {rating}
        </span>
        {label}
      </span>
    );
  }

  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold shadow-sm", sizeClasses, color)}>
      {rating}
    </div>
  );
};

interface StatusBadgeProps {
  status: 'approved' | 'pending' | 'rejected' | 'suspended' | 'risk_review_in_progress';
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = {
    approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
    suspended: { label: 'Suspended', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
    risk_review_in_progress: { label: 'Risk Review', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  };

  const cfg = config[status as keyof typeof config] ?? { label: status, color: 'bg-slate-100 text-slate-700' };

  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", cfg.color)}>
      {cfg.label}
    </span>
  );
};

interface RiskAssessmentModalProps {
  employer: Employer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  framework: ApiResponse['framework'] | null;
}

const RiskAssessmentModal = ({ employer, isOpen, onClose, onSuccess, framework }: RiskAssessmentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState({
    registration_status: 3,
    tax_compliance: 3,
    ewa_agreement: 3,
    audited_financials: 3,
    liquidity_ratio: 3,
    payroll_sustainability: 3,
    employee_count: 3,
    churn_rate: 3,
    payroll_integration: 3,
    industry_risk: 3,
    regulatory_exposure: 3,
    beneficial_ownership: 3,
    pep_screening: 3,
  });
  const [overrideReason, setOverrideReason] = useState('');

  const handleClose = () => {
    setOverrideReason('');
    onClose();
  };

  const categories = [
    {
      label: 'Legal & Compliance (20%)',
      factors: [
        { id: 'registration_status', label: 'Registration Status', weight: 0.10 },
        { id: 'tax_compliance', label: 'Tax Compliance', weight: 0.07 },
        { id: 'ewa_agreement', label: 'EWA Agreement', weight: 0.03 },
      ]
    },
    {
      label: 'Financial Health (35%)',
      factors: [
        { id: 'audited_financials', label: 'Audited Financials', weight: 0.15 },
        { id: 'liquidity_ratio', label: 'Liquidity Ratio', weight: 0.10 },
        { id: 'payroll_sustainability', label: 'Payroll Sustainability', weight: 0.10 },
      ]
    },
    {
      label: 'Operational Dynamics (20%)',
      factors: [
        { id: 'employee_count', label: 'Employee Count', weight: 0.05 },
        { id: 'churn_rate', label: 'Churn Rate', weight: 0.05 },
        { id: 'payroll_integration', label: 'Payroll Integration', weight: 0.10 },
      ]
    },
    {
      label: 'Sector & Regulatory (15%)',
      factors: [
        { id: 'industry_risk', label: 'Industry Risk', weight: 0.10 },
        { id: 'regulatory_exposure', label: 'Regulatory Exposure', weight: 0.05 },
      ]
    },
    {
      label: 'AML / Transparency (10%)',
      factors: [
        { id: 'beneficial_ownership', label: 'Beneficial Ownership', weight: 0.05 },
        { id: 'pep_screening', label: 'PEP Screening', weight: 0.05 },
      ]
    }
  ];

  const calculateScore = () => {
    let total = 0;
    categories.forEach(cat => {
      cat.factors.forEach(f => {
        // ?? not || — a factor explicitly set to its worst value (0) must
        // count as 0, not silently fall back to the neutral default. The
        // slider itself is currently clamped to min="1" so this can't fire
        // through today's UI, but `factors` state has no other guard against
        // a future 0 (a lowered slider min, or hydrating from a saved
        // assessment) being swallowed here.
        total += (factors[f.id as keyof typeof factors] ?? 3) * f.weight;
      });
    });
    return Math.max(0, Math.min(5, total));
  };

  const getRating = (score: number) => {
    const low = framework?.rating_thresholds?.low ?? 4.0;
    const medium = framework?.rating_thresholds?.medium ?? 3.0;
    if (score >= low) return 'A';
    if (score >= medium) return 'B';
    if (score >= medium - 0.4) return 'C';
    return 'D';
  };

  const calculateFee = (score: number) => {
    const bf = framework?.base_fee ?? 3.5;
    const rf = framework?.risk_factor ?? 3.0;
    return bf + (rf * (1 - score / 5));
  };

  const currentScore = calculateScore();
  const currentRating = getRating(currentScore);
  const currentFee = calculateFee(currentScore);

  const handleSubmit = async () => {
    if (!employer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employers/${employer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risk_score: currentScore,
          risk_rating: currentRating,
          risk_factors: factors,
          override_reason: overrideReason.trim() || undefined,
        })
      });

      if (!res.ok) throw new Error('Update failed');
      
      toast.success('Risk assessment saved successfully');
      onSuccess();
      handleClose();
    } catch {
      toast.error('Failed to save assessment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-purple-600 to-purple-700 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Risk Assessment</h2>
              <p className="text-purple-100 text-sm mt-1">{employer.company_name} ({employer.employer_code})</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-white hover:bg-white/10">
              <XCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {categories.map((cat, idx) => (
              <div key={idx} className="space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">{cat.label}</h3>
                <div className="space-y-4">
                  {cat.factors.map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <label className="font-medium text-slate-700 dark:text-slate-300">{f.label}</label>
                        <span className="text-slate-500 font-bold">{factors[f.id as keyof typeof factors]}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="0.5"
                        value={factors[f.id as keyof typeof factors]}
                        onChange={(e) => setFactors({...factors, [f.id]: parseFloat(e.target.value)})}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-6 sticky top-0">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-600" />
                Assessment Results
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Composite Score</p>
                  <p className="text-3xl font-black text-purple-600">{currentScore.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Weighted Sum</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-500 mb-2 uppercase font-bold">Risk Rating</p>
                  <RiskRatingBadge rating={currentRating} size="md" />
                </div>
              </div>

              <div className="p-4 bg-linear-to-br from-purple-600/10 to-purple-600/10 rounded-xl border border-purple-200 dark:border-purple-800/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fee Impact</span>
                  <span className="text-lg font-bold text-purple-600">{currentFee.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 transition-all duration-500" style={{ width: `${(currentFee / 6.5) * 100}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Fee formula: {framework?.base_fee}% + ({framework?.risk_factor}% × (1 - Score/5))
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Manual Override Note (optional)
                  </label>
                  <Input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why you tuned this employer's risk profile"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <Button 
                  className="w-full h-12 bg-linear-to-r from-purple-600 to-purple-700 text-white font-bold rounded-xl"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Complete Assessment'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={handleClose}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminRiskScoringPage() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'employers' | 'employees'>('employers');

  const [employers, setEmployers] = useState<Employer[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<ApiResponse['filters'] | null>(null);
  const [framework, setFramework] = useState<ApiResponse['framework'] | null>(null);
  
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showEmployeeAssessment, setShowEmployeeAssessment] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [riskRatingFilter, setRiskRatingFilter] = useState<string>('');
  
  const [sortField, setSortField] = useState<keyof Employer | keyof any>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchEmployers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (countryFilter) params.append('country', countryFilter);
      if (riskRatingFilter) params.append('risk_rating', riskRatingFilter);

      const response = await fetch(`/api/admin/employers?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch employers');
      const data: ApiResponse = await response.json();
      setEmployers(data.data);
      setStats(data.stats);
      setFilters(data.filters);
      setFramework(data.framework);
    } catch (error) {
      console.error('Error fetching employers:', error);
      toast.error('Failed to load employers');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, countryFilter, riskRatingFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/admin/employees?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      const payload = await response.json();
      setEmployees(payload.data || []);
      // keep stats as-is; the employers endpoint populates the dashboard stats
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (activeSection === 'employers') void fetchEmployers();
    else void fetchEmployees();
  }, [activeSection, fetchEmployers, fetchEmployees]);

  useEffect(() => {
    const delay = searchTerm.length >= 2 ? 500 : 0;
    const timeoutId = window.setTimeout(() => {
      if (activeSection === 'employers') fetchEmployers();
      else fetchEmployees();
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, countryFilter, riskRatingFilter, activeSection, fetchEmployers, fetchEmployees]);

  useRealtimeRefresh(
    [{ table: 'employer_onboarding' }, { table: 'employers' }, { table: 'employee_onboarding' }, { table: 'employees' }],
    () => {
      if (activeSection === 'employers') fetchEmployers(); else fetchEmployees();
    },
  );

  const handleSort = (field: keyof Employer | keyof any) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedEmployers = [...employers].sort((a, b) => {
    const aValue = a[sortField as keyof Employer];
    const bValue = b[sortField as keyof Employer];
    const modifier = sortDirection === 'asc' ? 1 : -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue) * modifier;
    if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * modifier;
    return 0;
  });

  const sortedEmployees = [...employees].sort((a, b) => {
    const aValue = a[sortField as keyof any];
    const bValue = b[sortField as keyof any];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue) * modifier;
    if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * modifier;
    return 0;
  });

  const handleAssessRisk = (employer: Employer) => {
    setSelectedEmployer(employer);
    setShowAssessment(true);
  };

  const handleAssessEmployee = (employee: any) => {
    setSelectedEmployee(employee);
    setShowEmployeeAssessment(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <StatTilesSkeleton count={4} />
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 overflow-hidden">
          <TableSkeleton rows={6} columns={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Risk Scoring & Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Analyze and assess partner risk profiles based on EaziWage Framework</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setActiveSection('employers')}
              className={cn('px-3 py-1.5 rounded-full font-medium text-sm', activeSection === 'employers' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-600')}
            >
              Employers
            </button>
            <button
              onClick={() => setActiveSection('employees')}
              className={cn('px-3 py-1.5 rounded-full font-medium text-sm', activeSection === 'employees' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-600')}
            >
              Employees
            </button>
          </div>

          {framework && (
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium">Framework {framework.version} ({framework.date})</span>
          )}

          <Button variant="outline" size="sm" onClick={() => { if (activeSection === 'employers') fetchEmployers(); else fetchEmployees(); }} className="flex items-center gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Building2} label="Total Employers" value={stats.total} subtext={`${stats.active} approved, ${stats.risk_review || 0} in review`} variant="purple" />
          <MetricCard icon={Users} label="Total Employees" value={stats.total_employees.toLocaleString()} subtext="Across all platforms" variant="blue" />
          <MetricCard icon={Shield} label="Avg Risk Score" value={stats.avg_risk_score.toFixed(2)} subtext="Composite rating index" variant="green" />
          <MetricCard icon={DollarSign} label="Avg Fee Rate" value={`${stats.avg_application_fee.toFixed(2)}%`} subtext="Based on current risk" variant="amber" />
        </div>
      )}

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="text" placeholder={activeSection === 'employers' ? 'Search employers...' : 'Search employees...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl" />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {filters?.statuses.map((status) => (<SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={riskRatingFilter} onValueChange={setRiskRatingFilter}>
            <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl"><SelectValue placeholder="All Risk Ratings" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Ratings</SelectItem>
              {filters?.risk_ratings.map((rating) => (<SelectItem key={rating} value={rating}>Rating {rating}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {filters?.countries.map((country) => (
                <SelectItem key={country} value={country}>{country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeSection === 'employers' ? (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            {/* existing employers table (unchanged) */}
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-0">
                  <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 h-12" onClick={() => handleSort('company_name')}>
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">Company {sortField === 'company_name' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Country</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50" onClick={() => handleSort('risk_score')}>
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">Score {sortField === 'risk_score' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Rating</TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50" onClick={() => handleSort('application_fee')}>
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">App Fee {sortField === 'application_fee' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmployers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">No employers found</p>
                          <p className="text-sm text-slate-400">Try adjusting your filters or search criteria</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEmployers.map((employer) => (
                    <TableRow key={employer.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-500/5 group border-slate-100 dark:border-slate-800">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-linear-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shadow-purple-600/20">{employer.company_name.substring(0, 2).toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">{employer.company_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{employer.employer_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 font-medium">{employer.country || '-'}</TableCell>
                      <TableCell><StatusBadge status={employer.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-black text-sm", employer.risk_score >= RISK_SCORE.THRESHOLDS.HIGH ? "text-emerald-600" : employer.risk_score >= 3.0 ? "text-blue-600" : employer.risk_score >= 2.6 ? "text-amber-600" : (employer.risk_score === 0 ? "text-slate-400" : "text-red-600"))}>{employer.risk_score > 0 ? employer.risk_score.toFixed(2) : '-'}</span>
                          {(!employer.has_risk_factors || employer.status === 'risk_review_in_progress') && (<div className="animate-pulse" title="Assessment needed"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></div>)}
                        </div>
                      </TableCell>
                      <TableCell>{employer.risk_score > 0 ? (<RiskRatingBadge rating={employer.risk_rating} showLabel />) : (<span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">In Progress</span>)}</TableCell>
                      <TableCell className="font-bold text-purple-600 text-sm">{employer.risk_score > 0 ? `${employer.application_fee.toFixed(2)}%` : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button className="h-9 px-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all font-bold text-xs rounded-lg shadow-sm" onClick={() => handleAssessRisk(employer)}>
                          <Shield className="w-3.5 h-3.5 mr-2" /> Assess Risk
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-0">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Employee</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Employer</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50" onClick={() => handleSort('risk_score')}><div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">Score {sortField === 'risk_score' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Rating</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">App Fee</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                          <Users className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">No employees found</p>
                          <p className="text-sm text-slate-400">Try adjusting your filters or search criteria</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/5 group border-slate-100 dark:border-slate-800">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-xs">{(employee.full_name || 'E').substring(0,2).toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{employee.full_name || 'Employee'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{employee.email || employee.id}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 font-medium">{employee.employer_name ?? employee.employer_id ?? '-'}</TableCell>
                      <TableCell><StatusBadge status={employee.status ?? 'pending'} /></TableCell>
                      <TableCell><span className={cn('font-black text-sm', employee.risk_score >= RISK_SCORE.THRESHOLDS.HIGH ? 'text-emerald-600' : employee.risk_score >= 3 ? 'text-blue-600' : 'text-red-600')}>{employee.risk_score ? employee.risk_score.toFixed(2) : '-'}</span></TableCell>
                      <TableCell>{employee.risk_rating ? <RiskRatingBadge rating={employee.risk_rating} showLabel /> : <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">N/A</span>}</TableCell>
                      <TableCell className="font-bold text-purple-600 text-sm">{employee.application_fee ? `${employee.application_fee.toFixed(2)}%` : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button className="h-9 px-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all font-bold text-xs rounded-lg shadow-sm" onClick={() => handleAssessEmployee(employee)}>
                          <Shield className="w-3.5 h-3.5 mr-2" /> Assess Risk
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {framework && (
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0"><Info className="w-5 h-5 text-blue-600" /></div>
            <div className="text-sm">
              <p className="font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Framework & Regulatory Notice ({framework.version})</p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">Risk scores are dynamic and weighted across five core categories. The fee impact is automatically calculated using the framework standard: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mx-1 text-purple-600">Base({framework.base_fee}%) + Risk({framework.risk_factor}%) × (1 - Score/5)</span>. Assessments should be reviewed quarterly or upon significant operational changes.</p>
            </div>
          </div>
        </div>
      )}

      <RiskAssessmentModal key={selectedEmployer?.id ?? 'closed'} employer={selectedEmployer} isOpen={showAssessment} onClose={() => { setShowAssessment(false); setSelectedEmployer(null); }} onSuccess={fetchEmployers} framework={framework} />

      {showEmployeeAssessment && selectedEmployee && (
        <EmployeeRiskAssessmentModal
          employee={selectedEmployee}
          isOpen={showEmployeeAssessment}
          onClose={() => { setShowEmployeeAssessment(false); setSelectedEmployee(null); }}
          onSuccess={() => { fetchEmployees(); if (activeSection === 'employers') fetchEmployers(); }}
          framework={framework}
        />
      )}
    </div>
  );
}

// Employee risk assessment modal (prefills via GET and PATCH to /risk-factors)
const EmployeeRiskAssessmentModal = ({ employee, isOpen, onClose, onSuccess, framework }: { employee: any; isOpen: boolean; onClose: () => void; onSuccess: () => void; framework?: any }) => {
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState({
    verification_status: 2,
    tax_compliance: 3,
    consent_data_rights: 3,
    bank_mobile_wallet_verification: 2,
    employment_status: 3,
    employment_contract: 0,
    recent_payslips: 3,
    bank_statements_evidence: 3,
  });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !employee) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/employees/${employee.id}/risk-factors`);
        if (!res.ok) return;
        const payload = await res.json();
        if (!mounted) return;
        const rf = payload?.data?.risk_factors;
        if (rf) {
          setFactors({
            verification_status: rf.verification_status ?? 2,
            tax_compliance: rf.tax_compliance ?? 3,
            consent_data_rights: rf.consent_data_rights ?? 3,
            bank_mobile_wallet_verification: rf.bank_mobile_wallet_verification ?? 2,
            employment_status: rf.employment_status ?? 3,
            employment_contract: rf.employment_contract ?? 0,
            recent_payslips: rf.recent_payslips ?? 3,
            bank_statements_evidence: rf.bank_statements_evidence ?? 3,
          });
          setNotes(rf.notes ?? '');
        }
      } catch (e) {
        console.error('Failed to prefill risk factors', e);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, employee]);

  const calculateScore = () => {
    const vals = Object.values(factors).map((v: any) => Number(v) || 0);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum / vals.length;
  };

  const getRating = (score: number) => {
    const low = framework?.rating_thresholds?.low ?? 4.0;
    const medium = framework?.rating_thresholds?.medium ?? 3.0;
    if (score >= low) return 'A';
    if (score >= medium) return 'B';
    if (score >= medium - 0.4) return 'C';
    return 'D';
  };

  const calculateFee = (score: number) => {
    const bf = framework?.base_fee ?? 3.5;
    const rf = framework?.risk_factor ?? 3.0;
    return bf + (rf * (1 - score / 5));
  };

  const currentScore = calculateScore();
  const currentRating = getRating(currentScore);
  const currentFee = calculateFee(currentScore);

  const handleSubmit = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/risk-factors`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...factors, notes }),
      });
      const payload = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('Employee risk assessment saved');
        onSuccess();
        onClose();
      } else {
        toast.error(payload?.error || 'Failed to save assessment');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save assessment');
    } finally { setLoading(false); }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
              <div className="bg-linear-to-r from-blue-600 to-blue-700 p-4 text-white rounded-xl mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">Assess Risk — {employee.full_name || 'Employee'}</h3>
            <p className="text-sm text-blue-100 mt-1">Use the labeled options below to assess this employee (no sliders).</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white">Close</Button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Verification Status</Label>
                <Select value={String(factors.verification_status)} onValueChange={(v) => setFactors(prev => ({ ...prev, verification_status: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Fully verified (5)</SelectItem>
                    <SelectItem value="2">Verification pending (2)</SelectItem>
                    <SelectItem value="0">Unverified (0)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Tax Compliance</Label>
                <Select value={String(factors.tax_compliance)} onValueChange={(v) => setFactors(prev => ({ ...prev, tax_compliance: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Valid certificate (5)</SelectItem>
                    <SelectItem value="3">Overdue or invalid (3)</SelectItem>
                    <SelectItem value="0">No certificate (0)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Consent / Data Rights</Label>
                <Select value={String(factors.consent_data_rights)} onValueChange={(v) => setFactors(prev => ({ ...prev, consent_data_rights: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Accepted (5)</SelectItem>
                    <SelectItem value="3">Partially accepted (3)</SelectItem>
                    <SelectItem value="0">Not accepted (0)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Bank & Mobile Verification</Label>
                <Select value={String(factors.bank_mobile_wallet_verification)} onValueChange={(v) => setFactors(prev => ({ ...prev, bank_mobile_wallet_verification: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Both bank & mobile fully verified (5)</SelectItem>
                    <SelectItem value="2">Pending on either (2)</SelectItem>
                    <SelectItem value="0">Unverified (0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Employment Status</Label>
                <Select value={String(factors.employment_status)} onValueChange={(v) => setFactors(prev => ({ ...prev, employment_status: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Full-time (5)</SelectItem>
                    <SelectItem value="3">Part-time (3)</SelectItem>
                    <SelectItem value="0">Probationary / Temporary (0)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Employment Contract</Label>
                <Select value={String(factors.employment_contract)} onValueChange={(v) => setFactors(prev => ({ ...prev, employment_contract: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Signed & valid (5)</SelectItem>
                    <SelectItem value="0">No signed contract (0)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Recent Payslips</Label>
                <Select value={String(factors.recent_payslips)} onValueChange={(v) => setFactors(prev => ({ ...prev, recent_payslips: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Last 3 months provided (5)</SelectItem>
                    <SelectItem value="3">1–3 months partial (3)</SelectItem>
                    <SelectItem value="1">{'>'}3 months outdated (1)</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Bank Statements Evidence</Label>
                <Select value={String(factors.bank_statements_evidence)} onValueChange={(v) => setFactors(prev => ({ ...prev, bank_statements_evidence: parseInt(v) }))}>
                  <SelectTrigger className="h-10 mt-2"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Last 3 months (5)</SelectItem>
                    <SelectItem value="3">1–3 months partial (3)</SelectItem>
                    <SelectItem value="1">{'>'}3 months outdated (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Label>Notes (optional)</Label>
              <Input className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about the assessment" />
            </div>
          </div>

          <div className="w-72 sticky top-4 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-4 text-center">
              <p className="text-xs text-slate-500 uppercase font-bold">Composite Score (preview)</p>
              <p className="text-3xl font-black text-blue-600">{currentScore.toFixed(2)}</p>
              <div className="flex items-center justify-center">
                <RiskRatingBadge rating={currentRating as any} size="md" />
              </div>
              <div className="mt-2 text-sm">
                <p className="text-xs text-slate-500">Estimated App Fee</p>
                <p className="font-bold text-purple-600">{currentFee.toFixed(2)}%</p>
              </div>
            </div>

            <div className="p-4 bg-linear-to-br from-blue-600/10 to-blue-700/10 rounded-2xl border border-blue-200/30">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Manual Notes</div>
              <p className="text-xs text-slate-500">Add context for audit logs — these are saved with the assessment.</p>
            </div>

            <div className="space-y-2">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save Assessment'}</Button>
              <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
