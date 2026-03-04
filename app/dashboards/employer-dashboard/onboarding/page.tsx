"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, MapPin, Users, ArrowRight, ArrowLeft,
  Phone, AlertCircle, Check, Sparkles,
  Shield, FileText, ChevronDown, Upload,
   UserCheck, Factory,
  DollarSign, Plus, Trash2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PAYROLL_CYCLES } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth"; // keep your existing store

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Uganda" },
  { code: "TZ", name: "Tanzania" },
  { code: "RW", name: "Rwanda" },
];

const INDUSTRIES = [
  { code: "agriculture", name: "Agriculture" },
  { code: "manufacturing", name: "Manufacturing" },
  { code: "construction", name: "Construction" },
  { code: "retail", name: "Retail" },
  { code: "hospitality", name: "Hospitality" },
  { code: "healthcare", name: "Healthcare" },
  { code: "education", name: "Education" },
  { code: "financial_services", name: "Financial Services" },
  { code: "technology", name: "Technology" },
  { code: "transport", name: "Transport & Logistics" },
  { code: "professional_services", name: "Professional Services" },
  { code: "government", name: "Government" },
  { code: "ngo", name: "NGO / Non-Profit" },
  { code: "other", name: "Other" },
];

const REVENUE_RANGES = [
  { value: "under_1m", label: "Under $1 Million" },
  { value: "1m_5m", label: "$1M - $5M" },
  { value: "5m_10m", label: "$5M - $10M" },
  { value: "10m_50m", label: "$10M - $50M" },
  { value: "50m_100m", label: "$50M - $100M" },
  { value: "over_100m", label: "Over $100M" },
];

const EMPLOYER_TERMS = `EMPLOYER PARTNERSHIP AGREEMENT

Last Updated: February 2026

1. INTRODUCTION
This Employer Partnership Agreement governs the relationship between your company ("Employer") and EaziWage Ltd ("EaziWage") for the provision of earned wage access services to your employees.

2. EMPLOYER RESPONSIBILITIES
As an Employer Partner, you agree to:
• Provide accurate payroll data on a regular basis
• Facilitate automatic deductions from employee salaries for advance repayments
• Maintain accurate employee records
• Notify EaziWage of any changes to employee status
• Not interfere with employees' rights to use the service

3. EAZIWAGE RESPONSIBILITIES
EaziWage agrees to:
• Process advance requests within the agreed timeframes
• Maintain confidentiality of all employer and employee data
• Provide regular reports on service usage
• Handle all customer support for employees
• Comply with all applicable financial regulations

4. FEES AND PAYMENT
• EaziWage charges employees a small fee per advance (3.5% - 6.5%)
• There is NO cost to the employer for basic service
• Premium features may attract additional fees (discussed separately)
• All deductions are reconciled monthly

5. DATA PROTECTION
• We implement bank-grade security for all data
• Employee financial data is never shared with employers
• We comply with GDPR and local data protection laws

6. TERM AND TERMINATION
• This agreement is effective upon completion of onboarding
• Either party may terminate with 30 days written notice
• Outstanding employee advances must be settled upon termination`;

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "terms", title: "Terms", icon: Shield },
  { id: "company", title: "Company", icon: Building2 },
  { id: "address", title: "Address", icon: MapPin },
  { id: "ownership", title: "Ownership", icon: UserCheck },
  { id: "business", title: "Business", icon: Factory },
  { id: "financial", title: "Financial", icon: DollarSign },
  { id: "contact", title: "Contact", icon: Phone },
];

// ─── FileUploader ─────────────────────────────────────────────────────────────

interface FileUploaderProps {
  label: string;
  description: string;
  onUpload: (file: File) => void;
  uploadedFile: { name: string; url: string } | null;
  uploading: boolean;
  testId?: string;
  required?: boolean;
  optional?: boolean;
}

const FileUploader = ({
  label, description, onUpload, uploadedFile, uploading, testId, required = false, optional = false,
}: FileUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG) or PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    onUpload(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-slate-400 text-xs font-normal">(Optional - Can skip)</span>}
      </Label>
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" data-testid={testId} />
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          uploadedFile ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Uploading...</span>
          </div>
        ) : uploadedFile ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-45">
                {uploadedFile.name || "Document uploaded"}
              </p>
              <p className="text-xs text-slate-500">Click to replace</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Click to upload</p>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
          </>
        )}
      </div>
    </div>
  );
};

