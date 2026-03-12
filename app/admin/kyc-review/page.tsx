'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  X,
  Calendar,
  Loader2,
  Building2,
  User,
  ExternalLink,
  ChevronRight,
  Shield,
  Briefcase,
  MapPin,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  KYCDocument,
  DocumentStatus,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/validations/kyc-validation';

// ============================================================================
// TYPES
// ============================================================================

interface EmployerApplication {
  id: string;
  user_id: string;
  company_name: string;
  registration_number: string;
  industry: string;
  city?: string;
  status: DocumentStatus;
  created_at: string;
  // Document URLs
  certificate_of_incorporation?: string;
  business_registration?: string;
  tax_compliance_certificate?: string;
  kra_pin_certificate?: string;
  cr12_document?: string;
  business_permit?: string;
  audited_financials?: string;
  bank_statement?: string;
  proof_of_address?: string;
  proof_of_bank_account?: string;
  employment_contract_template?: string;
  reviewer_notes?: string;
  // Financials
  bank_name?: string;
  bank_account_number?: string;
}

type FilterType = 'all' | DocumentStatus;
type EntityType = 'employee' | 'employer';
type IconType = React.ComponentType<{ className?: string }>;
type GradientVariant = 'purple' | 'green' | 'amber' | 'red' | 'blue';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const GradientIconBox = ({ icon: Icon, variant = 'purple' }: { icon: IconType; variant?: GradientVariant }) => {
  const variants = {
    purple: 'from-purple-600 to-indigo-600',
    green: 'from-emerald-500 to-green-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
    blue: 'from-blue-500 to-cyan-500',
  };
  return (
    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg', variants[variant as keyof typeof variants])}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  );
};

interface MetricCardProps {
  icon: IconType;
  label: string;
  value: number;
  variant?: GradientVariant;
  onClick: () => void;
  active: boolean;
}

const MetricCard = ({ icon, label, value, variant = 'purple', onClick, active }: MetricCardProps) => (
  <div
    className={cn(
      'bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border transition-all cursor-pointer',
      active ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200/50 dark:border-slate-700/30'
    )}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: DocumentStatus }) => {
  const config = {
    pending: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    approved: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    rejected: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
  };
  return (
    <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', config[status] || config.pending)}>
      {status}
    </span>
  );
};

interface EntityTypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: IconType;
  label: string;
}

