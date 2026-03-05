// app/admin/employers/page.tsx
'use client'
import React, { useState, useEffect } from 'react';
import { 
  Shield, Calculator, Building2, User, Search, Filter,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Eye, MoreVertical, Download, RefreshCw, Info,
  DollarSign, Users, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

interface GradientIconBoxProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'purple' | 'green' | 'amber' | 'red' | 'blue';
}

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' };
  const variants = {
    purple: 'from-purple-600 to-indigo-600',
    green: 'from-emerald-500 to-green-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
    blue: 'from-blue-500 to-cyan-500'
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
  const { label, color, bgColor } = config[rating];

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
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
    risk_review_in_progress: { label: 'Risk Review', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  };

  const { label, color } = config[status];
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", color)}>
      {label}
    </span>
  );
};

// ─── Risk Assessment Modal ───────────────────────────────────────────────────

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

  useEffect(() => {
    if (!isOpen) {
      setOverrideReason('');
    }
  }, [isOpen, employer?.id]);

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
        total += (factors[f.id as keyof typeof factors] || 3) * f.weight;
      });
    });
    return Math.max(0, Math.min(5, total));
  };

  const getRating = (score: number) => {
    if (score >= 4.0) return 'A';
    if (score >= 3.0) return 'B';
    if (score >= 2.6) return 'C';
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
      onClose();
    } catch (error) {
      toast.error('Failed to save assessment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Risk Assessment</h2>
              <p className="text-purple-100 text-sm mt-1">{employer.company_name} ({employer.employer_code})</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
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

              <div className="p-4 bg-linear-to-br from-purple-600/10 to-indigo-600/10 rounded-xl border border-purple-200 dark:border-purple-800/30">
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
                  className="w-full h-12 bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Complete Assessment'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminEmployersPage() {
  const [loading, setLoading] = useState(true);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<ApiResponse['filters'] | null>(null);
  const [framework, setFramework] = useState<ApiResponse['framework'] | null>(null);
  
  // Modal state
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [riskRatingFilter, setRiskRatingFilter] = useState<string>('');
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Employer>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch employers data
  const fetchEmployers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (countryFilter) params.append('country', countryFilter);
      if (riskRatingFilter) params.append('risk_rating', riskRatingFilter);

      const response = await fetch(`/api/admin/employers?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch employers');
      }

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
  };

  useEffect(() => {
    fetchEmployers();
  }, [statusFilter, countryFilter, riskRatingFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length === 0 || searchTerm.length >= 2) {
        fetchEmployers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sorting function
  const handleSort = (field: keyof Employer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedEmployers = [...employers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * modifier;
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * modifier;
    }
    return 0;
  });

  const handleAssessRisk = (employer: Employer) => {
    setSelectedEmployer(employer);
    setShowAssessment(true);
  };

  if (loading) {
    return (
      <AdminPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading employers...</p>
          </div>
        </div>
      </AdminPortalLayout>
    );
  }

  return (
    <AdminPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Risk Scoring & Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Analyze and assess employer risk profiles based on EaziWage Framework
            </p>
          </div>
          <div className="flex items-center gap-2">
            {framework && (
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium">
                Framework {framework.version} ({framework.date})
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmployers}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Building2}
              label="Total Employers"
              value={stats.total}
              subtext={`${stats.active} approved, ${stats.risk_review || 0} in review`}
              variant="purple"
            />
            <MetricCard
              icon={Users}
              label="Total Employees"
              value={stats.total_employees.toLocaleString()}
              subtext="Across all platforms"
              variant="blue"
            />
            <MetricCard
              icon={Shield}
              label="Avg Risk Score"
              value={stats.avg_risk_score.toFixed(2)}
              subtext="Composite rating index"
              variant="green"
            />
            <MetricCard
              icon={DollarSign}
              label="Avg Fee Rate"
              value={`${stats.avg_application_fee.toFixed(2)}%`}
              subtext="Based on current risk"
              variant="amber"
            />
          </div>
        )}

        {/* Risk Distribution */}
        {stats && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Risk Rating Distribution</h3>
                <p className="text-sm text-slate-500">Portfolio health overview</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200/50 dark:border-emerald-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="A" size="md" />
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {stats.risk_distribution.low_risk}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Low Risk</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="B" size="md" />
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {stats.risk_distribution.medium_risk}
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Medium Risk</p>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="C" size="md" />
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {stats.risk_distribution.high_risk}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">High Risk</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200/50 dark:border-red-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="D" size="md" />
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {stats.risk_distribution.very_high_risk}
                </p>
                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Very High Risk</p>
              </div>
            </div>

            {stats.needs_risk_assessment > 0 && (
              <div className="mt-6 p-4 bg-linear-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-bold">Action Required</span>
                    <p className="text-xs opacity-80">{stats.needs_risk_assessment} employers are awaiting risk assessment</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="bg-white/50 border-amber-500/20 text-amber-800 hover:bg-amber-500 hover:text-white transition-all">
                  View List
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search employers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {filters?.statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskRatingFilter} onValueChange={setRiskRatingFilter}>
              <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder="All Risk Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Ratings</SelectItem>
                {filters?.risk_ratings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    Rating {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="h-11 bg-white/50 border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {filters?.countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Employers Table */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-0">
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 h-12"
                    onClick={() => handleSort('company_name')}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                      Company
                      {sortField === 'company_name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Country</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('risk_score')}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                      Score
                      {sortField === 'risk_score' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Rating</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('application_fee')}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                      App Fee
                      {sortField === 'application_fee' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
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
                    <TableRow 
                      key={employer.id}
                      className="hover:bg-purple-50/30 dark:hover:bg-purple-500/5 group border-slate-100 dark:border-slate-800"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-linear-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shadow-purple-600/20">
                            {employer.company_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                              {employer.company_name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">{employer.employer_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {employer.country || '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={employer.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-black text-sm",
                            employer.risk_score >= 4.0 ? "text-emerald-600" :
                            employer.risk_score >= 3.0 ? "text-blue-600" :
                            employer.risk_score >= 2.6 ? "text-amber-600" : 
                            (employer.risk_score === 0 ? "text-slate-400" : "text-red-600")
                          )}>
                            {employer.risk_score > 0 ? employer.risk_score.toFixed(2) : '-'}
                          </span>
                          {(!employer.has_risk_factors || employer.status === 'risk_review_in_progress') && (
                            <div className="animate-pulse" title="Assessment needed">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {employer.risk_score > 0 ? (
                            <RiskRatingBadge rating={employer.risk_rating} showLabel />
                        ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">In Progress</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-purple-600 text-sm">
                        {employer.risk_score > 0 ? `${employer.application_fee.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          className="h-9 px-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all font-bold text-xs rounded-lg shadow-sm"
                          onClick={() => handleAssessRisk(employer)}
                        >
                          <Shield className="w-3.5 h-3.5 mr-2" />
                          Assess Risk
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Framework Info Footer */}
        {framework && (
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Framework & Regulatory Notice ({framework.version})</p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
                  Risk scores are dynamic and weighted across five core categories. The fee impact is automatically calculated using the framework standard: 
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mx-1 text-purple-600">
                    Base({framework.base_fee}%) + Risk({framework.risk_factor}%) × (1 - Score/5)
                  </span>. 
                  Assessments should be reviewed quarterly or upon significant operational changes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <RiskAssessmentModal 
        employer={selectedEmployer}
        isOpen={showAssessment}
        onClose={() => {
          setShowAssessment(false);
          setSelectedEmployer(null);
        }}
        onSuccess={fetchEmployers}
        framework={framework}
      />
    </AdminPortalLayout>
  );
}
