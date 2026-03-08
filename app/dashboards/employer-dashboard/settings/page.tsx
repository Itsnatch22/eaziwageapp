"use client"
import React, { useState, useEffect } from "react"
import { 
  Building2, Users, CreditCard, Bell,
  Shield, Clock, Save, AlertCircle, CheckCircle2,
  Percent, Calendar, Wallet, Lock, Mail, BarChart3, ChevronRight,
  FileText, HelpCircle, Eye, Download, Upload, ExternalLink,
  MessageSquare, Phone, MapPin, Globe, X, Loader2,
  LucideIcon, User
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout'
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from '@/lib/stores/auth';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import pusherClient from '@/lib/pusher-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployerProfile {
  id: string;
  company_name: string;
  company_code?: string;
  status: string;
  full_name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  payroll_cycle?: string;
  physical_address?: string;
  city?: string;
  postal_code?: string;
  county_region?: string;
  country?: string;
  email_notifications?: boolean;
  advance_alerts?: boolean;
  payroll_reminders?: boolean;
  weekly_reports?: boolean;
  max_advance_percentage?: number;
  min_advance_amount?: number;
  max_advance_amount?: number;
  advance_access_days?: [number, number];
  cooldown_period?: number;
  bank_name?: string;
  bank_account_number?: string;
  registration_number?: string;
  tax_id?: string;
  industry?: string;
  sector?: string;
  documents?: Record<string, string>;
}

interface TabButtonProps {
    icon: LucideIcon;
    label: string;
    active: boolean;
    onClick: () => void;
}

const TabButton = ({ active, onClick, icon: Icon, label }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full",
      active 
        ? "bg-primary text-white shadow-lg shadow-primary/25"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
    )}
  >
    <div className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center",
      active ? "bg-white/20" : "bg-primary"
    )}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="font-medium">{label}</span>
    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
  </button>
);

interface SettingsCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    children: React.ReactNode;
    locked?: boolean;
}
const SettingsCard = ({ icon: Icon, title, description, children, locked = false }: SettingsCardProps) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {locked && (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-full">
          <Lock className="w-3 h-3" /> Requires Approval
        </span>
      )}
    </div>
    {children}
  </div>
);

interface ToogleItemProps {
    icon: LucideIcon;
    label: string;
    description: string;
    checked: boolean;
    onToggle: (checked: boolean) => void;
}
const ToggleItem = ({ icon: Icon, label, description, checked, onToggle }: ToogleItemProps) => (
  <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onToggle} />
  </div>
);

interface DocumentItemProps {
    icon: LucideIcon;
    label: string;
    fileName?: string | null;
    status?: string | null;
    onView: () => void;
    onReupload: (file: File) => void | Promise<void>;
}
const DocumentItem = ({ icon: Icon, label, fileName, status, onView, onReupload, accept = ".pdf,.jpg,.jpeg,.png", isUploading = false }: DocumentItemProps & { accept?: string, isUploading?: boolean }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
  <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl relative overflow-hidden">
    <input
      type="file"
      className="hidden"
      ref={fileInputRef}
      accept={accept}
      onChange={(e) => {
        if (e.target.files?.[0]) {
          void onReupload(e.target.files[0]);
        }
      }}
    />
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{fileName || 'Not uploaded'}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className={cn(
        "px-2 py-1 rounded-full text-xs font-medium",
        status === 'approved' ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
        status === 'pending' ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
        "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
      )}>
        {status || 'Not uploaded'}
      </span>
      {fileName && (
        <button
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3",
            ""
          )}
          onClick={onView}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
      <button 
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3",
          ""
        )}
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
      </button>
    </div>
  </div>
  );
};

interface FAQItemProps{
    question: string;
    answer: string;
}
const FAQItem = ({ question, answer }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/50 dark:border-slate-700/30 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-slate-900 dark:text-white">{question}</span>
        <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && (
        <div className="pb-4 text-slate-600 dark:text-slate-400 text-sm">
          {answer}
        </div>
      )}
    </div>
  );
};

interface BankChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { bank_name: string; bank_account_number: string; reason: string }) => Promise<void>;
  isSubmitting: boolean;
}

