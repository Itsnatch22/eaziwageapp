"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CheckCircle2,
  Phone, Briefcase, Wallet, Check, Sparkles,
  Shield, FileText, AlertCircle, ChevronDown,
  Upload, Camera, Home, Receipt, Search,
  ScanFace, Loader2, Landmark as BankIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EMPLOYMENT_TYPES, cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth';
import { EmployeeBackground } from '@/components/employee/EmployeeLayout';

// ─── Static Data ──────────────────────────────────────────────────────────────

const COUNTRIES_OF_WORK = [
  { code: 'KE', name: 'Kenya',    providers: ['M-PESA', 'Airtel Money'] },
  { code: 'UG', name: 'Uganda',   providers: ['MTN MoMo', 'Airtel Money'] },
  { code: 'TZ', name: 'Tanzania', providers: ['M-PESA', 'Tigo Pesa'] },
  { code: 'RW', name: 'Rwanda',   providers: ['MTN MoMo', 'Airtel Money'] },
];

const TERMS_CONTENT = `Last Updated: October 2025

1. ACCEPTANCE OF TERMS
By accessing and using EaziWage's earned wage access services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.

2. ELIGIBILITY
To use our services, you must:
• Be at least 18 years of age
• Be a current employee of a registered EaziWage employer partner
• Have a valid bank account or mobile money account
• Provide accurate and complete registration information

3. SERVICE DESCRIPTION
EaziWage provides earned wage access services that allow eligible employees to access a portion of their already-earned wages before their regular payday.

4. FEES AND CHARGES
• A small processing fee applies to each advance request
• Fee rates are calculated based on risk assessment (3.5% - 6%)
• All fees are clearly displayed before you confirm any transaction
• No interest charges, late fees, or penalty fees apply

5. USER RESPONSIBILITIES
You agree to provide accurate information, keep credentials secure, and report any unauthorized access immediately.

6. REPAYMENT
Advance amounts are automatically deducted from your next paycheck via payroll reconciliation.

7. GOVERNING LAW
These terms shall be governed by the laws of the Republic of Kenya.

For questions: support@eaziwage.com`;

const PRIVACY_CONTENT = `Last Updated: October 2025

1. INTRODUCTION
EaziWage respects your privacy and is committed to protecting your personal data.

2. INFORMATION WE COLLECT
• Full name and contact details
• National identification number or passport details
• Employment information (employer, job title, salary)
• Bank account and mobile money details

3. HOW WE USE YOUR INFORMATION
• Verify your identity and eligibility
• Process advance requests and disbursements
• Calculate risk scores and determine advance limits

4. DATA SHARING
We may share your information with your employer (limited data), payment providers, and regulators when required by law. We DO NOT sell your personal data.

5. DATA SECURITY
256-bit SSL encryption for all data transmissions, with regular security audits.

For privacy inquiries: privacy@eaziwage.com`;

// ─── Types ────────────────────────────────────────────────────────────────────

type IconType = React.ComponentType<{ className?: string }>;
type IdType = 'national_id' | 'passport';

type OnboardingDocKey =
  | 'face_id' | 'id_front' | 'id_back' | 'address_proof'
  | 'tax_certificate' | 'payslip_1' | 'payslip_2'
  | 'bank_statement' | 'employment_contract';

const DOC_KEY_TO_TYPE: Record<OnboardingDocKey, string> = {
  face_id: 'face_id', id_front: 'national_id', id_back: 'national_id',
  address_proof: 'utility_bill', tax_certificate: 'tax_certificate',
  payslip_1: 'payslip', payslip_2: 'payslip',
  bank_statement: 'bank_statement', employment_contract: 'employment_contract',
};

interface UploadedDocument { name: string; url: string; }
type UploadedFilesState = Record<OnboardingDocKey, UploadedDocument | null>;

interface OnboardingFormData {
  employer_id: string; employee_code: string; national_id: string;
  id_type: IdType; nationality: string; date_of_birth: string;
  employment_type: string; job_title: string; department: string;
  monthly_salary: string; bank_name: string; bank_account: string;
  mobile_money_provider: string; mobile_money_number: string;
  country: string; tax_id: string; address_line1: string;
  address_line2: string; city: string; postal_code: string; start_date: string;
}