const EntityTypeButton = ({ active, onClick, icon: Icon, label }: EntityTypeButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all",
      active 
        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25" 
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    )}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const DocumentCard = ({
  doc,
  onReview,
  getEmployeeName,
}: {
  doc: KYCDocument;
  onReview: (doc: KYCDocument) => void;
  getEmployeeName: (uid: string) => string;
}) => (
  <div
    className="bg-white/40 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all cursor-pointer group"
    onClick={() => onReview(doc)}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", doc.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600')}>
        <FileText className="w-6 h-6" />
      </div>
      <StatusBadge status={doc.status} />
    </div>
    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
      {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
    </h3>
    <p className="text-sm text-slate-500 mb-2">{getEmployeeName(doc.user_id)}</p>
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      <Calendar className="w-3 h-3" />
      <span>{formatDateTime(doc.created_at)}</span>
    </div>
  </div>
);

const EmployerCard = ({ app, onReview }: { app: EmployerApplication, onReview: (a: EmployerApplication) => void }) => (
  <div 
    onClick={() => onReview(app)}
    className="bg-white/40 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg transition-all cursor-pointer group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
        <Building2 className="w-6 h-6" />
      </div>
      <StatusBadge status={app.status} />
    </div>
    <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{app.company_name}</h3>
    <p className="text-xs text-slate-500 mt-1">{app.industry}</p>
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
      <span className="text-[10px] font-mono text-slate-400">#{app.registration_number}</span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
    </div>
  </div>
);

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function KYCReviewPage() {
  const [entityType, setEntityType] = useState<EntityType>('employee');
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [employerApplications, setEmployerApplications] = useState<EmployerApplication[]>([]);
  const [usersById, setUsersById] = useState<
    Record<string, { full_name: string; role: string }>
  >({});
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KYCDocument | null>(null);
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerApplication | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusQuery = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/admin/kyc/documents${statusQuery}`);

      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setEmployerApplications(data.employerApplications || []);
        setUsersById(data.usersById || {});
      } else {
        toast.error('Failed to load KYC data');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReviewEmployee = async (docId: string, status: 'approved' | 'rejected', notes: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/kyc/documents/${docId}/review?status=${status}&notes=${encodeURIComponent(notes)}`, {
        method: 'PATCH'
      });
      if (res.ok) {
        toast.success('Document updated');
        setShowReviewModal(false);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed');
      }
    } finally { setActionLoading(false); }
  };

  const handleReviewEmployer = async (appId: string, status: 'approved' | 'rejected', notes: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/kyc/employer/${appId}/review?status=${status}&notes=${encodeURIComponent(notes)}`, {
        method: 'PATCH'
      });
      if (res.ok) {
        toast.success('Employer status updated');
        setShowReviewModal(false);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed');
      }
    } finally { setActionLoading(false); }
  };

  const getUserName = (uid: string) => usersById[uid]?.full_name || 'Unknown User';

  // Categorize documents by role
  const employeeDocuments = documents.filter(d => (usersById[d.user_id]?.role || 'employee') === 'employee');
  const employerStandaloneDocs = documents.filter(d => usersById[d.user_id]?.role === 'employer');

  const filteredItems = entityType === 'employee' 
    ? employeeDocuments.filter(d => {
        if (!searchTerm) return true;
        const name = getUserName(d.user_id).toLowerCase();
        const type = (DOCUMENT_TYPE_LABELS[d.document_type] || d.document_type).toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());
      })
    : [
        ...employerApplications.filter(a => {
          if (!searchTerm) return true;
          return a.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 a.registration_number.toLowerCase().includes(searchTerm.toLowerCase());
        }),
        ...employerStandaloneDocs.filter(d => {
          if (!searchTerm) return true;
          const name = getUserName(d.user_id).toLowerCase();
          const type = (DOCUMENT_TYPE_LABELS[d.document_type] || d.document_type).toLowerCase();
          return name.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());
        })
      ];

  const stats = {
    pending: entityType === 'employee' 
      ? employeeDocuments.filter(d => d.status === 'pending').length 
      : employerApplications.filter(a => a.status === 'pending').length + employerStandaloneDocs.filter(d => d.status === 'pending').length,
    
    approved: entityType === 'employee' 
      ? employeeDocuments.filter(d => d.status === 'approved').length 
      : employerApplications.filter(a => a.status === 'approved').length + employerStandaloneDocs.filter(d => d.status === 'approved').length,
    
    rejected: entityType === 'employee' 
      ? employeeDocuments.filter(d => d.status === 'rejected').length 
      : employerApplications.filter(a => a.status === 'rejected').length + employerStandaloneDocs.filter(d => d.status === 'rejected').length,
    
    total: entityType === 'employee' 
      ? employeeDocuments.length 
      : employerApplications.length + employerStandaloneDocs.length
  };

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">KYC Review Hub</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and verify identities across the platform</p>
          </div>
          <div className="flex bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
            <EntityTypeButton 
              active={entityType === 'employee'} 
              onClick={() => { setEntityType('employee'); setFilter('all'); }} 
              icon={User} 
              label="Employees" 
            />
            <EntityTypeButton 
              active={entityType === 'employer'} 
              onClick={() => { setEntityType('employer'); setFilter('all'); }} 
              icon={Building2} 
              label="Employers" 
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Clock} label="Pending Review" value={stats.pending} variant="amber" onClick={() => setFilter('pending')} active={filter === 'pending'} />
          <MetricCard icon={CheckCircle2} label="Approved" value={stats.approved} variant="green" onClick={() => setFilter('approved')} active={filter === 'approved'} />
          <MetricCard icon={XCircle} label="Rejected" value={stats.rejected} variant="red" onClick={() => setFilter('rejected')} active={filter === 'rejected'} />
          <MetricCard icon={FileText} label="Total" value={stats.total} variant="purple" onClick={() => setFilter('all')} active={filter === 'all'} />
        </div>

        {/* Search & Filters */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder={`Search ${entityType === 'employee' ? 'documents or employees' : 'companies'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 dark:bg-slate-800/60" 
            onClick={fetchData}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No items found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item: any) => {
              // Check if it's a KYCDocument or EmployerApplication
              const isDoc = 'document_type' in item;
              
              if (isDoc) {
                return (
                  <DocumentCard 
                    key={item.id} 
                    doc={item} 
                    onReview={(d) => { setSelectedDoc(d); setSelectedEmployer(null); setShowReviewModal(true); }} 
                    getEmployeeName={getUserName} 
                  />
                );
              }
              
              return (
                <EmployerCard 
                  key={item.id} 
                  app={item} 
                  onReview={(a) => { setSelectedEmployer(a); setSelectedDoc(null); setShowReviewModal(true); }} 
                />
              );
            })}
          </div>
        )}
      </div>

      <ReviewModal 
        key={`${selectedDoc?.id ?? selectedEmployer?.id ?? 'none'}-${showReviewModal ? 'open' : 'closed'}`}
        doc={selectedDoc} 
        employer={selectedEmployer}
        usersById={usersById}
        isOpen={showReviewModal} 
        onClose={() => setShowReviewModal(false)}
        onReviewEmployee={handleReviewEmployee}
        onReviewEmployer={handleReviewEmployer}
        loading={actionLoading}
      />
    </>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  doc: KYCDocument | null;
  employer: EmployerApplication | null;
  usersById: Record<string, { full_name: string; role: string }>;
  isOpen: boolean;
  onClose: () => void;
  onReviewEmployee: (docId: string, status: 'approved' | 'rejected', notes: string) => void;
  onReviewEmployer: (appId: string, status: 'approved' | 'rejected', notes: string) => void;
  loading: boolean;
}