const BankChangeModal = ({ isOpen, onClose, onSubmit, isSubmitting }: BankChangeModalProps) => {
  const [formData, setFormData] = useState({ bank_name: '', bank_account_number: '', reason: '' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Request Bank Change</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Bank Name</Label>
            <Input 
              placeholder="e.g. Standard Chartered"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>New Account Number</Label>
            <Input 
              placeholder="e.g. 0100XXXXXXX"
              value={formData.bank_account_number}
              onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for Change</Label>
            <textarea 
              className="w-full min-h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Briefly explain why you're changing bank details..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 mb-4">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Note:</strong> For security reasons, bank changes are manually reviewed. You may be contacted by our compliance team for verification.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                "flex-1 rounded-xl"
              )}
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit(formData)} 
              disabled={isSubmitting || !formData.bank_name || !formData.bank_account_number}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                "flex-1 bg-primary text-white rounded-xl shadow-lg shadow-primary/25"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmployerProfileTab = ({ user }: { user: any }) => {
  if (!user) return null;

  return (
    <div className="space-y-6">
      <SettingsCard icon={Users} title="Your Profile" description="Manage your personal profile and account settings">
        <div className="flex flex-col items-center mb-8">
          <AvatarUpload 
            userId={user.id} 
            currentAvatarUrl={(user as any).avatar_url} 
            fullName={(user as any).full_name || user.email}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Full Name</Label>
            <Input 
              value={(user as any).full_name || ''} 
              readOnly 
              className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Email Address</Label>
            <Input 
              value={user.email || ''} 
              readOnly 
              className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Role</Label>
            <Input 
              value={(user as any).role || 'Employer Admin'} 
              readOnly 
              className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed capitalize" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Account ID</Label>
            <Input 
              value={user.id} 
              readOnly 
              className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed font-mono text-xs" 
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={Shield} title="Account Security" description="Verify your account protection">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Email Verified</p>
              <p className="text-sm text-slate-500">Your primary email is confirmed</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Verified
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Active Session</p>
              <p className="text-sm text-slate-500">Current browser session is secure</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <Shield className="w-4 h-4" />
              Secure
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

const getResponseErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const text = await res.text();
    if (!text) return fallback;

    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
      return fallback;
    } catch {
      return text.trim() || fallback;
    }
  } catch {
    return fallback;
  }
};