// ─── BeneficialOwnerRow ───────────────────────────────────────────────────────

interface BeneficialOwner {
  full_name: string;
  id_number: string;
  nationality: string;
  ownership_percentage: number;
  is_pep: boolean;
}

interface BeneficialOwnerRowProps {
  owner: BeneficialOwner;
  index: number;
  onUpdate: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
}

const BeneficialOwnerRow = ({ owner, index, onUpdate, onRemove }: BeneficialOwnerRowProps) => (
  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="font-medium text-slate-900 dark:text-white">Owner {index + 1}</h4>
      {index > 0 && (
        <button type="button" onClick={() => onRemove(index)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input placeholder="Full Name" value={owner.full_name} onChange={(e) => onUpdate(index, "full_name", e.target.value)} className="h-11 rounded-lg bg-white dark:bg-slate-800/50" />
      <Input placeholder="ID Number" value={owner.id_number} onChange={(e) => onUpdate(index, "id_number", e.target.value)} className="h-11 rounded-lg bg-white dark:bg-slate-800/50" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input placeholder="Nationality" value={owner.nationality} onChange={(e) => onUpdate(index, "nationality", e.target.value)} className="h-11 rounded-lg bg-white dark:bg-slate-800/50" />
      <Input type="number" placeholder="Ownership %" value={owner.ownership_percentage} onChange={(e) => onUpdate(index, "ownership_percentage", parseFloat(e.target.value) || 0)} className="h-11 rounded-lg bg-white dark:bg-slate-800/50" min="0" max="100" />
    </div>
    <div className="flex items-center gap-2">
      <input type="checkbox" id={`pep-${index}`} checked={owner.is_pep} onChange={(e) => onUpdate(index, "is_pep", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      <label htmlFor={`pep-${index}`} className="text-sm text-slate-600 dark:text-slate-400">Politically Exposed Person (PEP)</label>
    </div>
  </div>
);

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiUploadDocument(formData: FormData) {
  const res = await fetch("/api/employer-dashboard/onboarding/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data as { document_url: string; document_type: string };
}

async function apiSubmitOnboarding(payload: Record<string, unknown>) {
  const res = await fetch("/api/employer-dashboard/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    // Re-throw with detail array so the catch block can format it
    const err = new Error(data.error ?? "Submission failed") as Error & { detail?: unknown };
    err.detail = data.detail;
    throw err;
  }
  return data;
}

async function apiUpdateStep(step: number) {
  await fetch("/api/employer-dashboard/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
  }).catch(() => {/* non-critical */});
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployerOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<{ id: string; name: string; industry: string }[]>([]);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsContent, setShowTermsContent] = useState(false);

  // File upload states
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { name: string; url: string } | null>>({
    certificate_of_incorporation: null,
    business_registration: null,
    tax_compliance_certificate: null,
    cr12_document: null,
    kra_pin_certificate: null,
    business_permit: null,
    audited_financials: null,
    bank_statement: null,
    proof_of_address: null,
    proof_of_bank_account: null,
    employment_contract_template: null,
  });

  const [countriesOfOperation, setCountriesOfOperation] = useState<string[]>([]);
  const user = useAuthStore((state) => state.user);
  const userFullName =
    user?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "";
  const userEmail = user?.email || user?.user_metadata?.email || "";

  const [beneficialOwners, setBeneficialOwners] = useState([
    { full_name: "", id_number: "", nationality: "", ownership_percentage: 0, is_pep: false },
  ]);

  const [formData, setFormData] = useState({
    company_name: "",
    registration_number: "",
    date_of_incorporation: "",
    country: "",
    physical_address: "",
    city: "",
    postal_code: "",
    county_region: "",
    tax_id: "",
    vat_number: "",
    industry: "",
    sector: "",
    business_description: "",
    years_in_operation: "",
    employee_count: "",
    annual_revenue_range: "",
    payroll_cycle: "",
    monthly_payroll_amount: "",
    bank_name: "",
    bank_account_number: "",
    contact_person: userFullName,
    contact_email: userEmail,
    contact_phone: "",
    contact_position: "",
  });

  useEffect(() => {
    if (!userFullName && !userEmail) return;
    Promise.resolve().then(() => {
      setFormData((prev) => ({
        ...prev,
        contact_person: prev.contact_person || userFullName,
        contact_email: prev.contact_email || userEmail,
      }));
    });
  }, [userFullName, userEmail]);

  useEffect(() => {
    const fetchProfileFallback = async () => {
      if (userFullName && userEmail) return;
      try {
        const res = await fetch("/api/employer-dashboard/profile");
        const data = await res.json();
        if (!res.ok) return;
        const profile = data?.profile || {};
        const fallbackName = profile?.full_name || profile?.contact_person || "";
        const fallbackEmail = profile?.email || profile?.contact_email || "";
        if (!fallbackName && !fallbackEmail) return;

        Promise.resolve().then(() => {
          setFormData((prev) => ({
            ...prev,
            contact_person: prev.contact_person || fallbackName,
            contact_email: prev.contact_email || fallbackEmail,
          }));
        });
      } catch {
        // Non-fatal fallback only.
      }
    };
    fetchProfileFallback();
  }, [userFullName, userEmail]);

  // ── Fetch sectors on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/employer-dashboard/sectors")
      .then((r) => r.json())
      .then(setSectors)
      .catch(() => console.error("Failed to fetch sectors"));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const updateField = (field: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const updateOwner = (index: number, field: string, value: unknown) =>
    setBeneficialOwners((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

  const addOwner = () =>
    setBeneficialOwners((prev) => [
      ...prev,
      { full_name: "", id_number: "", nationality: "", ownership_percentage: 0, is_pep: false },
    ]);

  const removeOwner = (index: number) =>
    setBeneficialOwners((prev) => prev.filter((_, i) => i !== index));

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File, documentType: string) => {
    setUploadingFile(documentType);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", documentType);

      const response = await apiUploadDocument(fd);

      setUploadedFiles((prev) => ({
        ...prev,
        [documentType]: { name: file.name, url: response.document_url },
      }));

      toast.success("Document uploaded successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingFile(null);
    }
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const nextStep = () => {
    if (currentStep === 1 && !agreedToTerms) {
      setError("Please accept the Terms to continue");
      return;
    }
    setError("");
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      apiUpdateStep(next);
    }
  };

  const prevStep = () => {
    setError("");
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true;
      case 1: return agreedToTerms;
      case 2: return !!(formData.company_name && formData.registration_number && formData.country);
      case 3: return !!(formData.physical_address && formData.city);
      case 4: return true;
      case 5: return !!(formData.industry && formData.sector && formData.employee_count && countriesOfOperation.length > 0);
      case 6: return !!formData.payroll_cycle;
      case 7: return !!(formData.contact_person && formData.contact_email && formData.contact_phone);
      default: return false;
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      // Collect uploaded document URLs
      const docUrls: Record<string, string> = {};
      Object.entries(uploadedFiles).forEach(([key, value]) => {
        if (value?.url) docUrls[key] = value.url;
      });

      await apiSubmitOnboarding({
        ...formData,
        employee_count: parseInt(formData.employee_count) || 0,
        years_in_operation: parseInt(formData.years_in_operation) || 0,
        monthly_payroll_amount: parseFloat(formData.monthly_payroll_amount) || 0,
        beneficial_owners: beneficialOwners.filter((o) => o.full_name.trim()),
        countries_of_operation: countriesOfOperation,
        ...docUrls,
      });

      toast.success("Company profile created! Our team will review your application.");
      router.push("/dashboards/employer-dashboard");
    } catch (err: unknown) {
      let errorMessage = "Failed to create company profile";
      if (err instanceof Error) {
        const detail = (err as Error & { detail?: unknown }).detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((e) => e.msg || e.message).join(", ");
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ── Render step content ──────────────────────────────────────────────────
  const filteredSectors = sectors.filter((s) => s.industry === formData.industry);

  const renderStepContent = () => {
    switch (currentStep) {
      // ── Step 0: Welcome ──────────────────────────────────────────────────
      case 0:
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-linear-to-br from-primary to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/30">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Welcome to EaziWage Employer Portal {userFullName ? `, ${userFullName.split(" ")[0]}` : ""}!
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-lg mx-auto">
              Complete your company&apos;s due diligence onboarding to offer earned wage access to your employees.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto mb-8">
              {[
                { icon: Users, text: "Happier Employees" },
                { icon: Shield, text: "Zero Risk to You" },
                { icon: DollarSign, text: "No Cost to Employer" },
                { icon: FileText, text: "Easy Integration" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-primary/5 dark:bg-primary/10 rounded-xl text-sm">
                  <item.icon className="w-5 h-5 text-primary" />
                  <span className="text-slate-700 dark:text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30 max-w-md mx-auto">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200 text-left">
                  <strong>Note:</strong> Documents marked as optional can be skipped and uploaded later.
                </p>
              </div>
            </div>
          </div>
        );

      // ── Step 1: Terms ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Employer Partnership Agreement</h2>
              <p className="text-slate-600 dark:text-slate-300">Review and accept our partnership terms</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Partnership Agreement</h3>
                  <button type="button" onClick={() => setShowTermsContent(!showTermsContent)} className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1" data-testid="toggle-employer-terms">
                    {showTermsContent ? "Hide agreement" : "Read full agreement"}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showTermsContent ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {showTermsContent && (
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4 max-h-64 overflow-y-auto bg-white dark:bg-slate-900/50">
                    <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{EMPLOYER_TERMS}</pre>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3 p-4 bg-primary/5 dark:bg-primary/10 rounded-xl">
                <div className="relative flex items-center mt-0.5">
                  <input type="checkbox" id="agree-terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 checked:border-primary checked:bg-primary transition-all hover:border-primary" data-testid="employer-terms-checkbox" />
                  <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                </div>
                <label htmlFor="agree-terms" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  I have read and agree to the <strong>Employer Partnership Agreement</strong> and authorize EaziWage to process payroll data
                </label>
              </div>
            </div>
          </div>
        );

      // ── Step 2: Company Info ─────────────────────────────────────────────
      case 2:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Company Information</h2>
              <p className="text-slate-600 dark:text-slate-300">Basic details about your company</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Company Name *</Label>
                <Input placeholder="e.g. Acme Corporation Ltd" value={formData.company_name} onChange={(e) => updateField("company_name", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-company-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Registration No. *</Label>
                  <Input placeholder="PVT-12345678" value={formData.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-reg-number" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Date of Incorporation</Label>
                  <Input type="date" value={formData.date_of_incorporation} onChange={(e) => updateField("date_of_incorporation", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-doi" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Country of Registration *</Label>
                <Select value={formData.country} onValueChange={(v) => updateField("country", v)}>
                  <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Registration Documents</h4>
                <FileUploader label="Certificate of Incorporation" description="Company incorporation certificate" onUpload={(file) => handleFileUpload(file, "certificate_of_incorporation")} uploadedFile={uploadedFiles.certificate_of_incorporation} uploading={uploadingFile === "certificate_of_incorporation"} testId="upload-coi" optional />
                <FileUploader label="Business Registration" description="Business registration certificate" onUpload={(file) => handleFileUpload(file, "business_registration")} uploadedFile={uploadedFiles.business_registration} uploading={uploadingFile === "business_registration"} testId="upload-br" optional />
              </div>
            </div>
          </div>
        );

      // ── Step 3: Address ──────────────────────────────────────────────────
      case 3:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Business Address</h2>
              <p className="text-slate-600 dark:text-slate-300">Your company&apos;s physical address</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Physical Address *</Label>
                <Input placeholder="Street address, building name" value={formData.physical_address} onChange={(e) => updateField("physical_address", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">City/Town *</Label>
                  <Input placeholder="e.g. Nairobi" value={formData.city} onChange={(e) => updateField("city", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-city" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Postal Code</Label>
                  <Input placeholder="e.g. 00100" value={formData.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-postal" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">County/Region</Label>
                <Input placeholder="e.g. Nairobi County" value={formData.county_region} onChange={(e) => updateField("county_region", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-county" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Tax ID / KRA PIN</Label>
                  <Input placeholder="A123456789X" value={formData.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-tax-id" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">VAT Number</Label>
                  <Input placeholder="VAT123456" value={formData.vat_number} onChange={(e) => updateField("vat_number", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-vat" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Address & Tax Documents</h4>
                <FileUploader label="Proof of Address" description="Utility bill or lease agreement" onUpload={(file) => handleFileUpload(file, "proof_of_address")} uploadedFile={uploadedFiles.proof_of_address} uploading={uploadingFile === "proof_of_address"} testId="upload-poa" optional />
                <FileUploader label="Tax Compliance Certificate" description="KRA tax compliance certificate" onUpload={(file) => handleFileUpload(file, "tax_compliance_certificate")} uploadedFile={uploadedFiles.tax_compliance_certificate} uploading={uploadingFile === "tax_compliance_certificate"} testId="upload-tcc" optional />
                <FileUploader label="KRA PIN Certificate" description="KRA PIN registration certificate" onUpload={(file) => handleFileUpload(file, "kra_pin_certificate")} uploadedFile={uploadedFiles.kra_pin_certificate} uploading={uploadingFile === "kra_pin_certificate"} testId="upload-kra" optional />
              </div>
            </div>
          </div>
        );

      // ── Step 4: Beneficial Ownership ─────────────────────────────────────
      case 4:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <UserCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Beneficial Ownership</h2>
              <p className="text-slate-600 dark:text-slate-300">Directors and shareholders with significant ownership</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200"><strong>Optional:</strong> List individuals who own 10% or more. You can skip and add later.</p>
                </div>
              </div>
              {beneficialOwners.map((owner, index) => (
                <BeneficialOwnerRow key={index} owner={owner} index={index} onUpdate={updateOwner} onRemove={removeOwner} />
              ))}
              <Button type="button" variant="outline" onClick={addOwner} className="w-full h-12 rounded-xl border-dashed">
                <Plus className="w-4 h-4 mr-2" />Add Another Owner
              </Button>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Ownership Documents</h4>
                <FileUploader label="CR12 / Company Directors" description="Company registry document showing directors" onUpload={(file) => handleFileUpload(file, "cr12_document")} uploadedFile={uploadedFiles.cr12_document} uploading={uploadingFile === "cr12_document"} testId="upload-cr12" optional />
              </div>
              <button type="button" onClick={nextStep} className="w-full text-center text-sm text-primary font-medium hover:underline">
                Skip this step for now →
              </button>
            </div>
          </div>
        );

      // ── Step 5: Business Operations ──────────────────────────────────────
      case 5:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Factory className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Business Operations</h2>
              <p className="text-slate-600 dark:text-slate-300">Tell us about your business activities</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Industry *</Label>
                  <Select value={formData.industry} onValueChange={(v) => { updateField("industry", v); updateField("sector", ""); }}>
                    <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i.code} value={i.code}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Business Sector *</Label>
                  <Select value={formData.sector} onValueChange={(v) => updateField("sector", v)} disabled={!formData.industry}>
                    <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-sector">
                      <SelectValue placeholder={formData.industry ? "Select sector" : "Select industry first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSectors.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Countries of Operation */}
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Countries of Operation *</Label>
                <div className="flex flex-wrap gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 min-h-14">
                  {COUNTRIES.map((c) => {
                    const selected = countriesOfOperation.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCountriesOfOperation((prev) =>
                          selected ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                        )}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selected ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Employee Count *</Label>
                  <Input type="number" placeholder="e.g. 250" min="0" value={formData.employee_count} onChange={(e) => updateField("employee_count", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-employees" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Years in Operation</Label>
                  <Input type="number" placeholder="e.g. 5" min="0" value={formData.years_in_operation} onChange={(e) => updateField("years_in_operation", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-years" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Business Description</Label>
                <textarea
                  placeholder="Brief description of what your company does..."
                  value={formData.business_description}
                  onChange={(e) => updateField("business_description", e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  data-testid="employer-description"
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Business Documents</h4>
                <FileUploader label="Business Permit" description="Current business operating permit" onUpload={(file) => handleFileUpload(file, "business_permit")} uploadedFile={uploadedFiles.business_permit} uploading={uploadingFile === "business_permit"} testId="upload-permit" optional />
                <FileUploader label="Employment Contract Template" description="Sample employee contract" onUpload={(file) => handleFileUpload(file, "employment_contract_template")} uploadedFile={uploadedFiles.employment_contract_template} uploading={uploadingFile === "employment_contract_template"} testId="upload-contract" optional />
              </div>
            </div>
          </div>
        );

      // ── Step 6: Financial ────────────────────────────────────────────────
      case 6:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Financial Information</h2>
              <p className="text-slate-600 dark:text-slate-300">Payroll and financial details</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Annual Revenue Range</Label>
                  <Select value={formData.annual_revenue_range} onValueChange={(v) => updateField("annual_revenue_range", v)}>
                    <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-revenue">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Payroll Cycle *</Label>
                  <Select value={formData.payroll_cycle} onValueChange={(v) => updateField("payroll_cycle", v)}>
                    <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-payroll">
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYROLL_CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Monthly Payroll Amount (USD)</Label>
                <Input type="number" placeholder="e.g. 50000" min="0" value={formData.monthly_payroll_amount} onChange={(e) => updateField("monthly_payroll_amount", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-payroll-amount" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Bank Name</Label>
                  <Input placeholder="e.g. KCB Bank" value={formData.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-bank" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Account Number</Label>
                  <Input placeholder="1234567890" value={formData.bank_account_number} onChange={(e) => updateField("bank_account_number", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-account" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Financial Documents</h4>
                <FileUploader label="Audited Financials" description="Most recent audited financial statements" onUpload={(file) => handleFileUpload(file, "audited_financials")} uploadedFile={uploadedFiles.audited_financials} uploading={uploadingFile === "audited_financials"} testId="upload-financials" optional />
                <FileUploader label="Bank Statement" description="Last 3 months bank statements" onUpload={(file) => handleFileUpload(file, "bank_statement")} uploadedFile={uploadedFiles.bank_statement} uploading={uploadingFile === "bank_statement"} testId="upload-bank-stmt" optional />
                <FileUploader label="Proof of Bank Account" description="Bank confirmation letter or account opening document" onUpload={(file) => handleFileUpload(file, "proof_of_bank_account")} uploadedFile={uploadedFiles.proof_of_bank_account} uploading={uploadingFile === "proof_of_bank_account"} testId="upload-bank-proof" optional />
              </div>
            </div>
          </div>
        );

      // ── Step 7: Contact ──────────────────────────────────────────────────
      case 7:
        return (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mb-2">Contact Person</h2>
              <p className="text-slate-600 dark:text-slate-300">Primary contact for EaziWage communications</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Full Name *</Label>
                  <Input placeholder="e.g. Jane Doe" value={formData.contact_person} onChange={(e) => updateField("contact_person", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-contact-name" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Position</Label>
                  <Input placeholder="e.g. HR Manager" value={formData.contact_position} onChange={(e) => updateField("contact_position", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-contact-position" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Email Address *</Label>
                <Input type="email" placeholder="e.g. jane@company.com" value={formData.contact_email} onChange={(e) => updateField("contact_email", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-contact-email" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-700 dark:text-slate-200 text-sm font-medium ml-1">Phone Number *</Label>
                <Input type="tel" placeholder="+254 700 000 000" value={formData.contact_phone} onChange={(e) => updateField("contact_phone", e.target.value)} className="h-14 rounded-xl bg-white dark:bg-slate-800/50" data-testid="employer-contact-phone" />
              </div>
              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>What happens next?</strong> After submission, our team will review your application within 2–3 business days. you&apos;ll receive an email notification once approved.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute top-20 right-0 w-150 h-150 bg-primary/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 left-0 w-125 h-125 bg-emerald-500/10 rounded-full blur-[150px]" />

      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center">
          <Link href="/" className="flex items-center gap-3 group" data-testid="logo-link">
            <div className="w-11 h-11 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/30">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="font-heading font-bold text-2xl text-slate-900 dark:text-white">EaziWage</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex items-center justify-between min-w-max px-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${index < currentStep ? "bg-primary text-white" : index === currentStep ? "bg-linear-to-br from-primary to-emerald-600 text-white shadow-lg shadow-primary/30" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                  {index < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-1 mx-1 sm:mx-2 rounded-full transition-all ${index < currentStep ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"}`} style={{ width: "20px" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-6">
          Step {currentStep + 1} of {STEPS.length}: <span className="font-medium text-slate-900 dark:text-white">{STEPS[currentStep].title}</span>
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 rounded-xl" data-testid="employer-onboarding-error">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl mb-8">{renderStepContent()}</div>

        <div className="flex justify-between gap-4">
          <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0} className="h-14 px-6 rounded-2xl border-slate-200 dark:border-slate-700" data-testid="prev-step">
            <ArrowLeft className="w-5 h-5 mr-2" />Back
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button type="button" onClick={handleSubmit} disabled={loading || !canProceed()} className="h-14 px-8 rounded-2xl bg-linear-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-white font-semibold shadow-xl shadow-primary/30" data-testid="complete-employer-onboarding">
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">Submit Application<Check className="w-5 h-5" /></span>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={nextStep} disabled={!canProceed()} className="h-14 px-8 rounded-2xl bg-linear-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-white font-semibold shadow-xl shadow-primary/30" data-testid="employer-next-step">
              Continue<ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

