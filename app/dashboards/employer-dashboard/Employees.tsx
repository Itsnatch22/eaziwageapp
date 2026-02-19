"use client"
import { useState, useEffect } from 'react';
import { 
  Users, Search, Download, TrendingUp, UserCheck, Clock,
   Eye, Settings, 
  CheckCircle2, XCircle, Calendar, Building2, Globe, LucideIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { GradientIconBox, GradientAvatar, currencies, countries } from '@/components/employer/SharedComponents';

const API_URL = process.env.BACKEND_URL;

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
    subtext: string;
    trend: string;
    trendUp: boolean;
}

// Metric Card with gradient icon (matches website)
const MetricCard = ({ icon: Icon, label, value, subtext, trend, trendUp }: MetricCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between mb-3">
      <GradientIconBox icon={Icon} size="md" />
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          trendUp ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" : "bg-red-100 dark:bg-red-500/20 text-red-600"
        )}>
          <TrendingUp className={cn("w-3 h-3", !trendUp && "rotate-180")} />
          {trend}
        </div>
      )}
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </div>
);

interface StatusBadgeProps {
    status: string;
}
// Status Badge
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = {
    approved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Active' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'Pending' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'Rejected' },
  };
  const { bg, text, label } = config[status as keyof typeof config] || config.pending;
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", bg, text)}>{label}</span>;
};

interface KYCBadgeProps {
    status: string;
}
// KYC Status Badge
const KYCBadge = ({ status }: KYCBadgeProps) => {
  const config = {
    approved: { icon: CheckCircle2, color: 'text-emerald-600' },
    pending: { icon: Clock, color: 'text-amber-600' },
    submitted: { icon: Clock, color: 'text-blue-600' },
    rejected: { icon: XCircle, color: 'text-red-600' },
  };
  const { icon: Icon, color } = config[status as keyof typeof config] || config.pending;
  return <Icon className={cn("w-5 h-5", color)} />;
};

