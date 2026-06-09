"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, Upload, Check, AlertCircle, Clock,
  Plus, Shield, ArrowRight, ExternalLink,
  Info, ScanFace, CreditCard, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { formatDateTime, DOCUMENT_TYPES, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ConfettiKeys, useMilestoneConfetti } from '@/components/ui/Confetti';

interface Document {
    id: string;
    document_type: string;
    document_number?: string;
    status: 'approved' | 'rejected' | 'pending';
    created_at: string;
    file_url?: string;
    reviewer_notes?: string;
}

// ─── Status Components ──────────────────────────────────────────────────────

const DocumentStatusBadge = ({ status }: { status: Document['status'] }) => {
  const configs = {
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-600 border-red-500/20",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };

  return (
    <span className={cn(
      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      configs[status]
    )}>
      {status}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EmployeeKYC() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [userId, setUserId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const { triggerConfetti, ConfettiComponent } = useMilestoneConfetti(
      userId ? ConfettiKeys.KYC_APPROVAL(userId) : 'kyc-default',
      { intensity: 'medium' }
    );

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const [docsRes, overviewRes] = await Promise.all([
                fetch('/api/employee-dashboard/kyc/documents'),
                fetch('/api/employee-dashboard/overview'),
            ]);
            const data = await docsRes.json();
            const docs = data.documents || [];
            setDocuments(docs);
            
            // Get user ID for confetti tracking
            if (overviewRes.ok) {
                const overviewData = await overviewRes.json();
                const employeeUserId = overviewData?.employee?.user_id || overviewData?.employee?.id;
                if (employeeUserId) {
                    setUserId(employeeUserId);
                    
                    // Check if KYC is approved - trigger confetti for first time approval
                    const hasApprovedDoc = docs.some((d: Document) => d.status === 'approved');
                    if (hasApprovedDoc) {
                        triggerConfetti();
                    }
                }
            }
        } catch {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    }, [triggerConfetti]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchDocuments();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [fetchDocuments]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          toast.error('Please upload a valid image (JPEG, PNG) or PDF file');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error('File size must be less than 5MB');
          return;
        }
        setSelectedFile(file);
      }
    };

    const handleUpload = async () => {
      if (!selectedFile) {
        toast.error('Please select a file to upload');
        return;
      }
      setUploading(true);
      try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('document_type', selectedType);
          formData.append('document_number', documentNumber);
          const response = await fetch('/api/employee-dashboard/kyc/documents', {
              method: 'POST',
              body: formData,
          });
          if (response.ok) {
              toast.success('Document uploaded successfully!');
              fetchDocuments();
              setSelectedFile(null);
              setSelectedType('');
              setDocumentNumber('');
          } else {
              const errorData = await response.json();
              toast.error(errorData.error || 'Failed to upload document');
          }
      } catch {
          toast.error('An error occurred while uploading');
      } finally {
          setUploading(false);
      }
    };

    const getDocumentLabel = (type: string) => {
        return DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
    };

    const requiredDocs = ['national_id', 'payslip'];
    const uploadedTypes = documents.map(d => d.document_type);
    const missingDocs = requiredDocs.filter(d => !uploadedTypes.includes(d));

    return (
    <EmployeePortalLayout title="Verification Hub">
      {ConfettiComponent}
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit border border-primary/20">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Compliance</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">KYC Documents</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg">
              Keep your profile verified to ensure uninterrupted access to wage advances and financial tools.
            </p>
          </div>
          
          <div className="flex bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
            <div className="px-4 py-2 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
              <p className={cn(
                "text-sm font-bold",
                missingDocs.length === 0 ? "text-emerald-600" : "text-amber-600"
              )}>
                {missingDocs.length === 0 ? 'Verified' : 'Pending Action'}
              </p>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <div className="px-4 py-2 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Documents</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{documents.length}</p>
            </div>
          </div>
        </div>

        {/* Action Alerts */}
        {missingDocs.length > 0 && (
          <div className="bg-linear-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Action Required</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                You still need to upload: <span className="font-bold text-amber-600">{missingDocs.map(d => getDocumentLabel(d)).join(', ')}</span>
              </p>
            </div>
            <Button 
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl px-6 h-12 font-bold shadow-xl shadow-black/10 dark:shadow-white/5"
              onClick={() => fileInputRef.current?.focus()}
            >
              Start Upload <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Upload Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Upload Center</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Max 5MB • JPEG, PNG, PDF</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Document Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="h-12 rounded-xl bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="What are you uploading?" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Reference Number (Optional)</Label>
                  <Input
                    placeholder="e.g. ID or Passport Number"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">File Selection</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group",
                      selectedFile 
                        ? "border-primary bg-primary/5 shadow-inner" 
                        : "border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <Check className="w-6 h-6 text-primary" />
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-full px-4">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="mt-4 text-xs font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Plus className="w-10 h-10 text-slate-300 group-hover:text-primary transition-colors mb-3" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Select File</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">or drag and drop here</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all disabled:opacity-50 active:scale-[0.98]" 
                  onClick={handleUpload}
                  disabled={uploading || !selectedType || !selectedFile}
                >
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      <span>Confirm & Upload</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Info */}
            <div className="p-6 bg-linear-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-3xl text-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Guidelines</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Ensure all edges are visible',
                  'Text must be sharp and legible',
                  'No glares or heavy shadows',
                  'File must be under 5MB'
                ].map((tip, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-3 h-3 text-primary shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Documents List */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 min-h-100 flex flex-col shadow-sm">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Your Document Vault</h2>
                </div>
                <button 
                  onClick={fetchDocuments}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
              </div>

              <div className="p-6 flex-1">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Encrypting access...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                      <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Vault is Empty</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-50">Start your verification by uploading your National ID.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-all hover:shadow-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                            doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' : 
                            doc.status === 'rejected' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
                          )}>
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate pr-4">
                              {getDocumentLabel(doc.document_type)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {doc.document_number && (
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">#{doc.document_number}</span>
                              )}
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {formatDateTime(doc.created_at).split(',')[0]}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-4 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                          <DocumentStatusBadge status={doc.status} />
                          <div className="flex items-center gap-2">
                            {doc.file_url && (
                              <button 
                                onClick={() => window.open(doc.file_url, '_blank')}
                                className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                                title="View Document"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            {doc.status === 'rejected' && doc.reviewer_notes && (
                              <button 
                                onClick={() => toast.error(`Reason: ${doc.reviewer_notes}`)}
                                className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                title="View Feedback"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Document Types Info Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { type: 'national_id', icon: ScanFace, title: 'ID Verification', desc: 'National ID or Passport copy' },
                { type: 'payslip', icon: CreditCard, title: 'Income Proof', desc: 'Most recent company payslip' },
              ].map((item) => {
                const isUploaded = uploadedTypes.includes(item.type);
                const doc = documents.find(d => d.document_type === item.type);
                return (
                  <div 
                    key={item.type}
                    className={cn(
                      "p-5 rounded-2xl border-2 transition-all relative overflow-hidden",
                      isUploaded && doc?.status === 'approved' 
                        ? "border-emerald-500/20 bg-emerald-500/5 shadow-emerald-500/5"
                        : isUploaded
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isUploaded && doc?.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      )}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      {isUploaded ? (
                        doc?.status === 'approved' ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <Check className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">In Review</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Plus className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Add Now</span>
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-tight">{item.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </EmployeePortalLayout>
  );
}

const RefreshCw = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

const MessageSquare = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
