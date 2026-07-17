"use client";

import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Phone,
  Briefcase,
  Wallet,
  Check,
  Sparkles,
  Shield,
  FileText,
  AlertCircle,
  ChevronDown,
  Upload,
  Camera,
  Home,
  Receipt,
  Search,
  ScanFace,
  Loader2,
  MapPin,
  Landmark as BankIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth";
import { EmployeeBackground } from "@/components/employee/EmployeeLayout";
import {
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  isDocumentFile,
  isImageFile,
} from "@/lib/upload-file-types";
import { DocTooltip } from "@/components/shared/DocTooltip";
import { SubmitButton } from "@/components/ui/SubmitButton";

const COUNTRIES_OF_WORK = [
  { code: "KE", name: "Kenya", providers: ["M-PESA", "Airtel Money"] },
  { code: "UG", name: "Uganda", providers: ["MTN MoMo", "Airtel Money"] },
  { code: "TZ", name: "Tanzania", providers: ["M-PESA", "Tigo Pesa"] },
  { code: "RW", name: "Rwanda", providers: ["MTN MoMo", "Airtel Money"] },
];

const BANKS_BY_COUNTRY: Record<string, string[]> = {
  KE: [
    "Absa Bank Kenya",
    "Access Bank Kenya",
    "African Banking Corporation",
    "Bank of Africa Kenya",
    "Bank of Baroda Kenya",
    "Bank of India Kenya",
    "Citibank N.A. Kenya",
    "Commercial International Bank (CIB)",
    "Co-operative Bank of Kenya",
    "Credit Bank",
    "Diamond Trust Bank (DTB)",
    "Ecobank Kenya",
    "Equity Bank Kenya",
    "Family Bank",
    "First Community Bank",
    "Gulf African Bank",
    "Housing Finance Company",
    "I&M Bank Kenya",
    "KCB Bank Kenya",
    "Middle East Bank Kenya",
    "NCBA Bank Kenya",
    "Prime Bank",
    "SBM Bank Kenya",
    "Stanbic Bank Kenya",
    "Standard Chartered Kenya",
    "UBA Kenya",
    "Victoria Commercial Bank",
    "Zenith Bank Kenya",
  ],
  TZ: [
    "CRDB Bank",
    "NMB Bank",
    "NBC Bank",
    "Absa Bank Tanzania",
    "Stanbic Bank Tanzania",
    "Standard Chartered Tanzania",
    "Citibank Tanzania",
    "Diamond Trust Bank Tanzania",
    "Ecobank Tanzania",
    "Exim Bank Tanzania",
    "KCB Bank Tanzania",
    "Bank of Africa Tanzania",
    "Access Bank Tanzania",
    "Equity Bank Tanzania",
    "I&M Bank Tanzania",
    "Bank of India Tanzania",
    "United Bank for Africa Tanzania",
    "Mkombozi Commercial Bank",
    "DCB Commercial Bank",
    "Azania Bank",
  ],
  UG: [
    "Absa Bank Uganda",
    "Access Bank Uganda",
    "Bank of Africa Uganda",
    "Bank of Baroda Uganda",
    "Bank of India Uganda",
    "Cairo Bank Uganda",
    "Centenary Bank",
    "Citibank Uganda",
    "DFCU Bank",
    "Diamond Trust Bank Uganda",
    "Ecobank Uganda",
    "Equity Bank Uganda",
    "Exim Bank Uganda",
    "Housing Finance Bank",
    "I&M Bank Uganda",
    "KCB Bank Uganda",
    "NCBA Bank Uganda",
    "PostBank Uganda",
    "Salaam Bank Uganda",
    "Stanbic Bank Uganda",
    "Standard Chartered Uganda",
    "Tropical Bank",
    "United Bank for Africa Uganda",
  ],
  RW: [
    "Bank of Kigali",
    "BPR Bank Rwanda",
    "I&M Bank Rwanda",
    "Ecobank Rwanda",
    "GT Bank Rwanda",
    "Equity Bank Rwanda",
    "NCBA Rwanda",
    "Access Bank Rwanda",
    "Bank of Africa Rwanda",
    "KCB Bank Rwanda",
    "Urwego Bank",
    "AB Bank Rwanda",
    "Cogebanque",
    "Zigama CSS",
    "Development Bank of Rwanda (BRD)",
    "Unguka Bank",
  ],
};

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
EaziWage provides earned wage access services that allow eligible employees to access a portion of their already-earned wages before their regular payday. Key features include:
• Real-time tracking of earned wages
• Instant transfers to mobile money or bank accounts
• Transparent fee structure with no hidden charges
• 24/7 access through our mobile and web platforms

4. FEES AND CHARGES
• A small processing fee applies to each advance request
• Fee rates are calculated based on risk assessment (3.5% - 6%)
• All fees are clearly displayed before you confirm any transaction
• No interest charges, late fees, or penalty fees apply

5. USER RESPONSIBILITIES
You agree to:
• Provide accurate information during registration
• Keep your login credentials secure
• Use the service only for personal financial needs
• Not share your account with others
• Report any unauthorized access immediately

6. REPAYMENT
• Advance amounts are automatically deducted from your next paycheck
• Your employer facilitates the repayment process
• No manual repayment action is required from you

7. DATA PROTECTION
We are committed to protecting your personal information in accordance with applicable data protection laws.

8. LIMITATION OF LIABILITY
EaziWage shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.

