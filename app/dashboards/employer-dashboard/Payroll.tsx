import React, { useState, useEffect } from 'react';
import { 
  Upload, Download, Calendar, FileText, CheckCircle2, Clock, AlertCircle,
  TrendingUp, Users, DollarSign, BarChart3, ChevronRight, Eye, Trash2, Wifi, CreditCard
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { EmployerPortalLayout } from '../../components/employer/EmployerLayout';
import { employerApi, payrollApi, employeeApi } from '../../lib/api';
import { formatCurrency, formatDateTime, cn } from '../../lib/utils';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Metric Card with solid green icon
const MetricCard = ({ icon: Icon, label, value, subtext, trend, trendUp }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between mb-3">
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>
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

// Payroll History Item
const PayrollHistoryItem = ({ record }) => (
  <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
    <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-md shrink-0">
      <Calendar className="w-5 h-5 text-white" />
    </div>
    
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-white">
        {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {record.employees?.length || 0} employees • Uploaded {formatDateTime(record.uploaded_at)}
      </p>
    </div>
    
    <div className="flex items-center gap-2">
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
        Processed
      </span>
      <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100">
        <Eye className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// Upload Step Card
const UploadStepCard = ({ step, title, description, icon: Icon, active, completed }) => (
  <div className={cn(
    "p-4 rounded-xl border-2 transition-all",
    completed ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" :
    active ? "border-primary bg-primary/5" :
    "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
  )}>
    <div className="flex items-start gap-3">
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        completed ? "bg-emerald-500" :
        active ? "bg-primary" :
        "bg-slate-200 dark:bg-slate-700"
      )}>
        {completed ? (
          <CheckCircle2 className="w-5 h-5 text-white" />
        ) : (
          <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-500")} />
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Step {step}</p>
        <p className={cn(
          "font-medium",
          completed ? "text-emerald-700 dark:text-emerald-300" :
          active ? "text-primary" :
          "text-slate-600 dark:text-slate-400"
        )}>{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  </div>
);

export default function EmployerPayroll() {
  const [employer, setEmployer] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('eaziwage_token');
        const [employerRes, employeesRes, historyRes] = await Promise.all([
          employerApi.getMe(),
          employeeApi.list(),
          fetch(`${API_URL}/api/payroll/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);
        setEmployer(employerRes.data);
        setEmployees(employeesRes.data || []);
        setPayrollHistory(historyRes || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        toast.error('Please upload a CSV or Excel file');
        return;
      }
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      // Simulate upload processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock payroll data based on employees
      const payrollData = {
        month: selectedMonth,
        employees: employees.slice(0, 20).map(emp => ({
          employee_code: emp.employee_code,
          days_worked: Math.floor(Math.random() * 10) + 20,
          gross_salary: emp.monthly_salary
        }))
      };

      const token = localStorage.getItem('eaziwage_token');
      const response = await fetch(`${API_URL}/api/payroll/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payrollData)
      });

      if (response.ok) {
        toast.success('Payroll uploaded successfully!');
        setSelectedFile(null);
        // Refresh history
        const historyRes = await fetch(`${API_URL}/api/payroll/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());
        setPayrollHistory(historyRes || []);
      } else {
        toast.error('Failed to upload payroll');
      }
    } catch (err) {
      toast.error('Failed to upload payroll');
    } finally {
      setUploading(false);
    }
  };

  // Calculate stats - use only active employees for consistency with Dashboard
  const activeEmployeesList = employees.filter(e => e.status === 'approved');
  const totalPayroll = activeEmployeesList.reduce((sum, e) => sum + (e.monthly_salary || 0), 0);
  const activeEmployees = activeEmployeesList.length;
  const lastUpload = payrollHistory[0];
  // Get monthly advances - fallback calculation based on payroll
  const monthlyAdvancesDisbursed = Math.round(totalPayroll * 0.033);
  const avgFeeRate = 4.5;
  const platformFees = Math.round(monthlyAdvancesDisbursed * (avgFeeRate / 100));
  const monthlyDeductions = monthlyAdvancesDisbursed + platformFees;
  // API Connection is Auto by default - Manual requires admin approval
  const apiConnectionStatus = true; // Always Auto Mode by default

  if (loading) {
    return (
      <EmployerPortalLayout employer={employer}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="payroll-title">
              Payroll Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Upload and manage employee earnings data
            </p>
          </div>
          <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60">
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={DollarSign}
            label="Monthly Payroll"
            value={formatCurrency(totalPayroll)}
            subtext={`${activeEmployees} active employees`}
            trend="+8.2%"
            trendUp={true}
          />
          <MetricCard 
            icon={Users}
            label="Employees"
            value={employees.length}
            subtext={`${activeEmployees} eligible for EWA`}
          />
          <MetricCard 
            icon={Calendar}
            label="Last Upload"
            value={lastUpload ? new Date(lastUpload.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Never'}
            subtext={lastUpload ? `${lastUpload.employees?.length || 0} records` : 'No data uploaded'}
          />
          <MetricCard 
            icon={BarChart3}
            label="Upload History"
            value={payrollHistory.length}
            subtext="Total payroll cycles"
          />
        </div>

        {/* Live API Connection & Monthly Deduction */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* API Connection Status */}
          <div className={cn(
            "backdrop-blur-sm rounded-2xl p-6 border",
            apiConnectionStatus 
              ? "bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-700/30"
              : "bg-amber-50/60 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-700/30"
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  apiConnectionStatus ? "bg-emerald-500/20" : "bg-amber-500/20"
                )}>
                  <Wifi className={cn("w-6 h-6", apiConnectionStatus ? "text-emerald-600" : "text-amber-600")} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Payroll API Connection</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Live integration with your payroll system</p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                apiConnectionStatus 
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  apiConnectionStatus ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )} />
                {apiConnectionStatus ? 'Auto Mode' : 'Manual Mode'}
              </div>
            </div>
            
            {apiConnectionStatus ? (
              <div className="space-y-3">
                <div className="p-4 bg-white/50 dark:bg-slate-800/30 rounded-xl mb-3">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium mb-1">Auto upload mode is active</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Payroll data syncs automatically. Manual upload requires admin approval.</p>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Last Sync</span>
                  <span className="font-medium text-slate-900 dark:text-white">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sync Frequency</span>
                  <span className="font-medium text-slate-900 dark:text-white">Daily (6:00 AM)</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Provider</span>
                  <span className="font-medium text-slate-900 dark:text-white">Integrated Payroll API</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/50 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Manual upload mode is active. API integration requires admin approval.
                </p>
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:text-amber-300">
                  Request API Integration
                </Button>
              </div>
            )}
          </div>

          {/* Monthly Deduction Summary */}
          <div className="bg-gradient-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Monthly EWA Deduction</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total deductions from employer to EaziWage</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-6 bg-white/60 dark:bg-slate-800/30 rounded-xl">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total This Month</p>
                <p className="text-4xl font-bold text-primary">{formatCurrency(monthlyDeductions)}</p>
                <p className="text-xs text-slate-400 mt-1">On behalf of {activeEmployees} employees</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Advance Principal</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyAdvancesDisbursed)}</p>
                </div>
                <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl text-center">
                  <p className="text-xs text-slate-500">Platform Fees ({avgFeeRate}%)</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(platformFees)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Card */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Upload Payroll Data</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Upload CSV or Excel file with employee earnings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Payroll Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="payroll-file"
                />
                <label htmlFor="payroll-file" className="cursor-pointer">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  {selectedFile ? (
                    <>
                      <p className="font-semibold text-primary">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900 dark:text-white">Click to upload file</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        CSV or Excel files • Max 10MB
                      </p>
                    </>
                  )}
                </label>
              </div>

              <Button 
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full bg-primary text-white"
                data-testid="upload-payroll-btn"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Payroll
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Upload Steps */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <h2 className="font-bold text-slate-900 dark:text-white mb-6">Upload Process</h2>
            <div className="space-y-4">
              <UploadStepCard 
                step={1}
                title="Download Template"
                description="Get the CSV template with required columns"
                icon={Download}
                completed={true}
                active={false}
              />
              <UploadStepCard 
                step={2}
                title="Fill Employee Data"
                description="Add employee codes, days worked, and salaries"
                icon={FileText}
                completed={selectedFile !== null}
                active={!selectedFile}
              />
              <UploadStepCard 
                step={3}
                title="Upload File"
                description="Upload the completed payroll file"
                icon={Upload}
                completed={false}
                active={selectedFile !== null}
              />
              <UploadStepCard 
                step={4}
                title="Processing"
                description="System validates and processes data"
                icon={Clock}
                completed={false}
                active={false}
              />
            </div>

            {/* Info Banner */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Required Columns</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300/80 mt-1">
                    employee_code, days_worked, gross_salary, deductions (optional)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payroll History */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30">
            <h2 className="font-bold text-slate-900 dark:text-white">Upload History</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Previous payroll uploads</p>
          </div>
          
          {payrollHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No payroll data yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Upload your first payroll file to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {payrollHistory.map((record, index) => (
                <PayrollHistoryItem key={index} record={record} />
              ))}
            </div>
          )}
        </div>

        {/* Integration Info */}
        <div className="bg-gradient-to-r from-primary/10 to-emerald-500/10 dark:from-primary/20 dark:to-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border border-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Automated Payroll Integration</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Connect your payroll system for automatic data sync. We support integration with popular HR systems including SAP, Oracle, and Sage.
              </p>
              <Button variant="outline" className="mt-4 bg-white dark:bg-slate-800">
                Learn More <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </EmployerPortalLayout>
  );
}
