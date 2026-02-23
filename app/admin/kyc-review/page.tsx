//@ts-nocheck
"use client"
import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, CheckCircle2, XCircle, Clock, Download, 
  RefreshCw, X, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: 'Driving License' },
  { value: 'kra_pin', label: 'KRA PIN Certificate' },
  { value: 'nhif_card', label: 'NHIF Card' },
  { value: 'nssf_card', label: 'NSSF Card' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'employment_letter', label: 'Employment Letter' },
  { value: 'selfie', label: 'Selfie/Photo' },
];

// Gradient Icon Box
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
    <div className={cn(
      "rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg",
      sizes[size], variants[variant]
    )}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

// Metric Card
const MetricCard = ({ icon, label, value, subtext, variant = 'purple', onClick, active }) => (
  <div 
    className={cn(
      "bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border transition-all cursor-pointer",
      active 
        ? "border-purple-500 ring-2 ring-purple-500/20" 
        : "border-slate-200/50 dark:border-slate-700/30 hover:border-purple-300"
    )}
    onClick={onClick}
  >
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
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
    approved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
  };
  const { bg, text } = config[status] || config.pending;
  return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize", bg, text)}>{status}</span>;
};

// Filter Button
const FilterButton = ({ active, onClick, children, count }) => (
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
      <span className={cn(
        "absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full flex items-center justify-center",
        active ? "bg-white text-purple-600" : "bg-amber-500 text-white"
      )}>
        {count}
      </span>
    )}
  </button>
);

// Document Card
const DocumentCard = ({ doc, onReview, getEmployeeName, getDocumentLabel }) => (
  <div 
    className={cn(
      "bg-white/40 dark:bg-slate-800/40 rounded-xl p-5 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer border",
      doc.status === 'pending' ? "border-l-4 border-l-amber-500 border-r-slate-200/50 border-y-slate-200/50 dark:border-r-slate-700/30 dark:border-y-slate-700/30" : "border-slate-200/50 dark:border-slate-700/30"
    )}
    onClick={() => onReview(doc)}
    data-testid={`kyc-doc-${doc.id}`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center",
        doc.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20' :
        doc.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 
        'bg-red-100 dark:bg-red-500/20'
      )}>
        <FileText className={cn(
          "w-6 h-6",
          doc.status === 'pending' ? 'text-amber-600' :
          doc.status === 'approved' ? 'text-emerald-600' : 'text-red-600'
        )} />
      </div>
      <StatusBadge status={doc.status} />
    </div>
    
    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{getDocumentLabel(doc.document_type)}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{getEmployeeName(doc.user_id)}</p>
    
    {doc.document_number && (
      <p className="text-xs text-slate-400 font-mono mb-2">#{doc.document_number}</p>
    )}
    
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <Calendar className="w-3 h-3" />
      <span>{formatDateTime(doc.created_at)}</span>
    </div>
    
    {doc.status === 'pending' && (
      <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700" size="sm">
        Review Now
      </Button>
    )}
  </div>
);