9. TERMINATION
Either party may terminate this agreement at any time. Upon termination, any outstanding advance amounts must be repaid.

10. GOVERNING LAW
These terms shall be governed by the laws of the Republic of Kenya, with jurisdiction in the courts of Nairobi.

For questions, contact: support@eaziwage.com`;

const PRIVACY_CONTENT = `Last Updated: October 2025

1. INTRODUCTION
EaziWage respects your privacy and is committed to protecting your personal data.

2. INFORMATION WE COLLECT
• Full name and contact details
• National identification number or passport details
• Date of birth
• Employment information (employer, job title, salary)
• Bank account and mobile money details

3. HOW WE USE YOUR INFORMATION
• Verify your identity and eligibility
• Process advance requests and disbursements
• Calculate risk scores and determine advance limits
• Communicate with you about your account

4. DATA SHARING
We may share your information with:
• Your employer (limited employment verification data only)
• Mobile money providers and banks for disbursements
• Regulatory authorities when required by law

We DO NOT sell your personal data to third parties.

5. DATA SECURITY
• 256-bit SSL encryption for all data transmissions
• Regular security audits and penetration testing

6. YOUR RIGHTS
• Access, correct, or request deletion of your personal data
• Data portability

For privacy inquiries: privacy@eaziwage.com`;


type IconType = React.ComponentType<{ className?: string }>;
type IdType = "national_id" | "passport";

type OnboardingDocKey =
  | "face_id"
  | "id_front"
  | "id_back"
  | "address_proof"
  | "tax_certificate"
  | "payslip_1"
  | "payslip_2"
  | "bank_statement"
  | "employment_contract";

// docKey and the employee_kyc_documents.document_type CHECK constraint values
// are now identical for all 8 real documents — this used to remap onto a
// stale, broader taxonomy (national_id/utility_bill/payslip) that the CHECK
// constraint no longer accepts, which made every upload except
// tax_certificate/bank_statement/employment_contract fail outright.
const DOC_KEY_TO_TYPE: Record<OnboardingDocKey, string> = {
  face_id: "face_id",
  id_front: "id_front",
  id_back: "id_back",
  address_proof: "address_proof",
  tax_certificate: "tax_certificate",
  payslip_1: "payslip_1",
  payslip_2: "payslip_2",
  bank_statement: "bank_statement",
  employment_contract: "employment_contract",
};

interface UploadedDocument {
  name: string;
  url: string;
}

type UploadedFilesState = Record<OnboardingDocKey, UploadedDocument | null>;

interface OnboardingFormData {
  employer_id: string;
  employee_code: string;
  company_code: string;
  national_id: string;
  id_type: IdType;
  nationality: string;
  date_of_birth: string;
  employment_type: string;
  job_title: string;
  department: string;
  monthly_salary: string;
  bank_name: string;
  bank_account: string;
  mobile_money_provider: string;
  mobile_money_number: string;
  country: string;
  tax_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  start_date: string;
  joining_month: string;
  joining_year: string;
}

interface Employer {
  id: string;
  company_name: string;
  industry: string;
  city: string;
  country: string;
  countries_of_operation: string[];
}

interface FileUploaderProps {
  label: string;
  accept?: string;
  kind?: "image" | "document";
  description?: string;
  tooltip?: string;
  onUpload: (file: File) => void;
  uploadedFile: UploadedDocument | null;
  uploading: boolean;
  required?: boolean;
  testId?: string;
  /** Already on file and not rejected — render as non-interactive so the user
   *  is never prompted to re-upload something that wasn't flagged. */
  locked?: boolean;
}

interface Step {
  id: string;
  title: string;
  icon: IconType;
}


const STEPS: Step[] = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "terms", title: "Terms", icon: Shield },
  { id: "face_id", title: "Face ID", icon: ScanFace },
  { id: "identity", title: "Identity", icon: FileText },
  { id: "address", title: "Address", icon: Home },
  { id: "tax", title: "Tax", icon: Receipt },
  { id: "employment", title: "Job", icon: Briefcase },
  { id: "payment", title: "Payment", icon: Wallet },
];

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const StepIndicator = ({ steps, currentStep }: StepIndicatorProps) => (
  <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-12">
    {steps.map((step, index) => {
      const active = index === currentStep;
      const completed = index < currentStep;
      const Icon = step.icon;

      return (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2 group relative">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                completed
                  ? "bg-primary text-white scale-90"
                  : active
                    ? "bg-primary text-white shadow-xl shadow-primary/25 ring-4 ring-primary/10"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400",
              )}
            >
              {completed ? (
                <Check className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest absolute -bottom-6 whitespace-nowrap transition-colors duration-300",
                active ? "text-primary" : "text-slate-400",
              )}
            >
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-2 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
              <div
                className="absolute inset-0 bg-primary transition-transform duration-700 ease-in-out origin-left"
                style={{ transform: `scaleX(${completed ? 1 : 0})` }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const FileUploader = ({
  label,
  accept,
  kind = "document",
  description,
  onUpload,
  uploadedFile,
  uploading,
  required = false,
  testId,
  tooltip,
  locked = false,
}: FileUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndUpload(file);
  };

  const validateAndUpload = (file: File) => {
    const validFile =
      kind === "image" ? isImageFile(file) : isDocumentFile(file);
    if (!validFile) {
      toast.error(
        kind === "image"
          ? "Please upload an image file"
          : "Please upload an image or document file",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    onUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev - 1);
    if (dragCounter === 1) {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndUpload(file);
    }

    setDragActive(false);
    setDragCounter(0);
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {tooltip && <DocTooltip content={tooltip} />}
      </Label>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept ?? (kind === "image" ? IMAGE_ACCEPT : DOCUMENT_ACCEPT)}
        onChange={handleFileSelect}
        className="hidden"
      />
      <div
        onClick={() => !uploading && !locked && fileInputRef.current?.click()}
        onDragEnter={locked ? undefined : handleDragIn}
        onDragLeave={locked ? undefined : handleDragOut}
        onDragOver={locked ? undefined : handleDrag}
        onDrop={locked ? undefined : handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 group",
          locked
            ? "cursor-default border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10"
            : "cursor-pointer",
          !locked && dragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : !locked && uploadedFile
              ? "border-primary bg-primary/3 dark:bg-primary/3"
              : !locked
                ? "border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                : "",
        )}
      >
        {locked ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Already submitted
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              No action needed
            </p>
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Processing...
            </p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-full px-4">
              {uploadedFile.name}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Click to replace
            </p>
          </div>
        ) : dragActive ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary animate-pulse">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest">
              Drop file here
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              Release to upload
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Choose File or Drag & Drop
            </p>
            {description && (
              <p className="text-[10px] text-slate-400 font-medium">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Onboarding() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [identity, setIdentity] = useState<{
    full_name?: string;
    email?: string;
  } | null>(null);
  const userFullName =
    user?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    identity?.full_name ||
    "";
  const userFirstName = userFullName.trim().split(/\s+/)[0] || "";

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [employerSearch, setEmployerSearch] = useState("");
  const [employersLoading, setEmployersLoading] = useState(false);
  const [error, setError] = useState("");
  const [geolocating, setGeolocating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsContent, setShowTermsContent] = useState(false);
  const [showPrivacyContent, setShowPrivacyContent] = useState(false);


  const [capturingFaceId, setCapturingFaceId] = useState(false);
  const [faceIdCaptured, setFaceIdCaptured] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceIdFileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingFile, setUploadingFile] = useState<OnboardingDocKey | null>(
    null,
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    face_id: null,
    id_front: null,
    id_back: null,
    address_proof: null,
    tax_certificate: null,
    payslip_1: null,
    payslip_2: null,
    bank_statement: null,
    employment_contract: null,
  });
  // Per-document KYC review state, keyed by document_type (== OnboardingDocKey
  // for the 8 real documents). Drives which upload slots render locked
  // ("already submitted, no action needed") vs. open for a fresh upload, and
  // surfaces the admin's reviewer_notes only next to the document that was
  // actually rejected — never the whole application.
  const [kycDocReview, setKycDocReview] = useState<
    Partial<Record<OnboardingDocKey, { status: string; reviewer_notes: string | null }>>
  >({});
  const isDocLocked = (docKey: OnboardingDocKey) => {
    const doc = kycDocReview[docKey];
    return Boolean(doc && doc.status !== "rejected");
  };
  const rejectionNote = (docKey: OnboardingDocKey) => {
    const doc = kycDocReview[docKey];
    return doc?.status === "rejected" ? doc.reviewer_notes : null;
  };

  const [formData, setFormData] = useState<OnboardingFormData>({
    employer_id: "",
    employee_code: "",
    company_code: "",
    national_id: "",
    id_type: "national_id",
    nationality: "",
    date_of_birth: "",
    employment_type: "",
    job_title: "",
    department: "",
    monthly_salary: "",
    bank_name: "",
    bank_account: "",
    mobile_money_provider: "",
    mobile_money_number: "",
    country: "",
    tax_id: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
    start_date: "",
    joining_month: "",
    joining_year: "",
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/employee-dashboard/profile");
        if (res.ok) {
          const data = await res.json();
          const profile = data?.profile?.employee;
          const status = String(profile?.kyc_status || "").toLowerCase();

          setIdentity({
            full_name: data?.profile?.full_name || "",
            email: data?.profile?.email || "",
          });

          // Pre-populate employer from the registration stub so employees who
          // registered with a company code don't have to re-enter it.
          if (profile?.employer_id && status !== "rejected") {
            setFormData((prev) => ({
              ...prev,
              employer_id: profile.employer_id,
            }));
          }

          if (status === "rejected" && profile) {
            setCurrentStep(2);
            setFormData((prev) => ({
              ...prev,
              employer_id: profile.employer_id || "",
              employee_code: profile.employee_code || "",
              national_id: profile.national_id || "",
              id_type: profile.id_type || "national_id",
              nationality: profile.nationality || "",
              date_of_birth: profile.date_of_birth || "",
              employment_type: profile.employment_type || "",
              job_title: profile.job_title || "",
              department: profile.department || "",
              monthly_salary: profile.monthly_salary?.toString() || "",
              bank_name: profile.bank_name || "",
              bank_account: profile.bank_account || "",
              mobile_money_provider: profile.mobile_money_provider || "",
              mobile_money_number: profile.mobile_money_number || "",
              country: profile.country || "",
              tax_id: profile.tax_id || "",
              address_line1: profile.address_line1 || "",
              address_line2: profile.address_line2 || "",
              city: profile.city || "",
              postal_code: profile.postal_code || "",
              start_date: profile.start_date || "",
            }));

            // Show only the document(s) an admin actually rejected, with the
            // reason — every other document (approved, pending, or
            // under_review) renders locked via FileUploader's `locked` prop
            // instead of being re-presented as an editable upload slot.
            // (employee_onboarding no longer has per-document URL columns to
            // read here — document_type/status/reviewer_notes come from
            // employee_kyc_documents via /api/employee-dashboard/profile's
            // kycDocuments array.)
            const kycDocuments: {
              document_type: string;
              status: string;
              reviewer_notes: string | null;
            }[] = Array.isArray(data?.profile?.kycDocuments)
              ? data.profile.kycDocuments
              : [];
            const reviewByType: Partial<
              Record<OnboardingDocKey, { status: string; reviewer_notes: string | null }>
            > = {};
            kycDocuments.forEach((d) => {
              reviewByType[d.document_type as OnboardingDocKey] = {
                status: d.status,
                reviewer_notes: d.reviewer_notes,
              };
            });
            setKycDocReview(reviewByType);
          }
        }
      } catch {
        
      }
    };
    checkStatus();
  }, [router]);

  useEffect(() => {
    async function checkExistingStatus() {
      try {
        const res = await fetch("/api/employee-dashboard/profile");
        if (res.ok) {
          const data = await res.json();
          const status = String(
            data?.profile?.employee?.kyc_status || "",
          ).toLowerCase();
          if (status === "approved") {
            router.replace("/dashboards/employee-dashboard");
          }
          setIdentity({
            full_name: data?.profile?.full_name || "",
            email: data?.profile?.email || "",
          });
        }
      } catch (err) {
        console.error("Failed to check status:", err);
      }
    }
    checkExistingStatus();
  }, [router]);

  useEffect(() => {
    const fetchEmployers = async () => {
      setEmployersLoading(true);
      try {
        const res = await fetch("/api/employers/public/approved");
        const data = await res.json();
        setEmployers(Array.isArray(data) ? data : (data.employers || []));
      } catch (err) {
        console.error("Failed to fetch employers:", err);
      } finally {
        setEmployersLoading(false);
      }
    };
    fetchEmployers();
  }, []);

  const filteredEmployers = employers.filter((e) =>
    e.company_name.toLowerCase().includes(employerSearch.toLowerCase()),
  );

  const updateField = <K extends keyof OnboardingFormData>(
    field: K,
    value: OnboardingFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Proxied server-side — Nominatim never returns CORS headers for
          // browser-originated requests, so calling it directly from here
          // fails silently every time.
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error("Geocoding failed");
          const geo = await res.json() as { address?: Record<string, string> };
          const addr = geo.address ?? {};

          const countryCode = (addr.country_code ?? "").toUpperCase();
          const validCodes = COUNTRIES_OF_WORK.map((c) => c.code);
          const road = [addr.house_number, addr.road].filter(Boolean).join(" ");
          const line1 = road || addr.neighbourhood || "";
          const line2 = addr.suburb && addr.suburb !== line1 ? addr.suburb : "";
          const city = addr.city || addr.town || addr.village || addr.municipality || "";

          setFormData((prev) => ({
            ...prev,
            ...(validCodes.includes(countryCode) && { country: countryCode }),
            ...(line1 && { address_line1: line1 }),
            ...(line2 && { address_line2: line2 }),
            ...(city && { city }),
            ...(addr.postcode && { postal_code: addr.postcode }),
          }));
          toast.success("Location detected — please verify the address below.");
        } catch {
          toast.error("Couldn't fetch address details. Please enter manually.");
        } finally {
          setGeolocating(false);
        }
      },
      (err) => {
        setGeolocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location access denied. Please enter your address manually.");
        } else {
          toast.error("Couldn't get your location. Please enter manually.");
        }
      },
      { timeout: 10000 },
    );
  };

  const handleFileUpload = async (file: File, docKey: OnboardingDocKey) => {
    setUploadingFile(docKey);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", DOC_KEY_TO_TYPE[docKey]);

      const res = await fetch("/api/employee-dashboard/kyc/documents", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadedFiles((prev) => ({
        ...prev,
        [docKey]: { name: file.name, url: data.document_url },
      }));
      toast.success("File saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFile(null);
    }
  };


  // Assign the stream to the video element once it's mounted in the DOM.
  useEffect(() => {
    if (capturingFaceId && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [capturingFaceId]);

  // Stop the camera track when the component unmounts mid-capture.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (detectionInterval.current) clearInterval(detectionInterval.current);
    };
  }, []);

  // Load tiny face detector model when step 2 mounts — fail open so model errors never block onboarding.
  useEffect(() => {
    if (currentStep !== 2 || modelLoaded) return;
    faceapi.nets.tinyFaceDetector
      .loadFromUri("/models")
      .then(() => setModelLoaded(true))
      .catch(() => {
        console.warn("[FaceCapture] Model failed to load, skipping detection");
        setModelLoaded(true); // fail open — allow capture without detection
        setFaceDetected(true);
      });
  }, [currentStep, modelLoaded]);

  // Run detection loop while camera is active.
  useEffect(() => {
    if (!capturingFaceId || !modelLoaded) return;

    detectionInterval.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }),
        );
        setFaceDetected(!!detection);
      } catch {
        // Video not ready yet — ignore and wait for next tick
      }
    }, 300);

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      setFaceDetected(false);
    };
  }, [capturingFaceId, modelLoaded]);

  const startFaceCapture = async () => {
    try {
      // Acquire the stream before setting state so the video element is
      // guaranteed to be in the DOM when we assign srcObject.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      setCapturingFaceId(true);
      setCameraUnavailable(false);
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error("Camera permission denied. Please allow camera access and try again, or upload a photo instead.");
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        toast.error("Camera is in use by another app. Close it and try again, or upload a photo instead.");
      } else if (name === 'NotFoundError') {
        toast.error("No camera found on this device. Upload a photo instead.");
      } else {
        toast.error("Could not start camera. Please try again, or upload a photo instead.");
      }
      setCapturingFaceId(false);
      // Camera access can be permanently blocked (site permission set to
      // "never allow"), a device with no camera, or hardware already in use
      // by another app — none of which the "Start Camera" retry button can
      // fix on its own, and without this fallback the employee is stuck and
      // cannot complete onboarding at all. Surface a manual upload option
      // instead of leaving them at a dead end.
      setCameraUnavailable(true);
    }
  };

  const handleManualFaceIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleFileUpload(file, "face_id");
    setFaceIdCaptured(true);
  };

  const stopFaceCapture = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturingFaceId(false);
  };

  const captureFaceId = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Guard against capturing before the video stream has loaded frames.
    if (video.readyState < 2 || video.videoWidth === 0) {
      toast.error("Camera isn't ready yet — please wait a moment and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const file = new File([blob], "face_id.jpg", { type: "image/jpeg" });
          await handleFileUpload(file, "face_id");
          setFaceIdCaptured(true);
          stopFaceCapture();
        }
      },
      "image/jpeg",
      0.8,
    );
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const docUrls: Record<string, string> = {};
      Object.entries(uploadedFiles).forEach(([k, v]) => {
        if (v?.url) docUrls[k] = v.url;
      });

      let finalStartDate = formData.start_date;
      if (formData.joining_month && formData.joining_year) {
        finalStartDate = `${formData.joining_year}-${formData.joining_month}-01`;
      }




      const payload = {
        employer_id: formData.employer_id || undefined,
        company_code: formData.company_code || undefined,
        employee_code: formData.employee_code || undefined,
        national_id: formData.national_id,
        id_type: formData.id_type,
        nationality: formData.nationality,
        date_of_birth: formData.date_of_birth,
        country: formData.country,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || undefined,
        city: formData.city,
        postal_code: formData.postal_code || undefined,
        tax_id: formData.tax_id || undefined,
        job_title: formData.job_title,
        department: formData.department || undefined,
        employment_type: formData.employment_type,
        start_date: finalStartDate || undefined,
        monthly_salary: parseFloat(formData.monthly_salary) || 0,
        bank_name: formData.bank_name,
        bank_account: formData.bank_account,
        mobile_money_provider: formData.mobile_money_provider,
        mobile_money_number: formData.mobile_money_number,
        ...docUrls,
      };

      const res = await fetch("/api/employee-dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Submission failed");
      }

      toast.success("Application submitted!");
      router.push("/dashboards/employee-dashboard/payment-methods");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !agreedToTerms)
      return setError("Please accept terms");
    setError("");
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
  };

  const prevStep = () => {
    setError("");
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const retakeFaceId = () => {
    setFaceIdCaptured(false);
    setUploadedFiles((prev) => ({ ...prev, face_id: null }));
    startFaceCapture();
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return agreedToTerms;
      case 2:
        return faceIdCaptured && !!uploadedFiles.face_id;
      case 3:
        return !!(
          formData.national_id &&
          formData.date_of_birth &&
          (uploadedFiles.id_front || isDocLocked("id_front")) &&
          (uploadedFiles.id_back || isDocLocked("id_back"))
        );
      case 4:
        return !!(
          formData.country &&
          formData.address_line1 &&
          formData.city &&
          (uploadedFiles.address_proof || isDocLocked("address_proof"))
        );
      case 5:
        return !!(uploadedFiles.tax_certificate || isDocLocked("tax_certificate"));
      case 6:
        return !!(
          (formData.employer_id || formData.company_code) &&
          formData.job_title &&
          formData.joining_month &&
          formData.joining_year &&
          (uploadedFiles.payslip_1 || isDocLocked("payslip_1")) &&
          (uploadedFiles.payslip_2 || isDocLocked("payslip_2")) &&
          (uploadedFiles.employment_contract || isDocLocked("employment_contract"))
        );

      case 7:
        return !!(
          formData.country &&
          formData.bank_name &&
          formData.mobile_money_number &&
          formData.bank_account &&
          (uploadedFiles.bank_statement || isDocLocked("bank_statement"))
        );
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-linear-to-br from-primary to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/25">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">
              Ready to unlock your wages
              {userFirstName ? `, ${userFirstName}` : ""}?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-md mx-auto leading-relaxed">
              Let&apos;s get you verified. This secure process takes less than 5
              minutes and ensures your account stays private.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Shield, text: "Biometric Secure" },
                { icon: Wallet, text: "Instant Access" },
                { icon: CheckCircle2, text: "AML Compliant" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50/50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-slate-800/50"
                >
                  <item.icon className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Legal Agreements
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Review our commitment to your privacy and security.
              </p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  onClick={() => setShowTermsContent(!showTermsContent)}
                  className="w-full p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm">Terms of Service</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      showTermsContent && "rotate-180",
                    )}
                  />
                </button>
                {showTermsContent && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto">
                    <pre className="text-[10px] text-slate-500 whitespace-pre-wrap font-sans leading-relaxed">
                      {TERMS_CONTENT}
                    </pre>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  onClick={() => setShowPrivacyContent(!showPrivacyContent)}
                  className="w-full p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm">Privacy Policy</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      showPrivacyContent && "rotate-180",
                    )}
                  />
                </button>
                {showPrivacyContent && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto">
                    <pre className="text-[10px] text-slate-500 whitespace-pre-wrap font-sans leading-relaxed">
                      {PRIVACY_CONTENT}
                    </pre>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded-lg border-primary text-primary focus:ring-primary"
                />
                <label className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  I have read and agree to the <strong>Terms of Service</strong>{" "}
                  and <strong>Privacy Policy</strong>.
                </label>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Face ID Check
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Enable secure biometric login for quick access.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              {faceIdCaptured && uploadedFiles.face_id ? (
                <div className="text-center py-10 bg-emerald-500/5 rounded-3xl border-2 border-emerald-500/20">
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/25">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    Face ID Captured
                  </h4>
                  <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-widest">
                    Biometric data secured
                  </p>
                  <Button
                    variant="outline"
                    onClick={retakeFaceId}
                    className="mt-6 rounded-xl border-slate-200"
                  >
                    Retake Photo
                  </Button>
                </div>
              ) : capturingFaceId ? (
                <div className="space-y-6">
                  <div className="relative bg-black rounded-[2rem] overflow-hidden aspect-square shadow-2xl ring-8 ring-slate-100 dark:ring-slate-900">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[70%] h-[80%] border-2 border-white/30 rounded-[100%] shadow-[0_0_0_1000px_rgba(0,0,0,0.4)]" />
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                      <div className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                        faceDetected
                          ? "bg-emerald-500 text-white"
                          : "bg-black/50 text-white/70"
                      )}>
                        {faceDetected ? "✓ Face detected" : "Position your face in the oval"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={stopFaceCapture}
                      className="flex-1 h-12 rounded-2xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={captureFaceId}
                      disabled={uploadingFile === "face_id" || !faceDetected}
                      className="flex-1 h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest"
                    >
                      {uploadingFile === "face_id" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Capture"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-slate-300">
                    <ScanFace className="w-12 h-12" />
                  </div>
                  <Button
                    onClick={startFaceCapture}
                    className="h-14 px-8 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/25"
                  >
                    <Camera className="w-5 h-5 mr-2" /> Start Camera
                  </Button>

                  <input
                    ref={faceIdFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleManualFaceIdUpload}
                    className="hidden"
                  />
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => faceIdFileInputRef.current?.click()}
                      disabled={uploadingFile === "face_id"}
                      className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {uploadingFile === "face_id" ? "Uploading…" : "Or upload a photo instead"}
                    </button>
                    {cameraUnavailable && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Camera unavailable — you can upload a clear photo of your face instead.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Identity
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Official identification for KYC compliance.
              </p>
            </div>
            <div className="max-w-md mx-auto space-y-5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => updateField("id_type", "national_id")}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    formData.id_type === "national_id"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm"
                      : "text-slate-400",
                  )}
                >
                  National ID
                </button>
                <button
                  onClick={() => updateField("id_type", "passport")}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    formData.id_type === "passport"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-sm"
                      : "text-slate-400",
                  )}
                >
                  Passport
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {formData.id_type === "passport" ? "Passport" : "ID"} Number
                  </Label>
                  <Input
                    value={formData.national_id}
                    onChange={(e) => updateField("national_id", e.target.value)}
                    placeholder="Enter number..."
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Date of Birth
                  </Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) =>
                      updateField("date_of_birth", e.target.value)
                    }
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50"
                  />
                </div>
                {rejectionNote("id_front") && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                    Rejected: {rejectionNote("id_front")}
                  </p>
                )}
                <FileUploader
                  label="Document Photo (Front)"
                  kind="image"
                  tooltip="We verify your identity against government records as required by KYC regulations. This keeps your account and advances secure."
                  onUpload={(f: File) => handleFileUpload(f, "id_front")}
                  uploadedFile={uploadedFiles.id_front}
                  uploading={uploadingFile === "id_front"}
                  locked={isDocLocked("id_front")}
                  required
                />
                {rejectionNote("id_back") && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                    Rejected: {rejectionNote("id_back")}
                  </p>
                )}
                <FileUploader
                  label="Document Photo (Back)"
                  kind="image"
                  tooltip="The back of your ID/passport carries additional verification details (e.g. issue/expiry dates) that regulators require alongside the front."
                  onUpload={(f: File) => handleFileUpload(f, "id_back")}
                  uploadedFile={uploadedFiles.id_back}
                  uploading={uploadingFile === "id_back"}
                  locked={isDocLocked("id_back")}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Home className="w-8 h-8 text-black" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Address Verification
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Provide your current residential address
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <button
                type="button"
                onClick={handleGeolocate}
                disabled={geolocating}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-primary text-sm font-medium transition-all disabled:opacity-50"
              >
                {geolocating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Detecting location…</>
                ) : (
                  <><MapPin className="w-4 h-4" />Use my current location</>
                )}
              </button>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                  Country of Work *
                </Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => updateField("country", v)}
                >
                  <SelectTrigger
                    className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    data-testid="onboarding-country"
                  >
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES_OF_WORK.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-slate-500 dark:text-slate-400 text-xs ml-1">
                  EaziWage operates in Kenya, Uganda, Tanzania, and Rwanda
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                  Address Line 1 *
                </Label>
                <Input
                  placeholder="Street address, P.O. box"
                  value={formData.address_line1}
                  onChange={(e) => updateField("address_line1", e.target.value)}
                  className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  data-testid="onboarding-address1"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                  Address Line 2
                </Label>
                <Input
                  placeholder="Apartment, suite, building (optional)"
                  value={formData.address_line2}
                  onChange={(e) => updateField("address_line2", e.target.value)}
                  className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  data-testid="onboarding-address2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                    City/Town *
                  </Label>
                  <Input
                    placeholder="e.g. Nairobi"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    data-testid="onboarding-city"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                    Postal Code
                  </Label>
                  <Input
                    placeholder="e.g. 00100"
                    value={formData.postal_code}
                    onChange={(e) => updateField("postal_code", e.target.value)}
                    className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    data-testid="onboarding-postal"
                  />
                </div>
              </div>

              
              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 space-y-3">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Proof of Address *
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Upload a utility bill, bank statement, or lease agreement
                  (less than 3 months old)
                </p>
                {rejectionNote("address_proof") && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                    Rejected: {rejectionNote("address_proof")}
                  </p>
                )}
                <FileUploader
                  label="Address Proof Document"
                  description="Utility bill, bank statement, or lease"
                  tooltip="Confirms your residential address for regulatory compliance. Must be less than 3 months old. Required under anti-money laundering (AML) regulations."
                  onUpload={(file) => handleFileUpload(file, "address_proof")}
                  uploadedFile={uploadedFiles.address_proof}
                  uploading={uploadingFile === "address_proof"}
                  locked={isDocLocked("address_proof")}
                  testId="upload-address-proof"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Receipt className="w-8 h-8 text-black" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Tax Information
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Provide your tax identification number for compliance
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Why we need this:</strong> Tax compliance is
                      required by financial regulations in all our operating
                      countries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                  Tax Identification Number (TIN)
                </Label>
                <Input
                  placeholder="Enter your TIN"
                  value={formData.tax_id}
                  onChange={(e) => updateField("tax_id", e.target.value)}
                  className="h-14 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  data-testid="onboarding-tin"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  Also known as PIN in Kenya, TIN in Tanzania, or TIN in
                  Uganda/Rwanda
                </p>
              </div>

              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Tax Certificate
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Upload your tax registration certificate or compliance
                  certificate
                </p>
                {rejectionNote("tax_certificate") && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                    Rejected: {rejectionNote("tax_certificate")}
                  </p>
                )}
                <FileUploader
                  label="Tax Certificate"
                  description="TIN certificate or compliance document"
                  tooltip="Required for tax reporting on wage advances you receive. The KRA and other revenue authorities in our operating countries mandate this for financial services."
                  onUpload={(file) => handleFileUpload(file, "tax_certificate")}
                  uploadedFile={uploadedFiles.tax_certificate}
                  uploading={uploadingFile === "tax_certificate"}
                  locked={isDocLocked("tax_certificate")}
                  testId="upload-tax-cert"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Employment
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Verify your active status with your employer.
              </p>
            </div>
            <div className="max-w-md mx-auto space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Select Employer
                </Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={employerSearch}
                    onChange={(e) => setEmployerSearch(e.target.value)}
                    placeholder="Search companies..."
                    className="pl-10 h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50 bg-white/30 dark:bg-black/20">
                  {employersLoading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Searching partners...
                      </p>
                    </div>
                  ) : filteredEmployers.length > 0 ? (
                    filteredEmployers.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => updateField("employer_id", emp.id)}
                        className={cn(
                          "w-full text-left p-4 text-sm font-bold flex items-center justify-between group transition-colors",
                          formData.employer_id === emp.id
                            ? "bg-primary text-white"
                            : "hover:bg-primary/5 text-slate-700 dark:text-slate-300",
                        )}
                      >
                        <div className="flex flex-col">
                          <span>{emp.company_name}</span>
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-wider font-bold",
                              formData.employer_id === emp.id
                                ? "text-white/70"
                                : "text-slate-400",
                            )}
                          >
                            {emp.industry} • {emp.city}, {emp.country}
                          </span>
                        </div>
                        {formData.employer_id === emp.id && (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        No matching partners found
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-500 font-medium">
                    Don&apos;t see your employer? Enter your company code
                    instead:
                  </p>
                  <Input
                  value={formData.company_code}
                  onChange={(e) => {
                    updateField("company_code", e.target.value.toUpperCase());
                    if (e.target.value) updateField("employer_id", "");
                  }}
                  placeholder="e.g. 4VP9HM"
                  className="h-10 mt-2 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-slate-800 text-xs"
                />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Job Title
                  </Label>
                  <Input
                    value={formData.job_title}
                    onChange={(e) => updateField("job_title", e.target.value)}
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50"
                    placeholder="e.g. Sales Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Department
                  </Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50"
                    placeholder="e.g. Operations"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Employment Type
                </Label>
                <Select
                  value={formData.employment_type}
                  onValueChange={(v) => updateField("employment_type", v)}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Monthly Salary (Gross)
                </Label>
                <Input
                  type="number"
                  value={formData.monthly_salary}
                  onChange={(e) =>
                    updateField("monthly_salary", e.target.value)
                  }
                  className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50"
                  placeholder="Enter amount..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Joining Date
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    value={formData.joining_month}
                    onValueChange={(v) => updateField("joining_month", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {[
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "Jun",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ].map((m, i) => (
                        <SelectItem
                          key={m}
                          value={(i + 1).toString().padStart(2, "0")}
                        >
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.joining_year}
                    onValueChange={(v) => updateField("joining_year", v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Array.from({ length: 30 }, (_, i) =>
                        (new Date().getFullYear() - i).toString(),
                      ).map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[9px] text-slate-500 font-medium mt-1">
                  Select the month and year you joined the company.
                </p>
              </div>

              {rejectionNote("payslip_1") && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                  Rejected: {rejectionNote("payslip_1")}
                </p>
              )}
              <FileUploader
                label="Latest Payslip"
                tooltip="Verifies your current salary so we can calculate your eligible advance limit accurately. We use your net pay — not gross — to set a fair limit."
                onUpload={(f: File) => handleFileUpload(f, "payslip_1")}
                uploadedFile={uploadedFiles.payslip_1}
                uploading={uploadingFile === "payslip_1"}
                locked={isDocLocked("payslip_1")}
                required
              />
              {rejectionNote("payslip_2") && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                  Rejected: {rejectionNote("payslip_2")}
                </p>
              )}
              <FileUploader
                label="Previous Payslip"
                tooltip="A second payslip lets us confirm your salary is consistent month to month, not a one-off, before setting your advance limit."
                onUpload={(f: File) => handleFileUpload(f, "payslip_2")}
                uploadedFile={uploadedFiles.payslip_2}
                uploading={uploadingFile === "payslip_2"}
                locked={isDocLocked("payslip_2")}
                required
              />
              {rejectionNote("employment_contract") && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                  Rejected: {rejectionNote("employment_contract")}
                </p>
              )}
              <FileUploader
                label="Employment Contract"
                tooltip="Confirms your employment terms and job title directly with your employer, independent of what's entered in this form."
                onUpload={(f: File) => handleFileUpload(f, "employment_contract")}
                uploadedFile={uploadedFiles.employment_contract}
                uploading={uploadingFile === "employment_contract"}
                locked={isDocLocked("employment_contract")}
                required
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Payout
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Where should we send your funds?
              </p>
            </div>
            <div className="max-w-md mx-auto space-y-6">
              <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <BankIcon className="w-3.5 h-3.5" /> Bank Details
                </h4>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">
                      Enrolled Bank *
                    </Label>
                    <Select
                      value={formData.bank_name}
                      onValueChange={(v) => updateField("bank_name", v)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(BANKS_BY_COUNTRY[formData.country] ?? []).map(
                          (bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    value={formData.bank_account}
                    onChange={(e) =>
                      updateField("bank_account", e.target.value)
                    }
                    placeholder="Account Number"
                    className="h-12 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800"
                    data-testid="onboarding-bank-account"
                  />
                </div>
              </div>

              <div className="p-5 bg-emerald-500/5 rounded-3xl border border-emerald-500/10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Mobile Money
                </h4>
                <div className="space-y-4">
                  <Select
                    value={formData.mobile_money_provider}
                    onValueChange={(v) =>
                      updateField("mobile_money_provider", v)
                    }
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(
                        COUNTRIES_OF_WORK.find(
                          (c) => c.code === formData.country,
                        )?.providers ?? []
                      ).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={formData.mobile_money_number}
                    onChange={(e) =>
                      updateField("mobile_money_number", e.target.value)
                    }
                    placeholder="Mobile Number"
                    className="h-12 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800"
                    data-testid="onboarding-mobile-number"
                  />
                </div>
              </div>

              {rejectionNote("bank_statement") && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
                  Rejected: {rejectionNote("bank_statement")}
                </p>
              )}
              <FileUploader
                label="Recent Bank Statement"
                tooltip="Confirms your bank account details and shows your salary is deposited regularly. We check that the account matches the name on your ID to prevent fraud."
                onUpload={(f: File) => handleFileUpload(f, "bank_statement")}
                uploadedFile={uploadedFiles.bank_statement}
                uploading={uploadingFile === "bank_statement"}
                locked={isDocLocked("bank_statement")}
                required
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest">
            Form Section {currentStep}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative flex flex-col">
      <EmployeeBackground />

      <header className="relative z-10 w-full px-6 py-8 flex justify-center">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-xl shadow-primary/25 ring-4 ring-primary/5">
            <span className="text-white font-black text-2xl">E</span>
          </div>
          <span className="font-heading font-black text-2xl text-slate-900 dark:text-white tracking-tight">
            EaziWage
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-6 pb-24">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        <div className="mt-12 space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                {error}
              </p>
            </div>
          )}

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-12 border border-white/40 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/20">
            {renderStepContent()}
          </div>

          <div className="flex items-center justify-between gap-4 max-w-md mx-auto">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-0"
            >
              Back
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <SubmitButton
                onClick={handleSubmit}
                isLoading={loading}
                label="Complete Setup"
                loadingLabel="Completing..."
                className="flex-1 h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95"
              />
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}