interface Employer {
  id: string; company_name: string; industry: string; city: string;
  country: string; countries_of_operation: string[];
}

interface FileUploaderProps {
  label: string; accept?: string; description?: string;
  onUpload: (file: File) => void; uploadedFile: UploadedDocument | null;
  uploading: boolean; required?: boolean; testId?: string;
}

interface Step { id: string; title: string; icon: IconType; }

const STEPS: Step[] = [
  { id: 'welcome',    title: 'Welcome',  icon: Sparkles },
  { id: 'terms',      title: 'Terms',    icon: Shield },
  { id: 'face_id',    title: 'Face ID',  icon: ScanFace },
  { id: 'identity',   title: 'Identity', icon: FileText },
  { id: 'address',    title: 'Address',  icon: Home },
  { id: 'tax',        title: 'Tax',      icon: Receipt },
  { id: 'employment', title: 'Job',      icon: Briefcase },
  { id: 'payment',    title: 'Payment',  icon: Wallet },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

const StepIndicator = ({ steps, currentStep }: { steps: Step[]; currentStep: number }) => (
  <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-12">
    {steps.map((step, index) => {
      const active = index === currentStep;
      const completed = index < currentStep;
      const Icon = step.icon;
      return (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2 relative">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500",
              completed ? "bg-emerald-500 text-white scale-90"
              : active ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg ring-4 ring-slate-900/10 dark:ring-white/10"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400"
            )}>
              {completed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-widest absolute -bottom-5 whitespace-nowrap transition-colors duration-300",
              active ? "text-slate-900 dark:text-white" : "text-slate-400"
            )}>
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="flex-1 h-px mx-2 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
              <div
                className="absolute inset-0 bg-emerald-500 transition-transform duration-700 ease-out origin-left"
                style={{ transform: `scaleX(${completed ? 1 : 0})` }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── File Uploader ────────────────────────────────────────────────────────────

const FileUploader = ({
  label, accept = 'image/*,application/pdf', description,
  onUpload, uploadedFile, uploading, required = false, testId
}: FileUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      toast.error('Please upload a valid image or PDF'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB'); return;
    }
    onUpload(file);
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileSelect} className="hidden" />
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 group",
          uploadedFile
            ? "border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-500/5"
            : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/50 dark:hover:bg-white/2"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing…</p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#10b98115', border: '1px solid #10b98125' }}>
              <Check className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-full px-4">{uploadedFile.name}</p>
            <p className="text-[10px] text-slate-400 font-medium">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
              <Upload className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Choose File</p>
            {description && <p className="text-[10px] text-slate-400">{description}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) => (
  <div className="text-center mb-8">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
      style={{ background: '#10b98112', border: '1px solid #10b98125' }}>
      <Icon className="w-5 h-5 text-emerald-500" />
    </div>
    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
    {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
  </div>
);

// ─── Form Field ───────────────────────────────────────────────────────────────

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Label>
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [identity, setIdentity] = useState<{ full_name?: string; email?: string } | null>(null);

  const userFullName = user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || identity?.full_name || '';
  const userFirstName = userFullName.trim().split(/\s+/)[0] || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [employerSearch, setEmployerSearch] = useState('');
  const [employersLoading, setEmployersLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsContent, setShowTermsContent] = useState(false);
  const [showPrivacyContent, setShowPrivacyContent] = useState(false);

  const [capturingFaceId, setCapturingFaceId] = useState(false);
  const [faceIdCaptured, setFaceIdCaptured] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [uploadingFile, setUploadingFile] = useState<OnboardingDocKey | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    face_id: null, id_front: null, id_back: null, address_proof: null,
    tax_certificate: null, payslip_1: null, payslip_2: null,
    bank_statement: null, employment_contract: null,
  });

  const [formData, setFormData] = useState<OnboardingFormData>({
    employer_id: '', employee_code: '', national_id: '', id_type: 'national_id',
    nationality: '', date_of_birth: '', employment_type: '', job_title: '',
    department: '', monthly_salary: '', bank_name: '', bank_account: '',
    mobile_money_provider: '', mobile_money_number: '', country: '',
    tax_id: '', address_line1: '', address_line2: '', city: '',
    postal_code: '', start_date: '',
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/employee-dashboard/profile');
        if (res.ok) {
          const data = await res.json();
          if (String(data?.profile?.employee?.kyc_status || '').toLowerCase() === 'approved') {
            router.replace('/dashboards/employee-dashboard');
          }
          setIdentity({ full_name: data?.profile?.full_name || '', email: data?.profile?.email || '' });
        }
      } catch { /* silent */ }
    };
    checkStatus();
  }, [router]);

  useEffect(() => {
    const fetchEmployers = async () => {
      setEmployersLoading(true);
      try {
        const res = await fetch('/api/employee-dashboard/employers');
        const data = await res.json();
        setEmployers(data.employers || []);
      } catch { /* silent */ }
      finally { setEmployersLoading(false); }
    };
    fetchEmployers();
  }, []);

  const filteredEmployers = employers.filter((e) =>
    e.company_name.toLowerCase().includes(employerSearch.toLowerCase())
  );

  const updateField = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file: File, docKey: OnboardingDocKey) => {
    setUploadingFile(docKey);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', DOC_KEY_TO_TYPE[docKey]);
      const res = await fetch('/api/employee-dashboard/kyc/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadedFiles(prev => ({ ...prev, [docKey]: { name: file.name, url: data.document_url } }));
      toast.success('File saved');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingFile(null);
    }
  };

  const startFaceCapture = async () => {
    try {
      setCapturingFaceId(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error('Camera access denied');
      setCapturingFaceId(false);
    }
  };

  const stopFaceCapture = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCapturingFaceId(false);
  };

  const captureFaceId = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'face_id.jpg', { type: 'image/jpeg' });
        await handleFileUpload(file, 'face_id');
        setFaceIdCaptured(true);
        stopFaceCapture();
      }
    }, 'image/jpeg', 0.8);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const docUrls: Record<string, string> = {};
      Object.entries(uploadedFiles).forEach(([k, v]) => { if (v?.url) docUrls[k] = v.url; });
      const res = await fetch('/api/employee-dashboard/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ...docUrls, monthly_salary: parseFloat(formData.monthly_salary) || 0 }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Submission failed');
      }
      toast.success('Application submitted!');
      router.push('/dashboards/employee-dashboard');
    } catch (err: any) {
      setError(err?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !agreedToTerms) return setError('Please accept the terms to continue');
    setError('');
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  };

  const prevStep = () => { setError(''); setCurrentStep(s => Math.max(0, s - 1)); };
  const retakeFaceId = () => { setFaceIdCaptured(false); setUploadedFiles(prev => ({ ...prev, face_id: null })); };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return true;
      case 1: return agreedToTerms;
      case 2: return true;
      case 3: return !!(formData.national_id && formData.date_of_birth && uploadedFiles.id_front);
      case 4: return !!(formData.country && formData.address_line1 && formData.city && uploadedFiles.address_proof);
      case 5: return true;
      case 6: return !!(formData.employer_id && formData.job_title && uploadedFiles.payslip_1);
      case 7: return !!(formData.mobile_money_number && formData.bank_account && uploadedFiles.bank_statement);
      default: return false;
    }
  };

  // ─── Step Content ──────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {

      // Welcome
      case 0: return (
        <div className="text-center py-8 space-y-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-lg"
            style={{ background: '#10b98115', border: '1px solid #10b98125' }}>
            <Sparkles className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Ready to unlock your wages{userFirstName ? `, ${userFirstName}` : ''}?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              A secure 5-minute setup to verify your account and enable instant wage access.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
            {[
              { icon: Shield, text: 'Biometric Secure' },
              { icon: Wallet, text: 'Instant Access' },
              { icon: CheckCircle2, text: 'AML Compliant' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 bg-slate-50/50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-white/5">
                <item.icon className="w-4 h-4 text-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );

      // Terms
      case 1: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={Shield} title="Legal Agreements" subtitle="Review our commitment to your privacy and security." />
          <div className="space-y-3 max-w-md mx-auto">
            {[
              { label: 'Terms of Service', content: TERMS_CONTENT, open: showTermsContent, toggle: setShowTermsContent },
              { label: 'Privacy Policy',   content: PRIVACY_CONTENT, open: showPrivacyContent, toggle: setShowPrivacyContent },
            ].map(({ label, content, open, toggle }) => (
              <div key={label} className="bg-slate-50/50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
                <button onClick={() => toggle(!open)} className="w-full p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#10b98112', border: '1px solid #10b98125' }}>
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{label}</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/5">
                    <pre className="text-[10px] text-slate-500 whitespace-pre-wrap font-sans leading-relaxed mt-3 max-h-40 overflow-y-auto">{content}</pre>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: '#10b98108', border: '1px solid #10b98118' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              <label className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                I have read and agree to the <strong className="text-slate-900 dark:text-white">Terms of Service</strong> and <strong className="text-slate-900 dark:text-white">Privacy Policy</strong>.
              </label>
            </div>
          </div>
        </div>
      );

      // Face ID
      case 2: return (
        <div className="space-y-6 py-4">
          <SectionHeader icon={ScanFace} title="Face ID Check" subtitle="Enable secure biometric login for quick access." />
          <div className="max-w-sm mx-auto">
            {faceIdCaptured && uploadedFiles.face_id ? (
              <div className="text-center py-10 rounded-3xl"
                style={{ background: '#10b98108', border: '2px solid #10b98125' }}>
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white">Face ID Captured</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Biometric data secured</p>
                <Button variant="outline" onClick={retakeFaceId} className="mt-5 rounded-xl border-slate-200 dark:border-white/10 text-xs font-bold">Retake Photo</Button>
              </div>
            ) : capturingFaceId ? (
              <div className="space-y-4">
                <div className="relative bg-black rounded-3xl overflow-hidden aspect-square shadow-xl ring-4 ring-slate-100 dark:ring-white/10">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[70%] h-[80%] border-2 border-white/30 rounded-[100%] shadow-[0_0_0_1000px_rgba(0,0,0,0.4)]" />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={stopFaceCapture} className="flex-1 h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-white/10">Cancel</Button>
                  <Button onClick={captureFaceId} disabled={uploadingFile === 'face_id'} className="flex-1 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-widest">
                    {uploadingFile === 'face_id' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Capture'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <ScanFace className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto mb-5" />
                <Button onClick={startFaceCapture} className="h-12 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-widest shadow-md hover:scale-105 transition-all">
                  <Camera className="w-4 h-4 mr-2" /> Start Camera
                </Button>
                <p className="mt-4 text-[10px] text-slate-400 font-medium">You can also skip this step for now</p>
              </div>
            )}
          </div>
        </div>
      );

      // Identity
      case 3: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={FileText} title="Identity" subtitle="Official identification for KYC compliance." />
          <div className="max-w-md mx-auto space-y-4">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/10">
              {(['national_id', 'passport'] as IdType[]).map((type) => (
                <button key={type} onClick={() => updateField('id_type', type)}
                  className={cn("py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    formData.id_type === type ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                  {type === 'national_id' ? 'National ID' : 'Passport'}
                </button>
              ))}
            </div>
            <FormField label={`${formData.id_type === 'passport' ? 'Passport' : 'ID'} Number`}>
              <Input value={formData.national_id} onChange={e => updateField('national_id', e.target.value)} placeholder="Enter number…" className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" />
            </FormField>
            <FormField label="Date of Birth">
              <Input type="date" value={formData.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" />
            </FormField>
            <FileUploader label="Document Photo (Front)" onUpload={(f) => handleFileUpload(f, 'id_front')} uploadedFile={uploadedFiles.id_front} uploading={uploadingFile === 'id_front'} required />
          </div>
        </div>
      );

      // Address
      case 4: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={Home} title="Address Verification" subtitle="Your current residential address." />
          <div className="max-w-md mx-auto space-y-4">
            <FormField label="Country of Work *">
              <Select value={formData.country} onValueChange={(v) => updateField('country', v)}>
                <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES_OF_WORK.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 mt-1">EaziWage operates in Kenya, Uganda, Tanzania, and Rwanda</p>
            </FormField>
            <FormField label="Address Line 1 *">
              <Input placeholder="Street address, P.O. box" value={formData.address_line1} onChange={e => updateField('address_line1', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-address1" />
            </FormField>
            <FormField label="Address Line 2">
              <Input placeholder="Apartment, suite (optional)" value={formData.address_line2} onChange={e => updateField('address_line2', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-address2" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City *">
                <Input placeholder="e.g. Nairobi" value={formData.city} onChange={e => updateField('city', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-city" />
              </FormField>
              <FormField label="Postal Code">
                <Input placeholder="e.g. 00100" value={formData.postal_code} onChange={e => updateField('postal_code', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-postal" />
              </FormField>
            </div>
            <div className="p-4 rounded-2xl space-y-3" style={{ background: '#10b98108', border: '1px solid #10b98118' }}>
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-500" /> Proof of Address *
              </p>
              <p className="text-[10px] text-slate-500">Utility bill, bank statement, or lease agreement (less than 3 months old)</p>
              <FileUploader label="Address Document" onUpload={(f) => handleFileUpload(f, 'address_proof')} uploadedFile={uploadedFiles.address_proof} uploading={uploadingFile === 'address_proof'} testId="upload-address-proof" required />
            </div>
          </div>
        </div>
      );

      // Tax
      case 5: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={Receipt} title="Tax Information" subtitle="Required for financial compliance in all operating countries." />
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex gap-3 p-4 bg-amber-50/50 dark:bg-amber-500/5 rounded-2xl border border-amber-200/50 dark:border-amber-500/15">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Why we need this:</strong> Tax compliance is required by financial regulations in all our operating countries.
              </p>
            </div>
            <FormField label="Tax Identification Number (TIN)">
              <Input placeholder="Enter your TIN" value={formData.tax_id} onChange={e => updateField('tax_id', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" data-testid="onboarding-tin" />
              <p className="text-[10px] text-slate-400 mt-1">Known as PIN in Kenya, TIN in Tanzania, Uganda & Rwanda</p>
            </FormField>
            <FileUploader label="Tax Certificate (Optional)" description="TIN or compliance certificate" onUpload={(f) => handleFileUpload(f, 'tax_certificate')} uploadedFile={uploadedFiles.tax_certificate} uploading={uploadingFile === 'tax_certificate'} testId="upload-tax-cert" />
            <p className="text-center text-xs text-slate-400">
              Don&apos;t have your TIN yet?{' '}
              <button type="button" onClick={nextStep} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Skip for now</button>
            </p>
          </div>
        </div>
      );

      // Employment
      case 6: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={Briefcase} title="Employment" subtitle="Verify your active status with your employer." />
          <div className="max-w-md mx-auto space-y-4">
            <FormField label="Select Employer">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={employerSearch} onChange={e => setEmployerSearch(e.target.value)} placeholder="Search companies…" className="pl-9 h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-100 dark:border-white/10 divide-y divide-slate-50 dark:divide-white/5 bg-white/50 dark:bg-white/2">
                {employersLoading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mx-auto mb-1" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Searching partners…</p>
                  </div>
                ) : filteredEmployers.length > 0 ? (
                  filteredEmployers.map(emp => (
                    <button key={emp.id} onClick={() => updateField('employer_id', emp.id)}
                      className={cn("w-full text-left px-4 py-3 text-xs font-bold flex items-center justify-between transition-colors",
                        formData.employer_id === emp.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300")}>
                      <div>
                        <p>{emp.company_name}</p>
                        <p className={cn("text-[9px] uppercase tracking-wider font-semibold mt-0.5", formData.employer_id === emp.id ? "opacity-60" : "text-slate-400")}>
                          {emp.industry} · {emp.city}, {emp.country}
                        </p>
                      </div>
                      {formData.employer_id === emp.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">No matching partners</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1.5">Don&apos;t see your employer? Use your company code:</p>
                <Input value={formData.employee_code} onChange={e => updateField('employee_code', e.target.value)} placeholder="e.g. CO-12345" className="h-10 rounded-xl bg-slate-50 dark:bg-white/2 border-slate-100 dark:border-white/10 text-xs" />
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Job Title">
                <Input value={formData.job_title} onChange={e => updateField('job_title', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" placeholder="e.g. Sales Manager" />
              </FormField>
              <FormField label="Employment Type">
                <Select value={formData.employment_type} onValueChange={v => updateField('employment_type', v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Monthly Salary (Gross)">
              <Input type="number" value={formData.monthly_salary} onChange={e => updateField('monthly_salary', e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-white/3 border-slate-100 dark:border-white/10" placeholder="Enter amount…" />
            </FormField>
            <FileUploader label="Latest Payslip" onUpload={(f) => handleFileUpload(f, 'payslip_1')} uploadedFile={uploadedFiles.payslip_1} uploading={uploadingFile === 'payslip_1'} required />
          </div>
        </div>
      );

      // Payment
      case 7: return (
        <div className="space-y-5 py-4">
          <SectionHeader icon={Wallet} title="Payout Details" subtitle="Where should we send your funds?" />
          <div className="max-w-md mx-auto space-y-4">
            {/* Bank */}
            <div className="p-4 rounded-2xl space-y-3" style={{ background: '#10b98108', border: '1px solid #10b98118' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <BankIcon className="w-3.5 h-3.5" /> Bank Details
              </p>
              <Input value={formData.bank_name} onChange={e => updateField('bank_name', e.target.value)} placeholder="Bank Name" className="h-11 rounded-xl bg-white/80 dark:bg-white/3 border-slate-100 dark:border-white/10" />
              <Input value={formData.bank_account} onChange={e => updateField('bank_account', e.target.value)} placeholder="Account Number" className="h-11 rounded-xl bg-white/80 dark:bg-white/3 border-slate-100 dark:border-white/10" />
            </div>

            {/* Mobile Money */}
            <div className="p-4 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-white/2 border border-slate-100 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Mobile Money
              </p>
              <Select value={formData.mobile_money_provider} onValueChange={v => updateField('mobile_money_provider', v)}>
                <SelectTrigger className="h-11 rounded-xl bg-white/80 dark:bg-white/3 border-slate-100 dark:border-white/10">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M-PESA">M-PESA</SelectItem>
                  <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                </SelectContent>
              </Select>
              <Input value={formData.mobile_money_number} onChange={e => updateField('mobile_money_number', e.target.value)} placeholder="Mobile Number" className="h-11 rounded-xl bg-white/80 dark:bg-white/3 border-slate-100 dark:border-white/10" />
            </div>

            <FileUploader label="Recent Bank Statement" onUpload={(f) => handleFileUpload(f, 'bank_statement')} uploadedFile={uploadedFiles.bank_statement} uploading={uploadingFile === 'bank_statement'} required />
          </div>
        </div>
      );

      default: return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative flex flex-col">
      <EmployeeBackground />

      {/* Header */}
      <header className="relative z-10 w-full px-6 py-6 flex justify-center">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
            <span className="text-white dark:text-slate-900 font-black text-lg">E</span>
          </div>
          <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto px-4 pb-24">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        <div className="mt-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
              style={{ background: '#ef444410', border: '1px solid #ef444425' }}>
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-white/60 dark:bg-white/3 backdrop-blur-2xl rounded-3xl p-6 md:p-10 border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/30 dark:shadow-black/20">
            {renderStepContent()}
          </div>

          <div className="flex items-center justify-between gap-4 max-w-sm mx-auto">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="h-12 px-6 rounded-2xl font-bold uppercase tracking-widest text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-0 transition-all"
            >
              Back
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={loading || !canProceed()}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}