"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileSearch, Clock, CheckCircle2, Eye, MessageSquare,
  Building2, Users, RefreshCw, X,
  Send, Shield, Calendar, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import { ListSkeleton } from '@/components/shared/Skeletons';

type IconType = React.ComponentType<{ className?: string }>;

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'resolved' | 'dismissed' | 'under_review' | 'in_progress';
type RequestPriority = 'high' | 'medium' | 'low';
type RequestType = 'risk_score' | 'kyc_review' | 'bank_change' | 'payment_method_change' | 'general';

const requestStatuses = ['pending', 'approved', 'rejected', 'resolved', 'dismissed', 'under_review', 'in_progress'] as const;

const isRequestStatus = (status: unknown): status is RequestStatus =>
  typeof status === 'string' && requestStatuses.includes(status as RequestStatus);

const STATUS_OPTIONS: Record<RequestType, { value: string; label: string }[]> = {
  kyc_review: [
    { value: 'pending', label: 'Pending' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ],
  risk_score: [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
  ],
  bank_change: [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ],
  payment_method_change: [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ],
  general: [
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
  ],
};

interface RawData {
  // bank_change fields
  old_bank_name?: string;
  old_account_number?: string;
  new_bank_name?: string;
  new_account_number?: string;
  reason?: string;
  // kyc_review fields
  document_type?: string;
  document_url?: string;
  document_number?: string;
  expiry_date?: string;
  reviewer_notes?: string;
  [key: string]: unknown;
}

const TYPE_LABELS: Record<RequestType, string> = {
  risk_score: 'Risk Score Review',
  kyc_review: 'KYC Review',
  bank_change: 'Bank Change Request',
  payment_method_change: 'Payment Method Change',
  general: 'General',
};

interface ReviewRequest {
  id: string;
  type: RequestType;
  subject: string;
  message: string;
  status: RequestStatus;
  priority: RequestPriority;
  employer_name?: string;
  employee_name?: string;
  contact_email?: string;
  requested_at: string;
  raw_data?: RawData;
}

interface ResponsePayload {
  status: string;
  response: string;
  internal_notes: string;
  type: RequestType;
}

interface GradientIconBoxProps {
  icon: IconType;
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
    <div className={cn("rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg", sizes[size], variants[variant])}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

interface MetricCardProps {
  icon: IconType;
  label: string;
  value: number | string;
  subtext?: string;
  variant?: 'purple' | 'green' | 'amber' | 'red' | 'blue';
}

const MetricCard = ({ icon, label, value, subtext, variant = 'purple' }: MetricCardProps) => (
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

interface StatusBadgeProps {
  status: RequestStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config: Record<RequestStatus, { bg: string; text: string; label: string }> = {
    pending:      { bg: 'bg-amber-100 dark:bg-amber-500/20',   text: 'text-amber-700 dark:text-amber-300',   label: 'Pending' },
    under_review: { bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-700 dark:text-blue-300',     label: 'Under Review' },
    in_progress:  { bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-700 dark:text-blue-300',     label: 'In Progress' },
    approved:     { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Approved' },
    resolved:     { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Resolved' },
    rejected:     { bg: 'bg-red-100 dark:bg-red-500/20',       text: 'text-red-700 dark:text-red-300',       label: 'Rejected' },
    dismissed:    { bg: 'bg-slate-100 dark:bg-slate-500/20',   text: 'text-slate-600 dark:text-slate-300',   label: 'Dismissed' },
  };
  const { bg, text, label } = config[status];
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", bg, text)}>{label}</span>;
};

interface PriorityBadgeProps {
  priority: RequestPriority;
}

const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const config: Record<RequestPriority, { bg: string; text: string }> = {
    high: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  };
  const { bg, text } = config[priority];
  return <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", bg, text)}>{priority}</span>;
};

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}

const FilterButton = ({ active, onClick, children, count = 0 }: FilterButtonProps) => (
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

interface ReviewRequestCardProps {
  request: ReviewRequest;
  onAction: (request: ReviewRequest) => void;
}

const ReviewRequestCard = ({ request, onAction }: ReviewRequestCardProps) => (
  <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
    <div className="flex items-start gap-4">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        request.type === 'risk_score' ? "bg-amber-100 dark:bg-amber-500/20" :
        request.type === 'kyc_review' ? "bg-blue-100 dark:bg-blue-500/20" :
        request.type === 'bank_change' || request.type === 'payment_method_change' ? "bg-emerald-100 dark:bg-emerald-500/20" :
        "bg-purple-100 dark:bg-purple-500/20"
      )}>
        {request.type === 'risk_score' ? <Shield className="w-6 h-6 text-amber-600" /> :
         request.type === 'kyc_review' ? <FileSearch className="w-6 h-6 text-blue-600" /> :
         request.type === 'bank_change' || request.type === 'payment_method_change' ? <CreditCard className="w-6 h-6 text-emerald-600" /> :
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

interface ReviewDetailModalProps {
  request: ReviewRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResponse: (requestId: string, payload: ResponsePayload) => void;
}

const ReviewDetailModal = ({ request, isOpen, onClose, onSubmitResponse }: ReviewDetailModalProps) => {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (!request) return;

    const timeoutId = window.setTimeout(() => {
      setStatus(request.status || 'pending');
      setResponse('');
      setInternalNotes('');
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [request]);

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-purple-600 to-purple-700 p-6">
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
          {(request.type === 'bank_change' || request.type === 'payment_method_change') && request.raw_data && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Current Details</h4>
                <div className="space-y-2">
                  {request.type === 'payment_method_change' ? (
                    <>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{request.raw_data.old_provider_name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{request.raw_data.old_account_number || request.raw_data.old_phone_number || 'N/A'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{request.raw_data.old_bank_name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{request.raw_data.old_account_number || 'N/A'}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Requested Details</h4>
                <div className="space-y-2">
                  {request.type === 'payment_method_change' ? (
                    <>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{request.raw_data.new_provider_name || 'N/A'}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{request.raw_data.new_account_number || request.raw_data.new_phone_number || 'N/A'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{request.raw_data.new_bank_name}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{request.raw_data.new_account_number}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="col-span-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Reason:</strong> {request.raw_data.reason}
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 text-sm">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Request Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500">Type</p>
                <p className="font-medium text-slate-900 dark:text-white">{TYPE_LABELS[request.type] ?? request.type}</p>
              </div>
              <div>
                <p className="text-slate-500">Priority</p>
                <PriorityBadge priority={request.priority} />
              </div>
              {request.contact_email && (
                <div className="col-span-2">
                  <p className="text-slate-500">Contact</p>
                  <p className="font-medium text-slate-900 dark:text-white">{request.contact_email}</p>
                </div>
              )}
            </div>
          </div>

          {request.type === 'kyc_review' && request.raw_data && (
            <div className="mb-6">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Document Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Document Type</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {request.raw_data.document_type
                      ? request.raw_data.document_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      : '—'}
                  </p>
                  {request.raw_data.document_number && (
                    <p className="text-xs text-slate-500 mt-1">Ref: {request.raw_data.document_number}</p>
                  )}
                  {request.raw_data.expiry_date && (
                    <p className="text-xs text-slate-500 mt-1">Expires: {formatDateTime(request.raw_data.expiry_date)}</p>
                  )}
                </div>
                {request.raw_data.document_url && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30 flex items-center justify-center">
                    <a
                      href={request.raw_data.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-blue-700 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800"
                    >
                      View Document ↗
                    </a>
                  </div>
                )}
              </div>
              {request.raw_data.reviewer_notes && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Previous Notes:</strong> {request.raw_data.reviewer_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {request.message && (
            <div className="mb-6">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Message</h4>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{request.message}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(STATUS_OPTIONS[request.type] ?? STATUS_OPTIONS.general).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
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
              onSubmitResponse(request.id, { 
                status, 
                response, 
                internal_notes: internalNotes, 
                type: request.type 
              });
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
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<RequestType | ''>('');
  const [selectedRequest, setSelectedRequest] = useState<ReviewRequest | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/review-requests');
      const data = await response.json();
      if (response.ok) {
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch review requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchRequests();
    }, 0);

    const supabase = createClient();

    type AdminNotificationRow = { id: string; [key: string]: unknown };
    type ReviewRequestUpdateRow = { id: string; status?: unknown; [key: string]: unknown };

    const updateRequestStatus = (updated: ReviewRequestUpdateRow) => {
      const status = updated.status;
      if (!isRequestStatus(status)) return;

      setRequests(prev =>
        prev.map(req =>
          req.id === updated.id
            ? { ...req, status }
            : req
        )
      );
      toast.success('A review request was updated');
    };

    const channel = supabase
      .channel('realtime:admin-review-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload: RealtimePostgresChangesPayload<AdminNotificationRow>) => {
          const newReq = payload.new as unknown as ReviewRequest;
          setRequests(prev => [newReq, ...prev]);
          toast.info('New review request received!');
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'risk_review_requests' },
        (payload: RealtimePostgresChangesPayload<ReviewRequestUpdateRow>) =>
          updateRequestStatus(payload.new as ReviewRequestUpdateRow)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employee_kyc_documents' },
        (payload: RealtimePostgresChangesPayload<ReviewRequestUpdateRow>) =>
          updateRequestStatus(payload.new as ReviewRequestUpdateRow)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bank_change_requests' },
        (payload: RealtimePostgresChangesPayload<ReviewRequestUpdateRow>) =>
          updateRequestStatus(payload.new as ReviewRequestUpdateRow)
      )
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmitResponse = async (requestId: string, payload: ResponsePayload) => {
    try {
      const res = await fetch(`/api/admin/review-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Review submitted successfully');
      fetchRequests(); 
    } catch (error) {
      console.error('Failed to submit review:', error);
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
    under_review: requests.filter(r => r.status === 'under_review' || r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved' || r.status === 'approved').length,
  };

  return (
    <>
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
          <MetricCard icon={Eye} label="In Review" value={stats.under_review} variant="blue" />
          <MetricCard icon={CheckCircle2} label="Resolved" value={stats.resolved} variant="green" />
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <FilterButton active={statusFilter === ''} onClick={() => setStatusFilter('')}>All</FilterButton>
            <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={stats.pending}>Pending</FilterButton>
            <FilterButton active={statusFilter === 'under_review'} onClick={() => setStatusFilter('under_review')}>Under Review</FilterButton>
            <FilterButton active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')}>In Progress</FilterButton>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <span className="text-sm font-medium text-slate-500">Type:</span>
            <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v as RequestType)}>
              <SelectTrigger className="w-40 h-9 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="risk_score">Risk Score</SelectItem>
                <SelectItem value="kyc_review">KYC Review</SelectItem>
                <SelectItem value="bank_change">Bank Change</SelectItem>
                <SelectItem value="payment_method_change">Payment Method Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
              <ListSkeleton rows={3} />
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
    </>
  );
}
