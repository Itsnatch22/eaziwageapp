// app/admin/employers/page.tsx
'use client'
import React, { useState, useEffect } from 'react';
import { 
  Shield, Calculator, Building2, User, Search, Filter,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Eye, MoreVertical, Download, RefreshCw, Info,
  DollarSign, Users, FileText, ChevronDown, ChevronUp
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
import { cn } from '@/lib/utils';
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
  status: 'approved' | 'pending' | 'rejected' | 'suspended';
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
  total_employees: number;
  risk_distribution: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    very_high_risk: number;
  };
  avg_risk_score: number;
  avg_application_fee: number;
  needs_risk_assessment: number;
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
  status: 'approved' | 'pending' | 'rejected' | 'suspended';
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = {
    approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
  };

  const { label, color } = config[status];
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", color)}>
      {label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminEmployersPage() {
  const [loading, setLoading] = useState(true);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<ApiResponse['filters'] | null>(null);
  const [framework, setFramework] = useState<ApiResponse['framework'] | null>(null);
  
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
              Employer Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Monitor and manage employer risk profiles
            </p>
          </div>
          <div className="flex items-center gap-2">
            {framework && (
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                Framework {framework.version} ({framework.date})
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmployers}
              className="flex items-center gap-2"
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
              subtext={`${stats.active} active, ${stats.pending} pending`}
              variant="purple"
            />
            <MetricCard
              icon={Users}
              label="Total Employees"
              value={stats.total_employees.toLocaleString()}
              subtext="Across all employers"
              variant="blue"
            />
            <MetricCard
              icon={Shield}
              label="Avg Risk Score"
              value={stats.avg_risk_score.toFixed(2)}
              subtext="Out of 5.0"
              variant="green"
            />
            <MetricCard
              icon={DollarSign}
              label="Avg Application Fee"
              value={`${stats.avg_application_fee.toFixed(2)}%`}
              subtext={`Base: ${framework?.base_fee}% + Risk Factor`}
              variant="amber"
            />
          </div>
        )}

        {/* Risk Distribution */}
        {stats && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-4">
              <GradientIconBox icon={Shield} size="md" variant="purple" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Risk Distribution</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Employer risk ratings breakdown</p>
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
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Low Risk</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="B" size="md" />
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {stats.risk_distribution.medium_risk}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Medium Risk</p>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="C" size="md" />
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {stats.risk_distribution.high_risk}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">High Risk</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200/50 dark:border-red-500/30">
                <div className="flex items-center justify-center mb-2">
                  <RiskRatingBadge rating="D" size="md" />
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {stats.risk_distribution.very_high_risk}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">Very High Risk</p>
              </div>
            </div>

            {stats.needs_risk_assessment > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {stats.needs_risk_assessment} employer{stats.needs_risk_assessment > 1 ? 's' : ''} need{stats.needs_risk_assessment === 1 ? 's' : ''} risk assessment
                  </span>
                </div>
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
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {filters?.statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskRatingFilter} onValueChange={setRiskRatingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Risk Ratings" />
              </SelectTrigger>
              <SelectContent>
                {filters?.risk_ratings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    Rating {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
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
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('company_name')}
                  >
                    <div className="flex items-center gap-2">
                      Company
                      {sortField === 'company_name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('risk_score')}
                  >
                    <div className="flex items-center gap-2">
                      Risk Score
                      {sortField === 'risk_score' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Risk Rating</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('application_fee')}
                  >
                    <div className="flex items-center gap-2">
                      App Fee
                      {sortField === 'application_fee' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    onClick={() => handleSort('employee_count')}
                  >
                    <div className="flex items-center gap-2">
                      Employees
                      {sortField === 'employee_count' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmployers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="w-12 h-12 text-slate-300" />
                        <p className="text-slate-500">No employers found</p>
                        <p className="text-sm text-slate-400">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEmployers.map((employer) => (
                    <TableRow 
                      key={employer.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => window.location.href = `/admin/employers/${employer.id}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {employer.company_name}
                          </p>
                          <p className="text-xs text-slate-500">{employer.employer_code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {employer.industry || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {employer.country || '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={employer.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium",
                            employer.risk_score >= 4.0 ? "text-emerald-600" :
                            employer.risk_score >= 3.0 ? "text-blue-600" :
                            employer.risk_score >= 2.6 ? "text-amber-600" : "text-red-600"
                          )}>
                            {employer.risk_score.toFixed(2)}
                          </span>
                          {!employer.has_risk_factors && (
                            <div title="Needs assessment">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RiskRatingBadge rating={employer.risk_rating} showLabel />
                      </TableCell>
                      <TableCell className="font-medium text-purple-600">
                        {employer.application_fee.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {employer.employee_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/admin/employers/${employer.id}`;
                          }}
                        >
                          <Eye className="w-4 h-4" />
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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Risk Scoring Framework {framework.version}</p>
                <p className="text-xs">
                  Application fees are calculated using: Base Fee ({framework.base_fee}%) + Risk Factor ({framework.risk_factor}%) × (1 - Risk Score/5)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPortalLayout>
  );
}