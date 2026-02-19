"use client";
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Check, X, AlertCircle, Clock, Eye,
   File, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatDateTime, DOCUMENT_TYPES, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Document {
    id: string;
    type: string;
    number: string;
    status: 'approved' | 'rejected' | 'pending';
    uploaded_at: string;
    file_url: string;
}

export default function EmployeeKYC() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/employee/kyc/documents');
            const data = await response.json();
            setDocuments(data.documents);
        } catch (error) {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFileSelect = (e: { target: { files: any[]; }; }) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a valid image (JPEG, PNG) or PDF file');
        return;
      }
      // Validate file size (max 5MB)
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
        const response = await fetch('/api/employee/kyc/documents', {
            method: 'POST',
            body: formData,
        });
        if (response.ok) {
            toast.success('Document uploaded successfully!');
            fetchDocuments();
        } else {
            const errorData = await response.json();
            toast.error(errorData.message || 'Failed to upload document');
            }
        } catch (error) {
        toast.error('An error occurred while uploading the document');
        } finally {
        setUploading(false);
        setSelectedFile(null);
        setSelectedType('');
        setDocumentNumber('');
        }
    };

    const getStatusBadge = ({status}: {status: 'approved' | 'rejected' | 'pending'}) => {
        switch (status) {
        case 'approved':
            return <span className="badge badge-success flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>;
        case 'rejected':
            return <span className="badge badge-error flex items-center gap-1"><X className="w-3 h-3" /> Rejected</span>;
        default:
            return <span className="badge badge-warning flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
        }
    };

    const getDocumentLabel = (type) => {
        return DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
    };

    const requiredDocs = ['national_id', 'payslip'];
    const uploadedTypes = documents.map(d => d.document_type);
    const missingDocs = requiredDocs.filter(d => !uploadedTypes.includes(d));

    return (
    <DashboardLayout role="employee">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">KYC Documents</h1>
          <p className="text-slate-500 mt-1">Upload your verification documents to start accessing wage advances</p>
        </div>

        {/* Status Overview */}
        {missingDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4" data-testid="kyc-incomplete-alert">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900">Complete your verification</h3>
              <p className="text-sm text-amber-700 mt-1">
                You still need to upload: {missingDocs.map(d => getDocumentLabel(d)).join(', ')}
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Document
              </CardTitle>
              <CardDescription>
                Supported formats: JPEG, PNG, PDF (max 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Document Type *</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="mt-1.5" data-testid="document-type-select">
                    <SelectValue placeholder="Select document type" />
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

              <div>
                <Label>Document Number (Optional)</Label>
                <Input
                  placeholder="e.g., ID number, passport number"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="mt-1.5"
                  data-testid="document-number"
                />
              </div>

              <div>
                <Label>File *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="file-input"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "mt-1.5 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                    selectedFile 
                      ? "border-primary bg-primary/5" 
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-slate-900">{selectedFile.name}</p>
                        <p className="text-sm text-slate-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Plus className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Click to select a file</p>
                      <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
                    </>
                  )}
                </div>
              </div>

              <Button 
                className="w-full bg-primary" 
                onClick={handleUpload}
                disabled={uploading || !selectedType || !selectedFile}
                data-testid="upload-btn"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card className="border-slate-200 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Your Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No documents uploaded</p>
                  <p className="text-sm">Start by uploading your National ID</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          doc.status === 'approved' ? 'bg-emerald-100' : 
                          doc.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                        )}>
                          <FileText className={cn(
                            "w-6 h-6",
                            doc.status === 'approved' ? 'text-emerald-600' : 
                            doc.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{getDocumentLabel(doc.document_type)}</p>
                          <p className="text-sm text-slate-500">
                            {doc.document_number && `#${doc.document_number} · `}
                            Uploaded {formatDateTime(doc.created_at)}
                          </p>
                          {doc.reviewer_notes && (
                            <p className="text-sm text-red-600 mt-1">{doc.reviewer_notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc.status)}
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Requirements Info */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Document Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { type: 'national_id', required: true, description: 'Clear photo of front and back of your national ID' },
                { type: 'payslip', required: true, description: 'Recent payslip (within last 3 months)' },
                { type: 'bank_statement', required: false, description: 'Optional: Helps verify your account' },
              ].map((item) => {
                const isUploaded = uploadedTypes.includes(item.type);
                const doc = documents.find(d => d.document_type === item.type);
                return (
                  <div 
                    key={item.type}
                    className={cn(
                      "p-4 rounded-xl border-2",
                      isUploaded && doc?.status === 'approved' 
                        ? "border-emerald-200 bg-emerald-50"
                        : isUploaded
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900">{getDocumentLabel(item.type)}</span>
                      {isUploaded ? (
                        doc?.status === 'approved' ? (
                          <Check className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600" />
                        )
                      ) : item.required ? (
                        <span className="text-xs text-red-600 font-medium">Required</span>
                      ) : (
                        <span className="text-xs text-slate-400">Optional</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}