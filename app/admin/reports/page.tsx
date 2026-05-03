'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  BarChart3, Download, Calendar, TrendingUp, DollarSign, Users, Building2,
  CreditCard, Shield, Activity, Filter, RefreshCw, FileText, Eye,
  ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle2,
  ArrowUp, ArrowDown, Minus, Search, X
} from 'lucide-react';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';

// Types
type ReportPeriod = 'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type ReportStatus = 'generating' | 'ready' | 'failed' | 'scheduled';

interface Report {
  id: string;
  name: string;
  description: string;
  type: 'financial' | 'operational' | 'compliance' | 'performance';
  period: ReportPeriod;
  status: ReportStatus;
  generatedAt?: string;
  fileSize?: string;
  downloadUrl?: string;
  scheduledFor?: string;
  metrics?: {
    totalRecords?: number;
    processingTime?: number;
    accuracy?: number;
  };
}

interface QuickStats {
  totalReports: number;
  reportsThisMonth: number;
  scheduledReports: number;
  failedReports: number;
}

interface ReportsResponse {
  reports: Report[];
  stats: QuickStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Generate real-time dates based on current date
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 7);
const lastMonth = new Date(today);
lastMonth.setMonth(lastMonth.getMonth() - 1);
const nextQuarter = new Date(today);
nextQuarter.setMonth(nextQuarter.getMonth() + 3);

const apiClient = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};

const reportTemplates = [
  {
    id: 'financial-summary',
    name: 'Financial Summary',
    description: 'Revenue, fees, and financial performance',
    icon: DollarSign,
    type: 'financial' as const,
    availablePeriods: ['week', 'month', 'quarter', 'year'] as ReportPeriod[]
  },
  {
    id: 'employer-analytics',
    name: 'Employer Analytics',
    description: 'Employer growth, retention, and performance',
    icon: Building2,
    type: 'operational' as const,
    availablePeriods: ['week', 'month', 'quarter', 'year'] as ReportPeriod[]
  },
  {
    id: 'employee-insights',
    name: 'Employee Insights',
    description: 'Employee demographics and usage patterns',
    icon: Users,
    type: 'operational' as const,
    availablePeriods: ['week', 'month', 'quarter', 'year'] as ReportPeriod[]
  },
  {
    id: 'advance-report',
    name: 'Advance Report',
    description: 'Advance requests, approvals, and disbursements',
    icon: CreditCard,
    type: 'operational' as const,
    availablePeriods: ['day', 'week', 'month', 'quarter'] as ReportPeriod[]
  },
  {
    id: 'risk-assessment',
    name: 'Risk Assessment',
    description: 'Risk scores and compliance monitoring',
    icon: Shield,
    type: 'compliance' as const,
    availablePeriods: ['week', 'month', 'quarter'] as ReportPeriod[]
  },
  {
    id: 'system-performance',
    name: 'System Performance',
    description: 'API health, uptime, and technical metrics',
    icon: Activity,
    type: 'performance' as const,
    availablePeriods: ['day', 'week', 'month'] as ReportPeriod[]
  }
];

const typeColors = {
  financial: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  operational: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  compliance: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  performance: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
};

const statusColors = {
  ready: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  generating: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('month');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats>({
    totalReports: 0,
    reportsThisMonth: 0,
    scheduledReports: 0,
    failedReports: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const fetchReports = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        type: selectedType,
        period: selectedPeriod,
        search: searchQuery,
        page: page.toString(),
        limit: '20',
      });

      const response: ReportsResponse = await apiClient(
        `/api/admin/reports?${params}`
      );

      setReports(response.reports);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedPeriod, searchQuery]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);


  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a report template');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const template = reportTemplates.find(t => t.id === selectedTemplate);
      
      const newReport = await apiClient('/api/admin/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: template?.name || 'Custom Report',
          description: template?.description || 'Generated report',
          type: template?.type || 'operational',
          period: reportPeriod,
        }),
      });
      
      toast.success('Report generation started');
      setShowNewReportModal(false);
      setSelectedTemplate('');
      
      // Refresh reports list
      fetchReports();
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    if (!report.id) {
      toast.error('Invalid report ID');
      return;
    }
    
    try {
      toast.success(`Downloading ${report.name}...`);
      
      const response = await fetch(`/api/admin/reports/${report.id}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Failed to download report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await apiClient(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });
      
      toast.success('Report deleted successfully');
      fetchReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Generate and download comprehensive platform reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowNewReportModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalReports}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Reports</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.reportsThisMonth}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.scheduledReports}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.failedReports}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-slate-300 dark:text-slate-600 animate-spin" />
            <span className="ml-2 text-slate-500 dark:text-slate-400">Loading reports...</span>
          </div>
        ) : (
          reports.map((report) => {
            const template = reportTemplates.find(t => t.type === report.type);
            const Icon = template?.icon || FileText;
            
            return (
              <div key={report.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                            {report.name}
                          </h3>
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0",
                            typeColors[report.type]
                          )}>
                            {report.type}
                          </span>
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0",
                            statusColors[report.status]
                          )}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          {report.description}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {report.period}
                          </span>
                          {report.generatedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(report.generatedAt)}
                            </span>
                          )}
                          {report.fileSize && (
                            <span className="flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              {report.fileSize}
                            </span>
                          )}
                          {report.scheduledFor && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Scheduled for {formatDateTime(report.scheduledFor)}
                            </span>
                          )}
                        </div>

                        {report.metrics && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs">
                            <span className="text-slate-500">
                              Records: <span className="font-medium text-slate-700 dark:text-slate-300">
                                {report.metrics.totalRecords?.toLocaleString()}
                              </span>
                            </span>
                            <span className="text-slate-500">
                              Processing: <span className="font-medium text-slate-700 dark:text-slate-300">
                                {report.metrics.processingTime}s
                              </span>
                            </span>
                            <span className="text-slate-500">
                              Accuracy: <span className="font-medium text-slate-700 dark:text-slate-300">
                                {report.metrics.accuracy}%
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {report.status === 'ready' && report.downloadUrl && (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(report)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                      {report.status === 'generating' && (
                        <Button size="sm" disabled>
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          Generating...
                        </Button>
                      )}
                      {report.status === 'failed' && (
                        <Button size="sm" variant="destructive">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Failed
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(report.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {reports.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No reports found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {searchQuery || selectedType !== 'all' || selectedPeriod !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Start by generating your first report'}
            </p>
            {!searchQuery && selectedType === 'all' && selectedPeriod === 'all' && (
              <Button
                onClick={() => setShowNewReportModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate First Report
              </Button>
            )}
          </div>
        )}
      </div>

      {/* New Report Modal */}
      {showNewReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generate New Report</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewReportModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Report Type
                </label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTemplates.map((template) => {
                      const Icon = template.icon;
                      return (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {template.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Period
                </label>
                <Select value={reportPeriod} onValueChange={(value: ReportPeriod) => setReportPeriod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Daily</SelectItem>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {reportTemplates.find(t => t.id === selectedTemplate)?.description}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowNewReportModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  disabled={!selectedTemplate || isGenerating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
