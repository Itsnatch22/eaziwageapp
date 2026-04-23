"use client"
import React,{ useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, Search, CheckCircle2, XCircle, Clock, Eye, Download,
  MoreHorizontal, Wallet, ArrowUpRight, RefreshCw, AlertTriangle,
  DollarSign
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ExportButton } from '@/components/ui/ExportButton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDateTime, cn, DEFAULT_ADMIN_CURRENCY } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

type VariantColor = 'purple' | 'green' | 'amber' | 'red' | 'blue';

type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'denied' | 'processing' | 'completed' | 'failed' | 'repaid';

const statusStyles: Record<
  string,
  { bg: string; icon: string }
> = {
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    icon: 'text-amber-600',
  },
  approved: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    icon: 'text-blue-600',
  },
  processing: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    icon: 'text-blue-600',
  },
  disbursed: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    icon: 'text-emerald-600',
  },
  completed: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    icon: 'text-emerald-600',
  },
  denied: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    icon: 'text-red-600',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    icon: 'text-red-600',
  },
  repaid: {
    bg: 'bg-slate-100 dark:bg-slate-500/20',
    icon: 'text-slate-700',
  },
};

interface AdvanceDetailModalProps {
  advance: Advance | null;
  currency: string;
  onClose: () => void;
  isOpen: boolean;
  loading?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDisburse: (id: string) => void;
}

interface GradientIconBoxProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  variant?: VariantColor;
  size?: 'sm' | 'md' | 'lg';
}

interface MetricCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: number | string;
  variant?: VariantColor;
  subtext?: string;
}

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'disbursed' | 'denied' | 'processing' | 'completed' | 'failed' | 'repaid';
}

interface FilterButtonProps {
  onClick: () => void;
  count?: number;
  active: boolean;
  children: React.ReactNode;
}

interface Advance {
  id: string;
  employee_name: string;
  employer_name: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  status: AdvanceStatus;
  disbursement_method?: string | null;
  disbursement_details?: {
    provider?: string;
    bank?: string;
    account?: string;
    number?: string;
  } | null;
  reason?: string | null;
  flagged?: boolean;
  flag_type?: string | null;
  flag_reason?: string | null;
  created_at: string;
  fee_percentage?: number;
}

interface AdvanceRowProps {
  advance: Advance;
  currency: string;
  onViewDetails: (advance: Advance) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDisburse: (id: string) => void;
}

export function AdvanceRow({
  advance,
  currency,
  onViewDetails,
  onApprove,
  onReject,
  onDisburse,
}: AdvanceRowProps) {
  const styles = statusStyles[advance.status];

  return (
    <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
      
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          styles.bg
        )}
      >
        <CreditCard className={cn('w-5 h-5', styles.icon)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{advance.employee_name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {advance.employer_name}
        </p>
      </div>

      <div className="text-right w-28">
        <p className="font-bold">{formatCurrency(advance.amount, currency)}</p>
        <p className="text-xs text-slate-500">
          Fee: {formatCurrency(advance.fee_amount, currency)}
        </p>
      </div>

      <div className="text-right w-28 hidden md:block">
        <p className="font-bold text-purple-600">
          {formatCurrency(advance.net_amount, currency)}
        </p>
        <p className="text-xs text-slate-500">Net</p>
      </div>

      <div className="w-24 hidden lg:block">
        <p className="text-sm capitalize">
          {advance.disbursement_method?.replace('_', ' ')}
        </p>
      </div>

      <div className="w-24">
        <StatusBadge status={advance.status} />
      </div>

      <div className="w-32 hidden xl:block">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDateTime(advance.created_at)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onViewDetails(advance)}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>

            {advance.status === 'pending' && (
              <>
                <DropdownMenuItem
                  onClick={() => onApprove(advance.id)}
                  className="text-emerald-600"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onReject(advance.id)}
                  className="text-red-600"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </DropdownMenuItem>
              </>
            )}

            {advance.status === 'approved' && (
              <DropdownMenuItem
                onClick={() => onDisburse(advance.id)}
                className="text-purple-600"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" /> Disburse
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    approved: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    processing: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    failed: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    disbursed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    denied: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    repaid: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  };

  const { bg, text } = config[status] || config.pending;
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize", bg, text)}>{status}</span>;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  variant = 'purple',
}: MetricCardProps) {
  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={Icon} size="md" variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
  )
}