// Employee Row
const EmployeeRow = ({ employee, onViewDetails, onEditEWA, currency }: { employee: any, onViewDetails: any, onEditEWA: any, currency: string }) => (
  <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
    {/* Avatar */}
    <GradientAvatar 
      initials={employee.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
         employee.job_title?.charAt(0) || 'E'}
      size="md"
    />
    
    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-white truncate">
        {employee.full_name || `Employee ${employee.employee_code}`}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{employee.job_title} • {employee.department || 'General'}</p>
    </div>
    
    {/* Salary */}
    <div className="text-right hidden sm:block">
      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(employee.monthly_salary, currency)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Monthly</p>
    </div>
    
    {/* Tenure */}
    <div className="text-center hidden md:block w-20">
      <p className="font-semibold text-slate-900 dark:text-white">{employee.tenure_months || 0}m</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Tenure</p>
    </div>
    
    {/* KYC Status */}
    <div className="hidden lg:flex items-center justify-center w-12">
      <KYCBadge status={employee.kyc_status} />
    </div>
    
    {/* Status */}
    <StatusBadge status={employee.status} />
    
    {/* EWA Status */}
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
    
    {/* Actions */}
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

interface EWASettingsModalProps {
    employee: any;
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: any) => void;
}
// EWA Settings Modal
const EWASettingsModal = ({ employee, isOpen, onClose, onSave }: EWASettingsModalProps) => {
  const [settings, setSettings] = useState({
    ewa_enabled: true,
    max_advance_percentage: 50,
    min_advance_amount: 500,
    max_advance_amount: 50000,
    cooldown_period: 7
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee?.ewa_settings) {
      setSettings({
        ewa_enabled: employee.ewa_settings.ewa_enabled ?? true,
        max_advance_percentage: employee.ewa_settings.max_advance_percentage || 50,
        min_advance_amount: employee.ewa_settings.min_advance_amount || 500,
        max_advance_amount: employee.ewa_settings.max_advance_amount || 50000,
        cooldown_period: employee.ewa_settings.cooldown_period || 7
      });
    }
  }, [employee]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/ewa-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast.success('EWA settings updated');
        onSave(employee.id, settings);
        onClose();
      } else {
        toast.error('Failed to update settings');
      }
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-primary p-6">
          <h2 className="text-xl font-bold text-white">EWA Settings</h2>
          <p className="text-white/80 text-sm mt-1">{employee.full_name || employee.employee_code}</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Enable EWA Access</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Allow this employee to request advances</p>
            </div>
            <Switch 
              checked={settings.ewa_enabled} 
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, ewa_enabled: v }))}
            />
          </div>

          {settings.ewa_enabled && (
            <>
              {/* Max Percentage */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700 dark:text-slate-300">Max Advance Percentage</Label>
                  <span className="text-xl font-bold text-primary">{settings.max_advance_percentage}%</span>
                </div>
                <Slider
                  value={[settings.max_advance_percentage]}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, max_advance_percentage: v[0] }))}
                  max={100}
                  min={10}
                  step={5}
                />
              </div>

              {/* Amount Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Min Amount (KES)</Label>
                  <Input
                    type="number"
                    value={settings.min_advance_amount}
                    onChange={(e) => setSettings(prev => ({ ...prev, min_advance_amount: parseInt(e.target.value) || 0 }))}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Max Amount (KES)</Label>
                  <Input
                    type="number"
                    value={settings.max_advance_amount}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_advance_amount: parseInt(e.target.value) || 0 }))}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Cooldown */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Cooldown Period (Days)</Label>
                <Input
                  type="number"
                  value={settings.cooldown_period}
                  onChange={(e) => setSettings(prev => ({ ...prev, cooldown_period: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={30}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface FilterButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}
// Filter Button
const FilterButton = ({ active, onClick, children }: FilterButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
      active 
        ? "bg-primary text-white shadow-lg shadow-primary/25"
        : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
    )}
  >
    {children}
  </button>
);

// Department Pie Chart using Recharts
const DepartmentPieChart = ({ data, totalEmployees }: { data: any, totalEmployees: number }) => {
  if (!data || Object.keys(data).length === 0) return null;
  
  const COLORS = [
    '#0df259', '#10b981', '#059669', '#047857', '#065f46',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
  ];
  
  // Convert data to recharts format
  const chartData = Object.entries(data).map(([name, value], index) => ({
    name,
    value,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: { active: boolean, payload: any }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{data.name}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {data.value} employees ({((data.value / totalEmployees) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex items-center gap-6" data-testid="department-pie-chart">
      {/* Pie Chart */}
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
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip active={false} payload={undefined} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-white">{totalEmployees}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {chartData.slice(0, 8).map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white ml-auto">{item.value}</span>
          </div>
        ))}
        {chartData.length > 8 && (
          <div className="text-xs text-slate-500 col-span-2">+{chartData.length - 8} more departments</div>
        )}
      </div>
    </div>
  );
};

interface EmployeeViewModalProps {
    employee: any;
    isOpen: boolean;
    onClose: () => void;
}
// Employee View Modal
const EmployeeViewModal = ({ employee, isOpen, onClose }: EmployeeViewModalProps) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6">
          <div className="flex items-center gap-4">
            <GradientAvatar 
              initials={employee.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'E'}
              size="lg"
              className="border-2 border-white/30"
            />
            <div>
              <h2 className="text-xl font-bold text-white">{employee.full_name || 'Employee'}</h2>
              <p className="text-white/80 text-sm">{employee.job_title} • {employee.department || 'General'}</p>
              <p className="text-white/60 text-xs mt-1">ID: {employee.employee_code}</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Salary</p>
              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(employee.monthly_salary)}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tenure</p>
              <p className="font-bold text-slate-900 dark:text-white">{employee.tenure_months || 0} months</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
              <StatusBadge status={employee.status} />
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">KYC Status</p>
              <div className="flex items-center gap-2 mt-1">
                <KYCBadge status={employee.kyc_status} />
                <span className="text-sm capitalize text-slate-700 dark:text-slate-300">{employee.kyc_status}</span>
              </div>
            </div>
          </div>

          {employee.ewa_settings && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm font-semibold text-primary mb-2">EWA Settings</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Max Advance:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">{employee.ewa_settings.max_advance_percentage || 50}%</span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">{employee.ewa_settings.ewa_enabled === false ? 'Disabled' : 'Enabled'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
        </div>
      </div>
    </div>
  );
};

export default function EmployerEmployees() {
  const [employees, setEmployees] = useState([]);
  const [employer, setEmployer] = useState(null);
  const [extendedStats, setExtendedStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('KES');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEWAModal, setShowEWAModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('eaziwage_token');
      const [employerRes, employeesRes, statsRes] = await Promise.all([
        employerApi.getMe(),
        employeeApi.list(),
        fetch(`${API_URL}/api/dashboard/employer/extended`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => null)
      ]);
      setEmployer(employerRes.data);
      setEmployees(employeesRes.data || []);
      setExtendedStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSeedEmployees = async () => {
    setSeeding(true);
    try {
      const token = localStorage.getItem('eaziwage_token');
      const response = await fetch(`${API_URL}/api/seed/demo-employees`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      toast.success(data.message);
      fetchData();
    } catch (err) {
      toast.error('Failed to seed employees');
    } finally {
      setSeeding(false);
    }
  };

  const handleEWASave = (employeeId, newSettings) => {
    setEmployees(prev => prev.map(e => 
      e.id === employeeId ? { ...e, ewa_settings: newSettings } : e
    ));
  };

  // Get unique departments
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  // Filter employees
  const filteredEmployees = employees.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (departmentFilter && e.department !== departmentFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        e.full_name?.toLowerCase().includes(search) ||
        e.employee_code?.toLowerCase().includes(search) ||
        e.job_title?.toLowerCase().includes(search) ||
        e.department?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = extendedStats || {
    total_employees: employees.length,
    active_employees: employees.filter(e => e.status === 'approved').length,
    kyc_completion_rate: employees.length > 0 
      ? Math.round((employees.filter(e => e.kyc_status === 'approved').length / employees.length) * 100)
      : 0,
    retention_rate: 0,
    avg_tenure_months: 0,
    new_hires_30_days: 0
  };

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="employees-title">
              Employees
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage your workforce and EWA settings
            </p>
          </div>
          <div className="flex gap-2">
            {employees.length < 50 && (
              <Button 
                variant="outline"
                onClick={handleSeedEmployees}
                disabled={seeding}
                className="bg-white/60 dark:bg-slate-800/60"
                data-testid="seed-employees-btn"
              >
                {seeding ? 'Seeding...' : 'Seed 60 Demo Employees'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={Users}
            label="Total Employees"
            value={stats.total_employees}
            subtext={`${stats.active_employees} active`}
          />
          <MetricCard 
            icon={TrendingUp}
            label="Retention Rate"
            value={`${stats.retention_rate || 0}%`}
            subtext="Employees with 12+ months"
            trend="+5.2%"
            trendUp={true}
          />
          <MetricCard 
            icon={UserCheck}
            label="KYC Completion"
            value={`${stats.kyc_completion_rate}%`}
            subtext="Fully verified"
          />
          <MetricCard 
            icon={Clock}
            label="Avg. Tenure"
            value={`${stats.avg_tenure_months || 0} months`}
            subtext={`${stats.new_hires_30_days || 0} new this month`}
          />
        </div>

        {/* Department Distribution with Utilization Pie Chart */}
        {extendedStats?.department_breakdown && Object.keys(extendedStats.department_breakdown).length > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 mt-8">
            <div className="flex items-center gap-3 mb-6">
              <GradientIconBox icon={Building2} size="md" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Department Distribution</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Employee utilization across departments</p>
              </div>
            </div>
            <DepartmentPieChart data={extendedStats.department_breakdown} totalEmployees={stats.total_employees} />
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search and Date Range */}
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
              
              {/* Date Range - Themed */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 h-11 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <input 
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                    className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.4] [&::-webkit-calendar-picker-indicator]:sepia [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[90deg]"
                    placeholder="From"
                  />
                </div>
                <span className="text-slate-400">to</span>
                <div className="flex items-center gap-2 px-3 h-11 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <input 
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                    className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-32 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.4] [&::-webkit-calendar-picker-indicator]:sepia [&::-webkit-calendar-picker-indicator]:saturate-[10] [&::-webkit-calendar-picker-indicator]:hue-rotate-[90deg]"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
            
            {/* Row 2: Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>
                All
              </FilterButton>
              <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>
                Active
              </FilterButton>
              <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>
                Pending
              </FilterButton>
              
              {departments.length > 0 && (
                <Select value={departmentFilter || 'all'} onValueChange={(v) => setDepartmentFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-40 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Country Filter */}
              <Select value={countryFilter || 'all'} onValueChange={(v) => setCountryFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency Selector */}
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-28 h-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Employees List */}
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
              <h3 className="font-semibold text-slate-900 dark:text-white">No employees found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter || departmentFilter
                  ? 'Try adjusting your search or filters'
                  : 'Add employees or seed demo data to get started'}
              </p>
              {employees.length === 0 && (
                <Button 
                  onClick={handleSeedEmployees}
                  disabled={seeding}
                  className="mt-4 bg-primary text-white"
                >
                  {seeding ? 'Seeding...' : 'Seed 60 Demo Employees'}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {/* Header */}
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
              
              {filteredEmployees.map(employee => (
                <EmployeeRow 
                  key={employee.id} 
                  employee={employee}
                  currency={selectedCurrency}
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

        {/* Summary Footer */}
        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* EWA Settings Modal */}
      <EWASettingsModal 
        employee={selectedEmployee}
        isOpen={showEWAModal}
        onClose={() => {
          setShowEWAModal(false);
          setSelectedEmployee(null);
        }}
        onSave={handleEWASave}
      />

      {/* Employee View Modal */}
      <EmployeeViewModal 
        employee={selectedEmployee}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedEmployee(null);
        }}
      />
    </EmployerPortalLayout>
  );
}