const ReviewModal = ({ doc, employer, usersById, isOpen, onClose, onReviewEmployee, onReviewEmployer, loading }: ReviewModalProps) => {
  const [notes, setNotes] = useState(() => doc?.reviewer_notes || employer?.reviewer_notes || '');

  if (!isOpen) return null;

  const isEmployerApp = !!employer;
  if (!isEmployerApp && !doc) return null;
  const selectedDoc = doc as KYCDocument;
  
  // For standalone documents, check the user role from usersById
  const userRole = doc ? (usersById[doc.user_id]?.role || 'employee') : 'employer';
  const isEmployerDoc = userRole === 'employer';
  const isEmployer = isEmployerApp || isEmployerDoc;

  const handleReview = (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !notes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    if (isEmployerApp) onReviewEmployer(employer.id, status, notes);
    else onReviewEmployee(selectedDoc.id, status, notes);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={cn("p-6 text-white flex items-center justify-between", isEmployer ? "bg-blue-600" : "bg-purple-600")}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              {isEmployer ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isEmployerApp ? 'Review Employer Application' : isEmployerDoc ? 'Review Employer Document' : 'Review Employee Document'}
              </h2>
              <p className="text-white/80 text-sm">
                {isEmployerApp 
                  ? employer.company_name 
                  : `${usersById[selectedDoc.user_id]?.full_name || 'User'} — ${DOCUMENT_TYPE_LABELS[selectedDoc.document_type] || selectedDoc.document_type}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isEmployerApp ? (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Employer Details */}
              <div className="space-y-6">
                <section>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Company Details</h4>
                  <div className="space-y-3">
                    <InfoRow icon={Building2} label="Company Name" value={employer.company_name} />
                    <InfoRow icon={Shield} label="Reg Number" value={employer.registration_number} />
                    <InfoRow icon={Briefcase} label="Industry" value={employer.industry} />
                    <InfoRow icon={MapPin} label="City" value={employer.city} />
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Banking</h4>
                  <div className="space-y-3">
                    <InfoRow icon={CreditCard} label="Bank" value={employer.bank_name || 'Not set'} />
                    <InfoRow icon={Shield} label="Account" value={employer.bank_account_number || 'Not set'} />
                  </div>
                </section>
              </div>

              {/* Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Documents</h4>
                <div className="grid gap-3">
                  <DocLink label="Inc. Certificate" url={employer.certificate_of_incorporation} />
                  <DocLink label="Business Reg." url={employer.business_registration} />
                  <DocLink label="Tax Compliance" url={employer.tax_compliance_certificate} />
                  <DocLink label="CR12 Document" url={employer.cr12_document} />
                  <DocLink label="KRA PIN Cert" url={employer.kra_pin_certificate} />
                  <DocLink label="Business Permit" url={employer.business_permit} />
                  <DocLink label="Audited Financials" url={employer.audited_financials} />
                  <DocLink label="Bank Statement" url={employer.bank_statement} />
                  <DocLink label="Proof of Address" url={employer.proof_of_address} />
                  <DocLink label="Proof of Bank Account" url={employer.proof_of_bank_account} />
                  <DocLink label="Employment Contract" url={employer.employment_contract_template} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Document Preview */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 mb-6">Document preview is available via external link</p>
                <Button variant="outline" onClick={() => window.open(selectedDoc.document_url, '_blank')} className="rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Document
                </Button>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Document Info</h4>
                  <div className="space-y-3">
                    <InfoRow icon={FileText} label="Type" value={DOCUMENT_TYPE_LABELS[selectedDoc.document_type] || selectedDoc.document_type} />
                    <InfoRow icon={Shield} label="Number" value={selectedDoc.document_number || 'N/A'} />
                    <InfoRow icon={Calendar} label="Submitted" value={formatDateTime(selectedDoc.created_at)} />
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Reviewer Decision Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your review notes here... Required if rejecting."
              className="min-h-30 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-4">
          <Button
            onClick={() => handleReview('approved')}
            disabled={loading}
            className={cn("flex-1 h-12 rounded-xl text-white font-bold shadow-lg", isEmployer ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700")}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Approve {isEmployer ? 'Employer' : 'Document'}
          </Button>
          <Button
            onClick={() => handleReview('rejected')}
            disabled={loading}
            variant="destructive"
            className="flex-1 h-12 rounded-xl font-bold shadow-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5 mr-2" />}
            Reject {isEmployer ? 'Employer' : 'Document'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }: { icon: IconType; label: string; value?: string | null }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">{label}</p>
      <p className="text-sm text-slate-900 dark:text-white font-medium truncate">{value || 'N/A'}</p>
    </div>
  </div>
);

const DocLink = ({ label, url }: { label: string, url?: string }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-3">
      <FileText className="w-4 h-4 text-slate-400" />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
    </div>
    {url ? (
      <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
        View <ExternalLink className="w-3 h-3 ml-1" />
      </Button>
    ) : (
      <span className="text-xs text-slate-400 italic">Not provided</span>
    )}
  </div>
);
