//@ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileSearch, Clock, CheckCircle2, Eye, MessageSquare,
  Building2, Users, AlertCircle, RefreshCw, X,
  Send, Shield, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }) => {
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
    <div className={cn("rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg", sizes[size], variants[variant])}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

// Metric Card
const MetricCard = ({ icon, label, value, subtext, variant = 'purple' }) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
);

// Status Badge
const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'Pending' },
    in_review: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: 'In Review' },
    resolved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Resolved' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'Rejected' },
  };
  const { bg, text, label } = config[status] || config.pending;
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", bg, text)}>{label}</span>;
};

// Priority Badge
const PriorityBadge = ({ priority }) => {
  const config = {
    high: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  };
  const { bg, text } = config[priority] || config.medium;
  return <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", bg, text)}>{priority}</span>;
};

// Filter Button
const FilterButton = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl text-sm font-medium transition-all relative",
      active 
        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
        : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white"
    )}
  >
    {children}
    {count > 0 && (
      <span className={cn(
        "absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full flex items-center justify-center",
        active ? "bg-white text-purple-600" : "bg-red-500 text-white"
      )}>
        {count}
      </span>
    )}
  </button>
);

// Review Request Card
const ReviewRequestCard = ({ request, onAction }) => (
  <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
    <div className="flex items-start gap-4">
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        request.type === 'risk_score' ? "bg-amber-100 dark:bg-amber-500/20" :
        request.type === 'kyc_review' ? "bg-blue-100 dark:bg-blue-500/20" :
        request.type === 'dispute' ? "bg-red-100 dark:bg-red-500/20" :
        "bg-purple-100 dark:bg-purple-500/20"
      )}>
        {request.type === 'risk_score' ? <Shield className="w-6 h-6 text-amber-600" /> :
         request.type === 'kyc_review' ? <FileSearch className="w-6 h-6 text-blue-600" /> :
         request.type === 'dispute' ? <AlertCircle className="w-6 h-6 text-red-600" /> :
         <MessageSquare className="w-6 h-6 text-purple-600" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 dark:text-white">{request.subject}</p>
          <PriorityBadge priority={request.priority} />
        </div>
        
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
          <Building2 className="w-3.5 h-3.5" />
          <span>{request.employer_name}</span>
          <span className="text-slate-300">•</span>
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDateTime(request.requested_at)}</span>
        </div>
        
        {request.message && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
            {request.message}
          </p>
        )}

        {/* Tags */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded capitalize">
            {request.type?.replace('_', ' ')}
          </span>
          {request.employee_name && (
            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded">
              <Users className="w-3 h-3 inline mr-1" />
              {request.employee_name}
            </span>
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={request.status} />
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => onAction(request)}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
          data-testid={`review-request-${request.id}`}
        >
          <Eye className="w-4 h-4 mr-1" /> Review
        </Button>
      </div>
    </div>
  </div>
);

// Review Detail Modal
const ReviewDetailModal = ({ request, isOpen, onClose, onSubmitResponse }) => {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (request) {
      setStatus(request.status || 'pending');
      setResponse('');
      setInternalNotes('');
    }
  }, [request]);

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{request.subject}</h3>
              <p className="text-white/80 text-sm mt-1">
                {request.employer_name} • {formatDateTime(request.requested_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={request.status} />
              <button onClick={onClose} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
          {/* Request Details */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Request Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Request Type</p>
                <p className="font-medium text-slate-900 dark:text-white capitalize">{request.type?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-slate-500">Priority</p>
                <PriorityBadge priority={request.priority} />
              </div>
              <div>
                <p className="text-slate-500">Contact Email</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.contact_email || '-'}</p>
              </div>
              {request.employee_name && (
                <div>
                  <p className="text-slate-500">Related Employee</p>
                  <p className="font-medium text-slate-900 dark:text-white">{request.employee_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Message from Employer</h4>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {request.message || 'No message provided.'}
              </p>
            </div>
          </div>

          {/* Response Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Response to Employer</Label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Write your response to the employer..."
                className="w-full h-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes (Admin Only)</Label>
              <Input
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add internal notes..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button 
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => {
              onSubmitResponse(request.id, { status, response, internal_notes: internalNotes });
              onClose();
            }}
          >
            <Send className="w-4 h-4 mr-2" /> Submit Response
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ReviewManagement() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/review-requests');
      const data = await response.json();
      if (response.ok) {
        // Enrich with demo data if needed
        const enriched = data.map(r => ({
          ...r,
          subject: r.subject || 'Risk Score Review Request',
          type: r.type || 'risk_score',
          priority: r.priority || 'medium',
          employer_name: r.employer_name || 'Unknown Employer',
          message: r.message || 'Please review our company risk score assessment.',
        }));
        setRequests(enriched);
      }
    } catch (err) {
      console.error('Failed to fetch review requests:', err);
      // Add demo data for testing
      setRequests([
        {
          id: '1',
          subject: 'Risk Score Review Request',
          type: 'risk_score',
          priority: 'high',
          status: 'pending',
          employer_id: 'emp1',
          employer_name: 'Test Corp Ltd',
          contact_email: 'admin@testcorp.com',
          message: 'Our company risk score seems unusually high. We have been operating for 5 years with no defaults. Please review.',
          requested_at: new Date().toISOString(),
        },
        {
          id: '2',
          subject: 'KYC Document Verification',
          type: 'kyc_review',
          priority: 'medium',
          status: 'in_review',
          employer_id: 'emp2',
          employer_name: 'Acme Industries',
          contact_email: 'hr@acme.co.ke',
          employee_name: 'John Doe',
          message: 'Employee submitted updated KYC documents after name change. Please verify.',
          requested_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '3',
          subject: 'Advance Limit Dispute',
          type: 'dispute',
          priority: 'low',
          status: 'resolved',
          employer_id: 'emp3',
          employer_name: 'Tech Solutions',
          contact_email: 'finance@techsol.com',
          employee_name: 'Jane Smith',
          message: 'Employee advance limit does not reflect recent salary increase.',
          requested_at: new Date(Date.now() - 172800000).toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmitResponse = async (requestId, data) => {
    try {
      await fetch(`/api/admin/review-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      toast.success('Response submitted successfully');
      
      // Update local state
      setRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: data.status } : r
      ));
    } catch (err) {
      toast.error('Failed to submit response');
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  };

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="review-management-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="review-management-title">
              Review Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Handle employer review requests and disputes
            </p>
          </div>
          <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={fetchRequests}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={FileSearch} label="Total Requests" value={stats.total} variant="purple" />
          <MetricCard icon={Clock} label="Pending" value={stats.pending} subtext="Awaiting review" variant="amber" />
          <MetricCard icon={Eye} label="In Review" value={stats.in_review} variant="blue" />
          <MetricCard icon={CheckCircle2} label="Resolved" value={stats.resolved} variant="green" />
        </div>

        {/* Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>
              All
            </FilterButton>
            <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={stats.pending}>
              Pending
            </FilterButton>
            <FilterButton active={statusFilter === 'in_review'} onClick={() => setStatusFilter('in_review')}>
              In Review
            </FilterButton>
            <FilterButton active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')}>
              Resolved
            </FilterButton>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

            <span className="text-sm font-medium text-slate-500">Type:</span>
            <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40 h-9 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="risk_score">Risk Score</SelectItem>
                <SelectItem value="kyc_review">KYC Review</SelectItem>
                <SelectItem value="dispute">Dispute</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/30">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSearch className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">No review requests</h3>
              <p className="text-sm text-slate-500 mt-1">
                {statusFilter || typeFilter ? 'Try adjusting your filters' : 'No pending requests from employers'}
              </p>
            </div>
          ) : (
            filteredRequests.map(request => (
              <ReviewRequestCard 
                key={request.id}
                request={request}
                onAction={setSelectedRequest}
              />
            ))
          )}
        </div>

        {/* Summary */}
        {filteredRequests.length > 0 && (
          <div className="text-sm text-slate-500">
            Showing {filteredRequests.length} of {requests.length} requests
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ReviewDetailModal
        request={selectedRequest}
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onSubmitResponse={handleSubmitResponse}
      />
    </AdminPortalLayout>
  );
}