// Review Modal
const ReviewModal = ({ doc, isOpen, onClose, onReview, getDocumentLabel, loading }) => {
  const [notes, setNotes] = useState('');

  if (!isOpen || !doc) return null;

  const handleReview = (status) => {
    onReview(doc.id, status, notes);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Review Document</h2>
                <p className="text-white/80 text-sm">{getDocumentLabel(doc.document_type)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Document Preview Placeholder */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-8 text-center">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-300 font-medium">{getDocumentLabel(doc.document_type)}</p>
            <p className="text-sm text-slate-500 mt-1">Document preview would appear here</p>
            <Button variant="outline" className="mt-4" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download Original
            </Button>
          </div>

          {/* Document Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Document Type</p>
              <p className="font-medium text-slate-900 dark:text-white">{getDocumentLabel(doc.document_type)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Document Number</p>
              <p className="font-medium font-mono text-slate-900 dark:text-white">{doc.document_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Uploaded</p>
              <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(doc.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <StatusBadge status={doc.status} />
            </div>
          </div>

          {/* Review Notes */}
          {doc.status === 'pending' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Review Notes (Optional)
              </label>
              <Textarea
                placeholder="Add notes about this document..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] bg-white/60 dark:bg-slate-800/60"
                data-testid="review-notes"
              />
            </div>
          )}

          {doc.reviewer_notes && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-1">Previous Review Notes</p>
              <p className="text-slate-700 dark:text-slate-300">{doc.reviewer_notes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          {doc.status === 'pending' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleReview('rejected')}
                disabled={loading}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleReview('approved')}
                disabled={loading}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AdminKYCReview() {
  const [documents, setDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      
      // Fetch documents
      const docsResponse = await fetch(`/api/employee-dashboard/kyc/documents${filter !== 'all' ? `?status=${filter}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Fetch employees for name lookup
      const employeesResponse = await fetch(`/api/admin/employees`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData);
      }
      
      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json();
        setEmployees(employeesData);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const handleReview = async (docId, status, notes) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/employee-dashboard/kyc/documents/${docId}/review?status=${status}&notes=${encodeURIComponent(notes || '')}`, {
        method: 'PATCH',
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Document ${status}`);
        setShowReviewModal(false);
        setSelectedDoc(null);
        fetchData();
      } else {
        toast.error('Failed to review document');
      }
    } catch (err) {
      toast.error('Failed to review document');
    } finally {
      setActionLoading(false);
    }
  };

  const getDocumentLabel = (type) => {
    return DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
  };

  const getEmployeeName = (userId) => {
    const employee = employees.find(e => e.user_id === userId);
    return employee ? `${employee.full_name || 'Employee'} (${employee.employee_code})` : 'Unknown Employee';
  };

  // Filter documents by search
  const filteredDocs = documents.filter(doc => {
    if (!searchTerm) return true;
    const label = getDocumentLabel(doc.document_type).toLowerCase();
    const employeeName = getEmployeeName(doc.user_id).toLowerCase();
    return label.includes(searchTerm.toLowerCase()) || employeeName.includes(searchTerm.toLowerCase());
  });

  const stats = {
    pending: documents.filter(d => d.status === 'pending').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    total: documents.length,
  };

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-kyc-review-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">KYC Review</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Review and approve employee verification documents
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={Clock} 
            label="Pending Review" 
            value={stats.pending} 
            variant="amber"
            onClick={() => setFilter('pending')}
            active={filter === 'pending'}
          />
          <MetricCard 
            icon={CheckCircle2} 
            label="Approved" 
            value={stats.approved} 
            variant="green"
            onClick={() => setFilter('approved')}
            active={filter === 'approved'}
          />
          <MetricCard 
            icon={XCircle} 
            label="Rejected" 
            value={stats.rejected} 
            variant="red"
            onClick={() => setFilter('rejected')}
            active={filter === 'rejected'}
          />
          <MetricCard 
            icon={FileText} 
            label="Total Documents" 
            value={stats.total} 
            variant="purple"
            onClick={() => setFilter('all')}
            active={filter === 'all'}
          />
        </div>

        {/* Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by document type or employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                data-testid="search-kyc"
              />
            </div>
            <div className="flex gap-2">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
              <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')} count={stats.pending}>Pending</FilterButton>
              <FilterButton active={filter === 'approved'} onClick={() => setFilter('approved')}>Approved</FilterButton>
              <FilterButton active={filter === 'rejected'} onClick={() => setFilter('rejected')}>Rejected</FilterButton>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-16 border border-slate-200/50 dark:border-slate-700/30 text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">No documents found</h3>
            <p className="text-sm text-slate-500 mt-1">No KYC documents match your filter</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onReview={(d) => {
                  setSelectedDoc(d);
                  setShowReviewModal(true);
                }}
                getEmployeeName={getEmployeeName}
                getDocumentLabel={getDocumentLabel}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredDocs.length > 0 && (
          <div className="text-sm text-slate-500">
            Showing {filteredDocs.length} of {documents.length} documents
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        doc={selectedDoc}
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedDoc(null);
        }}
        onReview={handleReview}
        getDocumentLabel={getDocumentLabel}
        loading={actionLoading}
      />
    </AdminPortalLayout>
  );
}
