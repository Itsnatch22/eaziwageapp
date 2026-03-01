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
import pusherClient from '@/lib/pusher-client';

// ... (Sub-components: GradientIconBox, MetricCard, StatusBadge, PriorityBadge, FilterButton)
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

const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'Pending' },
    approved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Approved' },
    disbursed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Disbursed' },
    resolved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Resolved' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'Rejected' },
    in_review: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: 'In Review' },
  };
  const { bg, text, label } = config[status] || config.pending;
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", bg, text)}>{label}</span>;
};

const PriorityBadge = ({ priority }) => {
  const config = {
    high: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  };
  const { bg, text } = config[priority] || config.medium;
  return <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", bg, text)}>{priority}</span>;
};

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

const ReviewRequestCard = ({ request, onAction }) => (
  <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
    <div className="flex items-start gap-4">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        request.type === 'risk_score' ? "bg-amber-100 dark:bg-amber-500/20" :
        request.type === 'kyc_review' ? "bg-blue-100 dark:bg-blue-500/20" :
        "bg-purple-100 dark:bg-purple-500/20"
      )}>
        {request.type === 'risk_score' ? <Shield className="w-6 h-6 text-amber-600" /> :
         request.type === 'kyc_review' ? <FileSearch className="w-6 h-6 text-blue-600" /> :
         <MessageSquare className="w-6 h-6 text-purple-600" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 dark:text-white">{request.subject}</p>
          <PriorityBadge priority={request.priority} />
        </div>
        
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
          {request.employer_name ? <Building2 className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
          <span>{request.employer_name || request.employee_name}</span>
          <span className="text-slate-300">•</span>
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDateTime(request.requested_at)}</span>
        </div>
        
        {request.message && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
            {request.message}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={request.status} />
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => onAction(request)}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <Eye className="w-4 h-4 mr-1" /> Review
        </Button>
      </div>
    </div>
  </div>
);

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
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{request.subject}</h3>
              <p className="text-white/80 text-sm mt-1">
                {request.employer_name || request.employee_name} • {formatDateTime(request.requested_at)}
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

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 text-sm">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Request Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500">Type</p>
                <p className="font-medium text-slate-900 dark:text-white capitalize">{request.type?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-slate-500">Priority</p>
                <PriorityBadge priority={request.priority} />
              </div>
              {request.contact_email && (
                <div>
                  <p className="text-slate-500">Contact</p>
                  <p className="font-medium text-slate-900 dark:text-white">{request.contact_email}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Message</h4>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{request.message}</p>
            </div>
          </div>

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
                  <SelectItem value="approved">Approved/Resolved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Response to User</Label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Write your response..."
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

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button 
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            onClick={() => {
              onSubmitResponse(request.id, { status, response, internal_notes: internalNotes, type: request.type });
              onClose();
            }}
          >
            <Send className="w-4 h-4 mr-2" /> Submit Review
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ReviewRequests() {
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
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch review requests:', err);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Pusher for real-time
    const channel = pusherClient.subscribe('admin-reviews');
    channel.bind('new-request', (data) => {
      setRequests(prev => [data, ...prev]);
      toast.info('New review request received!');
    });

    return () => {
      pusherClient.unsubscribe('admin-reviews');
    };
  }, []);

  const handleSubmitResponse = async (requestId, payload) => {
    try {
      const res = await fetch(`/api/admin/review-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Review submitted successfully');
      fetchRequests(); // Refresh
    } catch (err) {
      toast.error('Failed to submit review');
    }
  };

  const filteredRequests = requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    resolved: requests.filter(r => r.status === 'resolved' || r.status === 'approved').length,
  };

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Review Requests</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time management of KYC and Risk reviews</p>
          </div>
          <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={fetchRequests}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={FileSearch} label="Total Requests" value={stats.total} variant="purple" />
          <MetricCard icon={Clock} label="Pending" value={stats.pending} variant="amber" />
          <MetricCard icon={Eye} label="In Review" value={stats.in_review} variant="blue" />
          <MetricCard icon={CheckCircle2} label="Resolved" value={stats.resolved} variant="green" />
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>All</FilterButton>
            <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={stats.pending}>Pending</FilterButton>
            <FilterButton active={statusFilter === 'in_review'} onClick={() => setStatusFilter('in_review')}>In Review</FilterButton>
            
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
              </SelectContent>
            </Select>
          </div>
        </div>

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
              <p className="text-sm text-slate-500 mt-1">Everything is up to date</p>
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
      </div>

      <ReviewDetailModal
        request={selectedRequest}
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onSubmitResponse={handleSubmitResponse}
      />
    </AdminPortalLayout>
  );
}