export function GradientIconBox({
  icon: Icon,
  size = 'md',
  variant = 'purple',
}: GradientIconBoxProps) {
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

  const gradientMap: Record<VariantColor, string> = {
    purple: 'from-purple-600 to-indigo-600',
    green: 'from-emerald-500 to-green-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
    blue: 'from-blue-500 to-cyan-500',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg',
        sizes[size],
        gradientMap[variant]
      )}
    >
      <Icon className={cn('text-white', iconSizes[size])} />
    </div>
  );
}

export function FilterButton({ onClick, count = 0, active, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl text-sm font-medium transition-all relative",
        active
          ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
          : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full flex items-center justify-center",
            active ? "bg-white text-purple-600" : "bg-purple-500 text-white"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function AdvanceDetailModal({
  advance,
  currency,
  onClose,
  onApprove,
  onReject,
  onDisburse,
  isOpen,
  loading = false,
}: AdvanceDetailModalProps) {
  if (!isOpen || !advance) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Advance Request</h2>
              <p className="text-white/80 text-sm">ID: {advance.id?.substring(0, 8)}...</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Employee</p>
              <p className="font-semibold text-slate-900 dark:text-white">{advance.employee_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Employer</p>
              <p className="font-semibold text-slate-900 dark:text-white">{advance.employer_name}</p>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Amount Requested</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(advance.amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Service Fee ({advance.fee_percentage?.toFixed(1)}%)</span>
              <span className="font-medium text-red-600">-{formatCurrency(advance.fee_amount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
              <span className="font-semibold text-slate-900 dark:text-white">Net Amount</span>
              <span className="font-bold text-purple-600">{formatCurrency(advance.net_amount, currency)}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Disbursement Method</p>
              <p className="font-medium capitalize text-slate-900 dark:text-white">{advance.disbursement_method?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <StatusBadge status={advance.status} />
            </div>
          </div>
          
          {advance.disbursement_details && (
            <div>
              <p className="text-sm text-slate-500">Disbursement Details</p>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-300">
                {advance.disbursement_details.provider || advance.disbursement_details.bank}: {advance.disbursement_details.number || advance.disbursement_details.account}
              </p>
            </div>
          )}
          
          {advance.reason && (
            <div>
              <p className="text-sm text-slate-500">Reason</p>
              <p className="text-slate-700 dark:text-slate-300">{advance.reason}</p>
            </div>
          )}
          
          {advance.flagged && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Flagged: {advance.flag_type}</span>
              </div>
              {advance.flag_reason && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{advance.flag_reason}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" onClick={onClose}>Close</button>
          {advance.status === 'pending' && (
            <>
              <button 
                onClick={() => onReject(advance.id)} 
                disabled={loading}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </button>
              <button 
                onClick={() => onApprove(advance.id)} 
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
              </button>
            </>
          )}
          {advance.status === 'approved' && (
            <button 
              onClick={() => onDisburse(advance.id)} 
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" /> Disburse Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAdvances(){
  const { currency } = useCurrency();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdvanceStatus | ''>('');

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/advances');
      if(res.ok) {
        const data = await res.json();
        setAdvances(data.advances);
      } else {
        toast.error('Failed to fetch advances');
      }
    } catch {
      toast.error('An error occurred while fetching advances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const handleApprove = async(id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/advances/${id}/approve`,{
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
      });
      if(res.ok){
        toast.success('Advance approved successfully');
        fetchAdvances();
        setShowDetailModal(false);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to approve advance');
      }
    } catch {
      toast.error('An error occurred while approving the advance');
    } finally {
      setActionLoading(false);
    }
  }

  const handleDisburse = async(id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/advances/${id}/disburse`,{
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
      });
      if(res.ok){
        const data = await res.json();
        toast.success(data.message || 'Advance disbursed successfully');
        fetchAdvances();
        setShowDetailModal(false);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to disburse advance');
      }
    } catch {
      toast.error('An error occurred while disburseing the advance');
    } finally {
      setActionLoading(false);
    }
  }

  const handleReject = async(id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/advances/${id}/reject`,{
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
      });
      if(res.ok){
        toast.success('Advance rejected successfully');
        fetchAdvances();
        setShowDetailModal(false);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to reject advance');
      }
    } catch {
      toast.error('An error occurred while rejecting the advance');
    } finally {
      setActionLoading(false);
    }
  }

  const filteredAdvances = advances.filter((adv: Advance) => {
    if (statusFilter && adv.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        adv.employee_name?.toLowerCase().includes(search) ||
        adv.employer_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const stats = {
    total: advances.length,
    pending: advances.filter(a => a.status === 'pending').length,
    approved: advances.filter(a => a.status === 'approved').length,
    disbursed: advances.filter(a => a.status === 'disbursed').length,
    total_amount: advances.reduce((sum, a) => sum + (a.amount || 0), 0),
    total_fees: advances.reduce((sum, a) => sum + (a.fee_amount || 0), 0),
  };
    
  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-advances-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Advances</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage wage advance requests
            </p>
          </div>
          <div className="flex gap-2">
            <button 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 bg-white/60 dark:bg-slate-800/60" 
            onClick={fetchAdvances}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </button>
            <ExportButton 
              data={filteredAdvances}
              filename="admin-advances"
              headers={['Employee', 'Employer', 'Amount', 'Fee', 'Net', 'Status', 'Date']}
              mapping={(a: Advance) => [
                a.employee_name,
                a.employer_name,
                a.amount,
                a.fee_amount,
                a.net_amount,
                a.status,
                a.created_at
              ]}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={CreditCard} label="Total Advances" value={stats.total} variant="purple" />
          <MetricCard icon={Clock} label="Pending" value={stats.pending} subtext="Awaiting approval" variant="amber" />
          <MetricCard icon={DollarSign} label="Total Disbursed" value={formatCurrency(stats.total_amount, DEFAULT_ADMIN_CURRENCY)} variant="green" />
          <MetricCard icon={Wallet} label="Total Fees" value={formatCurrency(stats.total_fees, DEFAULT_ADMIN_CURRENCY)} variant="blue" />
        </div>

        {/* Search & Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by employee or employer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                data-testid="search-advances"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>
                All
              </FilterButton>
              <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={stats.pending}>
                Pending
              </FilterButton>
              <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>
                Approved
              </FilterButton>
              <FilterButton active={statusFilter === 'disbursed'} onClick={() => setStatusFilter('disbursed')}>
                Disbursed
              </FilterButton>
              <FilterButton active={statusFilter === 'denied'} onClick={() => setStatusFilter('denied')}>
                Denied
              </FilterButton>
            </div>
          </div>
        </div>

        {/* Advances List */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : filteredAdvances.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No advances found</h3>
              <p className="text-sm text-slate-500 mt-1">
                {searchTerm || statusFilter ? 'Try adjusting your search or filters' : 'No advance requests yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {/* Header */}
              <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="w-10" />
                <div className="flex-1">Employee</div>
                <div className="w-28 text-right">Amount</div>
                <div className="w-28 text-right hidden md:block">Net</div>
                <div className="w-24 hidden lg:block">Method</div>
                <div className="w-24">Status</div>
                <div className="w-32 hidden xl:block">Date</div>
                <div className="w-10" />
              </div>
              
              {filteredAdvances.map(advance => (
                <AdvanceRow 
                  key={advance.id} 
                  advance={advance}
                  currency={currency}
                  onViewDetails={(a) => {
                    setSelectedAdvance(a);
                    setShowDetailModal(true);
                  }}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDisburse={handleDisburse}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {filteredAdvances.length > 0 && (
          <div className="text-sm text-slate-500">
            Showing {filteredAdvances.length} of {advances.length} advances
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AdvanceDetailModal
        advance={selectedAdvance}
        currency={currency}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedAdvance(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onDisburse={handleDisburse}
        loading={actionLoading}
      />
    </>
  );
}