export default function EmployerSettings() {
    const user = useAuthStore((state) => state.user);
    const [employer, setEmployer] = useState<EmployerProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('account');
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [showBankModal, setShowBankModal] = useState(false);

    const [settings, setSettings] = useState({
      maxAdvancePercentage: 50,
      minAdvanceAmount: 500,
      maxAdvanceAmount: 50000,
      advanceAccessDays: [1, 25] as [number, number],
      cooldownPeriod: 7,
      emailNotifications: true,
      advanceAlerts: true,
      payrollReminders: true,
      weeklyReports: false,
      payrollCycle: 'monthly'
    });

    const handleFileUpload = async (file: File, docKey: string) => {
      setUploadingDoc(docKey);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", docKey);

        const res = await fetch("/api/employer-dashboard/settings/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorMessage = await getResponseErrorMessage(res, "Failed to upload document");
          throw new Error(errorMessage);
        }

        const data = await res.json();
        
        // Update local state with new Document properties
        setEmployer((prev: EmployerProfile | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            documents: {
              ...prev.documents,
              [docKey]: data.fileUrl,
            },
          };
        });

        toast.success(`${docKey.replace(/_/g, ' ')} uploaded successfully!`);
      } catch (err: unknown) {
        console.error("Upload error:", err);
        const message = err instanceof Error ? err.message : "Failed to upload document";
        toast.error(message);
      } finally {
        setUploadingDoc(null);
      }
    };

    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [updatingPassword, setUpdatingPassword] = useState(false);

    const handlePasswordUpdate = async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (passwordForm.newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      setUpdatingPassword(true);
      try {
        const res = await fetch("/api/employer-dashboard/security/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: passwordForm.newPassword }),
        });
        
        if (res.ok) {
          toast.success("Password updated successfully");
          setPasswordForm({ newPassword: '', confirmPassword: '' });
        } else {
          const errorMessage = await getResponseErrorMessage(res, "Failed to update password");
          toast.error(errorMessage);
        }
      } catch (err) {
        console.error("Password update error:", err);
        toast.error("Failed to update password");
      } finally {
        setUpdatingPassword(false);
      }
    };

  const [profile, setProfile] = useState({
    maxAdvancePercentage: 50,
    minAdvanceAmount: 500,
    maxAdvanceAmount: 50000,
    advanceAccessDays: [1, 25],
    cooldownPeriod: 7,
    emailNotifications: true,
    advanceAlerts: true,
    payrollReminders: true,
    weeklyReports: false,
    companyName: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    payrollCycle: 'monthly',
    // Address fields
    physicalAddress: '',
    city: '',
    postalCode: '',
    countyRegion: '',
    country: 'KE'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, settingsRes] = await Promise.all([
        fetch('/api/employer-dashboard/profile'),
        fetch('/api/employer-dashboard/settings'),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const settingsData = settingsRes.ok ? await settingsRes.json() : null;

      const employerData = (profileData?.profile ?? settingsData?.employer) as EmployerProfile | undefined;
      const settingsEmployer = settingsData?.employer as Record<string, unknown> | undefined;

      if (employerData) {
        setEmployer(employerData);
        setProfile((prev) => ({
          ...prev,
          companyName: employerData.company_name || '',
          contactPerson: employerData.contact_person || employerData.full_name || '',
          contactEmail: employerData.contact_email || '',
          contactPhone: employerData.contact_phone || '',
          payrollCycle: employerData.payroll_cycle || prev.payrollCycle,
          physicalAddress: employerData.physical_address || '',
          city: employerData.city || '',
          postalCode: employerData.postal_code || '',
          countyRegion: employerData.county_region || '',
          country: employerData.country || 'KE',
        }));
      }

      if (settingsEmployer) {
        const rawDays = settingsEmployer.advance_access_days;
        const accessDays: [number, number] = Array.isArray(rawDays) && rawDays.length >= 2
          ? [Number(rawDays[0]) || 1, Number(rawDays[1]) || 25]
          : [1, 25];

        setSettings((prev) => ({
          ...prev,
          maxAdvancePercentage: Number(settingsEmployer.max_advance_percentage ?? prev.maxAdvancePercentage),
          minAdvanceAmount: Number(settingsEmployer.min_advance_amount ?? prev.minAdvanceAmount),
          maxAdvanceAmount: Number(settingsEmployer.max_advance_amount ?? prev.maxAdvanceAmount),
          advanceAccessDays: accessDays,
          cooldownPeriod: Number(settingsEmployer.cooldown_period ?? prev.cooldownPeriod),
          emailNotifications: Boolean(settingsEmployer.email_notifications ?? prev.emailNotifications),
          advanceAlerts: Boolean(settingsEmployer.advance_alerts ?? prev.advanceAlerts),
          payrollReminders: Boolean(settingsEmployer.payroll_reminders ?? prev.payrollReminders),
          weeklyReports: Boolean(settingsEmployer.weekly_reports ?? prev.weeklyReports),
          payrollCycle: String(settingsEmployer.payroll_cycle ?? prev.payrollCycle),
        }));
      }
    } catch (err) {
      console.error('Failed to load employer settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!user?.id || !employer?.id || !pusherClient) return;

    const userChannel = pusherClient.subscribe(`user-${user.id}`);
    const employerChannel = pusherClient.subscribe(`employer-${employer.id}`);

    const handleUpdate = (data: any) => {
      console.log('[Pusher] KYC update received:', data);
      void fetchData();
    };

    userChannel.bind('kyc-update', handleUpdate);
    employerChannel.bind('kyc-update', handleUpdate);

    return () => {
      userChannel.unbind('kyc-update', handleUpdate);
      employerChannel.unbind('kyc-update', handleUpdate);
      pusherClient!.unsubscribe(`user-${user.id}`);
      pusherClient!.unsubscribe(`employer-${employer.id}`);
    };
  }, [user?.id, employer?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
        const res = await fetch("/api/employer-dashboard/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(profile),
        });
        if (res.ok) {
            toast.success("Profile saved successfully");
        } else {
            const errorMessage = await getResponseErrorMessage(res, "Failed to save profile");
            toast.error(errorMessage);
        }
    } catch (err) {
        console.error("Failed to save profile:", err);
        toast.error("Failed to save profile");
    } finally {
        setSaving(false);
    }
  };

  const handleBankChangeRequest = async (data: { bank_name: string; bank_account_number: string; reason: string }) => {
    setSaving(true);
    try {
        const res = await fetch("/api/employer-dashboard/settings/bank-change-request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            toast.success("Bank change request sent successfully");
            setShowBankModal(false);
        } else {
            const errorMessage = await getResponseErrorMessage(res, "Failed to send bank change request");
            toast.error(errorMessage);
        }
    } catch (err) {
        console.error("Failed to send bank change request:", err);
        toast.error("Failed to send bank change request");
    } finally {
        setSaving(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Your Profile', icon: User },
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'kyc', label: 'KYC & Documents', icon: FileText },
    { id: 'ewa', label: 'EWA Settings', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'help', label: 'Help Centre', icon: HelpCircle },
    { id: 'terms', label: 'Terms & Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock }
  ];

  const faqItems = [
    { 
      question: "How do I add new employees to EaziWage?", 
      answer: "Navigate to the Employees page and click 'Add Employee'. You can add employees individually or upload a CSV file for bulk import. Each employee will receive an invitation to complete their KYC process."
    },
    { 
      question: "What documents are required for employer verification?", 
      answer: "You need: Certificate of Incorporation, KRA PIN Certificate, CR12 Document (Company Directors), Business Permit, and Proof of Bank Account. Audited Financials are recommended for better risk scoring."
    },
    { 
      question: "How is the advance fee calculated?", 
      answer: "The fee ranges from 3.5% to 6.5% based on your company's risk score. Better documentation, verified payroll integration, and good repayment history result in lower fees."
    },
    { 
      question: "Can I set different advance limits for different employees?", 
      answer: "Yes! Go to Employees > Click on an employee > EWA Settings. You can customize max advance percentage, amount limits, and cooldown periods per employee."
    },
    { 
      question: "How do payroll deductions work?", 
      answer: "Advances are automatically deducted from the next payroll cycle. You'll receive a reconciliation report before each payday showing total deductions to process."
    },
    { 
      question: "What happens if an employee leaves the company?", 
      answer: "Any outstanding advances become due immediately. The final settlement will include the deduction. Contact support for cases where the final salary doesn't cover the advance."
    }
  ];

  if (loading) {
    return (
      <EmployerPortalLayout employer={employer}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployerPortalLayout>
    );
  }

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="settings-title">Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your company settings and EWA program configuration</p>
          </div>
          <button 
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
              "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl transition-shadow"
            )}
            onClick={handleSave}
            disabled={saving}
            data-testid="save-settings-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/30 space-y-2">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  icon={tab.icon}
                  label={tab.label}
                />
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Tab */}
            {activeTab === 'account' && <EmployerProfileTab user={user} />}

            {/* Company Tab */}
            {activeTab === 'company' && (
              <>
                <SettingsCard icon={Building2} title="Company Information" description="Update your company details">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Company Name</Label>
                      <Input
                        value={profile.companyName}
                        readOnly
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="company-name-input"
                      />
                      <p className="text-xs text-slate-500">Contact support to change company name</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Payroll Cycle</Label>
                      <Input
                        value={profile.payrollCycle === 'monthly' ? 'Monthly' : profile.payrollCycle === 'bi-weekly' ? 'Bi-Weekly' : profile.payrollCycle === 'weekly' ? 'Weekly' : settings.payrollCycle}
                        readOnly
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed capitalize"
                        data-testid="payroll-cycle-select"
                      />
                      <p className="text-xs text-slate-500">Contact support to change payroll cycle</p>
                    </div>
                  </div>
                  
                  {/* Employer Code */}
                  <div className="mt-4 p-4 bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 rounded-xl border border-primary/20">
                    <Label className="text-slate-700 dark:text-slate-300 text-sm">Employer Code</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <code className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg font-mono text-lg font-bold text-primary border border-primary/30">
                        {employer?.company_code || `EW-${employer?.id?.slice(0, 8).toUpperCase() || 'XXXXXXXX'}`}
                      </code>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Unique identifier assigned upon registration</span>
                    </div>
                  </div>
                </SettingsCard>

                {/* Address Section */}
                <SettingsCard icon={MapPin} title="Business Address" description="Update your company's physical address">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Physical Address</Label>
                      <Input
                        value={profile.physicalAddress}
                        readOnly
                        placeholder="Street address, building name"
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="physical-address-input"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">City</Label>
                        <Input
                          value={profile.city}
                          readOnly
                          placeholder="Nairobi"
                          className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                          data-testid="city-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Postal Code</Label>
                        <Input
                          value={profile.postalCode}
                          readOnly
                          placeholder="00100"
                          className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                          data-testid="postal-code-input"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">County/Region</Label>
                        <Input
                          value={profile.countyRegion}
                          readOnly
                          placeholder="Your county or region"
                          className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                          data-testid="county-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Country</Label>
                        <Input
                          value={profile.country === 'KE' ? 'Kenya' : profile.country === 'UG' ? 'Uganda' : profile.country === 'TZ' ? 'Tanzania' : profile.country === 'RW' ? 'Rwanda' : profile.country}
                          readOnly
                          placeholder="Country"
                          className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                          data-testid="country-input"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Contact support to change your business address</p>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Users} title="Primary Contact" description="Who should we contact about EWA matters?">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Contact Person</Label>
                      <Input
                        value={profile.contactPerson}
                        readOnly
                        placeholder="Full name"
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="contact-person-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Phone Number</Label>
                      <Input
                        value={profile.contactPhone}
                        readOnly
                        placeholder="+254 700 000 000"
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="contact-phone-input"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-slate-700 dark:text-slate-300">Email Address</Label>
                      <Input
                        type="email"
                        value={profile.contactEmail}
                        readOnly
                        placeholder="email@company.com"
                        className="bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        data-testid="contact-email-input"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">Contact support to change your primary contact information</p>
                </SettingsCard>

                {/* Verification Status */}
                <div className={cn(
                  "rounded-2xl p-6 border",
                  employer?.status === 'approved' 
                    ? "bg-linear-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20"
                    : "bg-linear-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center",
                      employer?.status === 'approved' 
                        ? "bg-emerald-100 dark:bg-emerald-500/20"
                        : "bg-amber-100 dark:bg-amber-500/20"
                    )}>
                      {employer?.status === 'approved' ? (
                        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                      ) : (
                        <Clock className="w-7 h-7 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Verification Status: {(employer?.status ?? 'pending').charAt(0).toUpperCase() + (employer?.status ?? 'pending').slice(1)}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {employer?.status === 'approved' 
                          ? 'Your company is fully verified and can access all EaziWage features.'
                          : 'Your company verification is in progress. Some features may be limited until approval.'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* KYC & Documents Tab */}
            {activeTab === 'kyc' && (
              <>
                <SettingsCard icon={FileText} title="Company Documents" description="View and manage your uploaded KYC documents">
                  <div className="space-y-3">
                    <DocumentItem 
                      icon={FileText} 
                      label="Certificate of Incorporation" 
                      fileName={employer?.documents?.certificate_of_incorporation ? "certificate_of_incorporation.pdf" : null}
                      status={employer?.documents?.certificate_of_incorporation ? "approved" : null}
                      onReupload={(file) => handleFileUpload(file, 'certificate_of_incorporation')}
                      isUploading={uploadingDoc === 'certificate_of_incorporation'}
                      onView={() => employer?.documents?.certificate_of_incorporation && window.open(employer.documents.certificate_of_incorporation, '_blank')}
                    />
                    <DocumentItem 
                      icon={FileText} 
                      label="KRA PIN Certificate" 
                      fileName={employer?.documents?.kra_pin_certificate ? "kra_pin.pdf" : null}
                      status={employer?.documents?.kra_pin_certificate ? "approved" : null}
                      onReupload={(file) => handleFileUpload(file, 'kra_pin_certificate')}
                      isUploading={uploadingDoc === 'kra_pin_certificate'}
                      onView={() => employer?.documents?.kra_pin_certificate && window.open(employer.documents.kra_pin_certificate, '_blank')}
                    />
                    <DocumentItem 
                      icon={FileText} 
                      label="CR12 Document" 
                      fileName={employer?.documents?.cr12_document ? "cr12_document.pdf" : null}
                      status={employer?.documents?.cr12_document ? "pending" : null}
                      onReupload={(file) => handleFileUpload(file, 'cr12_document')}
                      isUploading={uploadingDoc === 'cr12_document'}
                      onView={() => employer?.documents?.cr12_document && window.open(employer.documents.cr12_document, '_blank')}
                    />
                    <DocumentItem 
                      icon={FileText} 
                      label="Business Permit" 
                      fileName={employer?.documents?.business_permit ? "business_permit.pdf" : null}
                      status={employer?.documents?.business_permit ? "approved" : null}
                      onReupload={(file) => handleFileUpload(file, 'business_permit')}
                      isUploading={uploadingDoc === 'business_permit'}
                      onView={() => employer?.documents?.business_permit && window.open(employer.documents.business_permit, '_blank')}
                    />
                    <DocumentItem 
                      icon={FileText} 
                      label="Audited Financials" 
                      fileName={employer?.documents?.audited_financials ? "audited_financials.pdf" : null}
                      status={employer?.documents?.audited_financials ? "pending" : null}
                      onReupload={(file) => handleFileUpload(file, 'audited_financials')}
                      isUploading={uploadingDoc === 'audited_financials'}
                      onView={() => employer?.documents?.audited_financials && window.open(employer.documents.audited_financials, '_blank')}
                    />
                    <DocumentItem 
                      icon={FileText} 
                      label="Employment Contract Template" 
                      fileName={employer?.documents?.employment_contract_template ? "contract_template.pdf" : null}
                      status={employer?.documents?.employment_contract_template ? "approved" : null}
                      onReupload={(file) => handleFileUpload(file, 'employment_contract_template')}
                      isUploading={uploadingDoc === 'employment_contract_template'}
                      onView={() => employer?.documents?.employment_contract_template && window.open(employer.documents.employment_contract_template, '_blank')}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard icon={Wallet} title="Bank Account Details" description="Your linked bank account for settlements" locked>
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Bank Name</Label>
                        <Input
                          value={employer?.bank_name || ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Account Number</Label>
                        <Input
                          value={employer?.bank_account_number ? `****${employer.bank_account_number.slice(-4)}` : ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Bank account changes require approval from EaziWage for security purposes.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowBankModal(true)}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3",
                          "border-amber-300 text-amber-700 hover:bg-amber-100"
                        )}
                      >
                        Request Change
                      </button>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Building2} title="Business Information" description="Edit your company details">
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Registration Number</Label>
                        <Input
                          value={employer?.registration_number || ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Tax ID (KRA PIN)</Label>
                        <Input
                          value={employer?.tax_id || ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Industry</Label>
                        <Input
                          value={employer?.industry?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Sector</Label>
                        <Input
                          value={employer?.sector?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || ''}
                          disabled
                          className="bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      To update registration details, please contact support.
                    </p>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* EWA Settings Tab */}
            {activeTab === 'ewa' && (
              <>
                <SettingsCard icon={Percent} title="Advance Limits" description="Control how much employees can advance">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-700 dark:text-slate-300">Maximum Advance Percentage</Label>
                        <span className="text-2xl font-bold text-primary">{settings.maxAdvancePercentage}%</span>
                      </div>
                      <Slider
                        value={[settings.maxAdvancePercentage]}
                        onValueChange={(v) => setSettings(prev => ({ ...prev, maxAdvancePercentage: v[0] }))}
                        max={100}
                        min={10}
                        step={5}
                        className="w-full"
                        data-testid="max-advance-slider"
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Employees can advance up to {settings.maxAdvancePercentage}% of their earned wages
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Minimum Amount (KES)</Label>
                        <Input
                          type="number"
                          value={settings.minAdvanceAmount}
                          onChange={(e) => setSettings(prev => ({ ...prev, minAdvanceAmount: parseInt(e.target.value) || 0 }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="min-advance-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Maximum Amount (KES)</Label>
                        <Input
                          type="number"
                          value={settings.maxAdvanceAmount}
                          onChange={(e) => setSettings(prev => ({ ...prev, maxAdvanceAmount: parseInt(e.target.value) || 0 }))}
                          className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          data-testid="max-advance-input"
                        />
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Calendar} title="Access Period" description="When can employees request advances?">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-slate-700 dark:text-slate-300">Advance Access Window</Label>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">From Day</span>
                          <Select 
                            value={settings.advanceAccessDays[0].toString()}
                            onValueChange={(v) => setSettings(prev => ({ ...prev, advanceAccessDays: [parseInt(v), prev.advanceAccessDays[1]] }))}
                          >
                            <SelectTrigger className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">To Day</span>
                          <Select 
                            value={settings.advanceAccessDays[1].toString()}
                            onValueChange={(v) => setSettings(prev => ({ ...prev, advanceAccessDays: [prev.advanceAccessDays[0], parseInt(v)] }))}
                          >
                            <SelectTrigger className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Employees can request advances from day {settings.advanceAccessDays[0]} to {settings.advanceAccessDays[1]} of each month
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                      <Label className="text-slate-700 dark:text-slate-300">Cooldown Period (Days)</Label>
                      <Input
                        type="number"
                        value={settings.cooldownPeriod}
                        onChange={(e) => setSettings(prev => ({ ...prev, cooldownPeriod: parseInt(e.target.value) || 0 }))}
                        min={0}
                        max={30}
                        className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 max-w-xs"
                        data-testid="cooldown-input"
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Minimum {settings.cooldownPeriod} days between advance requests per employee
                      </p>
                    </div>
                  </div>
                </SettingsCard>

                <div className="bg-linear-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl p-6 border border-blue-500/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">Per-Employee Settings</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300/80 mt-1">
                        You can override these default settings for individual employees. Go to Employees {'>'} Select Employee {'>'} EWA Settings to customize limits per employee.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <SettingsCard icon={Bell} title="Notification Preferences" description="Choose what updates you want to receive">
                <div className="space-y-4">
                  <ToggleItem 
                    icon={Mail}
                    label="Email Notifications"
                    description="Receive important updates via email"
                    checked={settings.emailNotifications}
                    onToggle={(v) => {
                      setSettings(prev => ({ ...prev, emailNotifications: v }));
                      toast.success(v ? 'Email notifications enabled' : 'Email notifications disabled');
                    }}
                  />
                  <ToggleItem 
                    icon={CreditCard}
                    label="Advance Alerts"
                    description="Get notified when employees request advances"
                    checked={settings.advanceAlerts}
                    onToggle={(v) => {
                      setSettings(prev => ({ ...prev, advanceAlerts: v }));
                      toast.success(v ? 'Advance alerts enabled' : 'Advance alerts disabled');
                    }}
                  />
                  <ToggleItem 
                    icon={Calendar}
                    label="Payroll Reminders"
                    description="Reminders to upload monthly payroll data"
                    checked={settings.payrollReminders}
                    onToggle={(v) => {
                      setSettings(prev => ({ ...prev, payrollReminders: v }));
                      toast.success(v ? 'Payroll reminders enabled' : 'Payroll reminders disabled');
                    }}
                  />
                  <ToggleItem 
                    icon={BarChart3}
                    label="Weekly Reports"
                    description="Receive weekly summary reports via email"
                    checked={settings.weeklyReports}
                    onToggle={(v) => {
                      setSettings(prev => ({ ...prev, weeklyReports: v }));
                      toast.success(v ? 'Weekly reports enabled' : 'Weekly reports disabled');
                    }}
                  />
                </div>
              </SettingsCard>
            )}

            {/* Help Centre Tab */}
            {activeTab === 'help' && (
              <>
                <SettingsCard icon={HelpCircle} title="Frequently Asked Questions" description="Quick answers to common questions">
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
                    {faqItems.map((item, index) => (
                      <FAQItem key={index} question={item.question} answer={item.answer} />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard icon={MessageSquare} title="Contact Support" description="Get in touch with our team">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <Mail className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Email Support</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">support@eaziwage.com</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Phone Support</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">+254 723 154 900</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Globe} title="Resources" description="Helpful documentation and guides">
                  <div className="space-y-3">
                    <a href="#" className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Employer Guide</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Complete setup and usage guide</p>
                        </div>
                      </div>
                      <ExternalLink className="w-5 h-5 text-slate-400" />
                    </a>
                    <a href="#" className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">API Documentation</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">For payroll integration</p>
                        </div>
                      </div>
                      <ExternalLink className="w-5 h-5 text-slate-400" />
                    </a>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* Terms & Privacy Tab */}
            {activeTab === 'terms' && (
              <>
                <SettingsCard icon={FileText} title="Terms of Service" description="Your agreement with EaziWage">
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
                    <p className="text-slate-600 dark:text-slate-400">
                      By using EaziWage services, you agree to our Terms of Service which govern the relationship between your company and EaziWage Ltd. The full terms are available below.
                    </p>
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto text-xs text-slate-500 dark:text-slate-400">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">1. Service Agreement</h4>
                      <p>EaziWage provides earned wage access services to employers and their employees. By registering, you agree to facilitate wage advances to your employees through our platform.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">2. Employer Obligations</h4>
                      <p>As an employer, you agree to: (a) Provide accurate payroll data; (b) Deduct advances from employee salaries; (c) Maintain employee consent records; (d) Comply with local labor laws.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">3. Fees and Charges</h4>
                      <p>Fees are calculated based on risk assessment and disclosed to employees before each advance. Employers are not charged for the service.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">4. Termination</h4>
                      <p>Either party may terminate with 30 days notice. Outstanding advances must be settled before termination.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a href="/terms.pdf" download className="flex-1 block">
                      <button 
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                          "w-full"
                        )}
                      >
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                      </button>
                    </a>
                  </div>
                </SettingsCard>

                <SettingsCard icon={Shield} title="Privacy Policy" description="How we handle your data">
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
                    <p className="text-slate-600 dark:text-slate-400">
                      EaziWage is committed to protecting your privacy and the privacy of your employees. Our Privacy Policy outlines how we collect, use, and protect data.
                    </p>
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto text-xs text-slate-500 dark:text-slate-400">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Data We Collect</h4>
                      <p>Company registration details, employee information (name, ID, salary), bank account details, transaction history.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">How We Use Data</h4>
                      <p>To provide wage access services, verify identities, calculate risk scores, process payments, and comply with regulations.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">Data Protection</h4>
                      <p>All data is encrypted at rest and in transit. We comply with Kenya&apos;s Data Protection Act 2019 and international standards.</p>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">Data Sharing</h4>
                      <p>We do not sell data. Data may be shared with: payment processors, regulatory authorities (as required), and service providers under contract.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a href="/data.pdf" download className="flex-1 block">
                      <button 
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                          "w-full"
                        )}
                      >
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                      </button>
                    </a>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <>
                <SettingsCard icon={Lock} title="Password" description="Update your account password">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Current Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Enter current password"
                        className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                        data-testid="current-password" 
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">New Password</Label>
                          <Input 
                            type="password" 
                            placeholder="Enter new password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            data-testid="new-password" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">Confirm Password</Label>
                          <Input 
                            type="password" 
                            placeholder="Confirm new password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            data-testid="confirm-password" 
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handlePasswordUpdate}
                        disabled={updatingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                          "bg-primary text-white"
                        )}
                        data-testid="update-password-btn"
                      >
                        {updatingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </div>
                </SettingsCard>

                {/*
                <SettingsCard icon={Shield} title="Security Settings" description="Additional security options">
                  <div className="space-y-4">
                    <SecurityItem 
                      icon={Shield}
                      label="Two-Factor Authentication"
                      description="Add an extra layer of security"
                      actionLabel="Enable"
                    />
                    <SecurityItem 
                      icon={Clock}
                      label="Login Activity"
                      description="View recent login attempts"
                      actionLabel="View"
                    />
                  </div>
                </SettingsCard>
                */}
              </>
            )}
          </div>
        </div>
      </div>
      <BankChangeModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSubmit={handleBankChangeRequest}
        isSubmitting={saving}
      />
    </EmployerPortalLayout>
  );
}


