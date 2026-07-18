"use client"

import React, { useState, useEffect } from 'react';
import {
  Building2, Lock, Bell, HelpCircle,
  ChevronRight, CheckCircle2,
  Shield, CreditCard, Smartphone,
  Mail, Phone, MapPin, Search,
  User, Loader2,
  Briefcase, Landmark, Clock, AlertTriangle, History,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { EmployeePageLayout, EmployeeHeader } from '@/components/employee/EmployeeLayout';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { DeleteAccountModal } from '@/components/employee/DeleteAccountModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { MfaSection } from '@/components/security/MfaSection';

type ActivityLog = {
  action?: string;
  created_at?: string;
  metadata?: { 
    ip?: string;
    location?: string;
    device_fingerprint?: string;
    user_agent?: string;
    device_name?: string;
  };
};

type KycDocument = {
  document_type: string;
  status: string;
  reviewer_notes?: string;
};

type EmployeeSettingsProfile = {
  address_line1?: string;
  bank_account?: string;
  bank_name?: string;
  city?: string;
  company_name?: string;
  employer_id?: string | null;
  employment_type?: string;
  job_title?: string;
  mobile_money_number?: string;
  mobile_money_provider?: string;
  monthly_salary?: number | string;
  postal_code?: string;
  country?: string;
  currency?: string;
};

type EmployerOption = {
  id: string;
  company_name: string;
  company_code: string;
  industry?: string;
  city?: string;
  country?: string;
};

type Profile = {
  id?: string;
  avatar_url?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  currency?: string;
  employee?: EmployeeSettingsProfile;
  kycDocuments?: KycDocument[];
};

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; }) => (
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
    <span className="font-medium text-sm">{label}</span>
    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
  </button>
);

const SettingsCard = ({ icon: Icon, title, description, children, locked = false }: { icon: LucideIcon; title: string; description?: string; children: React.ReactNode; locked?: boolean; }) => (
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
          <Lock className="w-3 h-3" /> Read Only
        </span>
      )}
    </div>
    {children}
  </div>
);

const LinkEmployerCard = ({
  onLink,
  linking,
}: {
  onLink: (company: EmployerOption) => Promise<void>;
  linking: boolean;
}) => {
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<EmployerOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selected, setSelected] = useState<EmployerOption | null>(null);

  useEffect(() => {
    if (fetched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchLoading(true);
    fetch('/api/employee-dashboard/employers')
      .then((res) => (res.ok ? res.json() : { employers: [] }))
      .then((data) => setCompanies(data.employers ?? []))
      .catch(() => setCompanies([]))
      .finally(() => {
        setSearchLoading(false);
        setFetched(true);
      });
  }, [fetched]);

  const results = query.trim()
    ? companies.filter((c) => c.company_name?.toLowerCase().includes(query.trim().toLowerCase()))
    : companies;

  return (
    <SettingsCard
      icon={Building2}
      title="Link Your Employer"
      description="Your account isn't linked to a company yet — search for yours below to unlock wage advances"
    >
      {selected ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{selected.company_name}</p>
              {selected.city && <p className="text-xs text-slate-500">{selected.city}{selected.country ? `, ${selected.country}` : ''}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)} disabled={linking}>
              Change
            </Button>
          </div>
          <Button className="w-full bg-primary text-white" onClick={() => onLink(selected)} disabled={linking}>
            {linking ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Linking…</span>
            ) : (
              `Link to ${selected.company_name}`
            )}
          </Button>
          <p className="text-[10px] text-slate-400 text-center">This can&apos;t be changed once linked — contact support if you selected the wrong company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search by company name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          {searchLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left flex items-center gap-3 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{c.company_name}</p>
                    {c.city && <p className="text-xs text-slate-500 truncate">{c.city}{c.country ? `, ${c.country}` : ''}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">No companies found. If yours isn&apos;t on EaziWage yet, contact support for help onboarding them.</p>
          )}
        </div>
      )}
    </SettingsCard>
  );
};

const ToggleItem = ({ icon: Icon, label, description, checked, onToggle, disabled }: { icon: LucideIcon; label: string; description: string; checked: boolean; onToggle: (checked: boolean) => void; disabled?: boolean; }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-medium text-slate-900 dark:text-white text-sm">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
  </div>
);

const FAQItem = ({ question, answer }: { question: string; answer: string; }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/50 dark:border-slate-700/30 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between py-4 text-left">
        <span className="font-medium text-sm text-slate-900 dark:text-white">{question}</span>
        <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && <div className="pb-4 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{answer}</div>}
    </div>
  );
};

export default function EmployeeSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);


  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const [logTotal, setLogTotal] = useState(0);

  type PaymentMethod = {
    id: string;
    method_type: 'mobile_money' | 'bank_account';
    provider_name: string;
    account_number?: string | null;
    account_name?: string | null;
    phone_number?: string | null;
    is_default?: boolean;
    is_verified?: boolean;
  };
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({ emailAlerts: true, pushNotifications: true });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const { subscribe, unsubscribe, status: pushStatus } = usePushNotifications();
  const [linkingEmployer, setLinkingEmployer] = useState(false);

  useEffect(() => {
    if (activeTab === 'security') Promise.resolve().then(() => setLogPage(0));
  }, [activeTab]);

  useEffect(() => {
    async function fetchLogs() {
      if (activeTab === 'security') {
        setLogsLoading(true);
        try {
          const res = await fetch(`/api/auth/activity-logs?page=${logPage}`);
          if (res.ok) {
            const data = await res.json();
            setActivityLogs(data.logs || []);
            setLogTotal(data.total ?? 0);
          }
        } finally {
          setLogsLoading(false);
        }
      }
    }
    fetchLogs();
  }, [activeTab, logPage]);

  useEffect(() => {
    async function fetchPaymentMethods() {
      if (activeTab === 'payment') {
        setPaymentMethodsLoading(true);
        try {
          const res = await fetch('/api/employee-dashboard/payment-methods');
          if (res.ok) {
            const data = await res.json();
            setPaymentMethods(data.methods || []);
          }
        } finally {
          setPaymentMethodsLoading(false);
        }
      }
    }
    fetchPaymentMethods();
  }, [activeTab]);

  useEffect(() => {
    async function fetchNotificationPreferences() {
      if (activeTab === 'notifications') {
        try {
          const res = await fetch('/api/employee-dashboard/notifications/preferences');
          if (res.ok) {
            const data = await res.json();
            setNotificationPrefs({
              emailAlerts: data.emailAlerts,
              pushNotifications: data.pushNotifications
            });
          }
        } catch (error) {
          console.error('Failed to fetch notification preferences:', error);
        }
      }
    }
    
    fetchNotificationPreferences();
  }, [activeTab]);


  useEffect(() => {
    const fetchProfile = async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const res = await fetch('/api/employee-dashboard/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile({ silent: true });
  }, []);

  const handleUpdateProfile = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/employee-dashboard/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLinkEmployer = async (company: EmployerOption) => {
    setLinkingEmployer(true);
    try {
      const res = await fetch('/api/employee-dashboard/link-employer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_code: company.company_code }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Linked to ${data.company_name || company.company_name}`);
        const profileRes = await fetch('/api/employee-dashboard/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData.profile);
        }
      } else {
        toast.error(data.error || 'Failed to link employer');
      }
    } catch {
      toast.error('Failed to link employer');
    } finally {
      setLinkingEmployer(false);
    }
  };

  const handleNotificationUpdate = async (key: 'emailAlerts' | 'pushNotifications', value: boolean) => {
  setNotificationLoading(true);
  try {

    if (key === 'pushNotifications' && value) {
      // Only bail on a failed subscribe — the preference would then claim
      // push is on when no subscription actually exists. A failed
      // unsubscribe is not blocking: the user's intent (stop sending push)
      // is still honored server-side via the preference itself even if the
      // browser-level subscription teardown didn't succeed.
      const subscribed = await subscribe();
      if (!subscribed) {
        toast.error('Could not enable push notifications — check your browser permissions.');
        return;
      }
    } else if (key === 'pushNotifications' && !value) {
      await unsubscribe();
    }

    const newPrefs = { ...notificationPrefs, [key]: value };
    const res = await fetch('/api/employee-dashboard/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailAlerts: newPrefs.emailAlerts,
        pushNotifications: newPrefs.pushNotifications
      }),
    });

    if (res.ok) {
      setNotificationPrefs(newPrefs);
      toast.success('Notification preferences updated successfully');
    } else {
      const error = await res.json();
      toast.error(error.error || 'Failed to update preferences');
      setNotificationPrefs(prev => ({ ...prev, [key]: !value }));
    }
  } catch {
    toast.error('An error occurred while updating your preferences');
    setNotificationPrefs(prev => ({ ...prev, [key]: !value }));
  } finally {
    setNotificationLoading(false);
  }
};

  const handlePasswordUpdate = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/employee-dashboard/security/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordData.newPassword }),
      });
      
      if (res.ok) {
        toast.success('Password updated successfully');
        setPasswordData({ newPassword: '', confirmPassword: '' });
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update password');
      }
    } catch {
      toast.error('An error occurred while updating your password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async (reason: string, category: string, additionalFeedback?: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/employee-dashboard/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          category,
          additionalFeedback,
        }),
      });
      
      if (res.ok) {
        toast.success('Account deleted successfully');
        router.push('/');
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to delete account');
      }
    } catch {
      toast.error('An error occurred while deleting your account');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Profile', icon: User },
    { id: 'employment', label: 'Work & Company', icon: Building2 },
    { id: 'payment', label: 'Payment Methods', icon: CreditCard },
    { id: 'kyc', label: 'Identity & KYC', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
  ];

  if (loading) {
    return (
      <EmployeePageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </EmployeePageLayout>
    );
  }

  const employee = profile?.employee;

  return (
    <EmployeePageLayout>
      <EmployeeHeader 
        title="Settings" 
        rightContent={
          activeTab === 'account' && (
            <Button 
              onClick={() => handleUpdateProfile({})}
              disabled={saving}
              className="bg-primary text-white"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )
        }
      />

      <main className="max-w-6xl mx-auto px-4 pb-28 space-y-6">
        <div className="grid lg:grid-cols-4 gap-6">
          
          
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/30 space-y-1">
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

          
          <div className="lg:col-span-3 space-y-6">
            
            
            {activeTab === 'account' && (
              <div className="space-y-6">
                <SettingsCard icon={User} title="Personal Information" description="Manage your basic account details">
                  <div className="flex flex-col items-center mb-8">
                    <AvatarUpload
                      userId={profile?.id}
                      currentAvatarUrl={profile?.avatar_url}
                      fullName={profile?.full_name}
                      onUploadSuccess={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={profile?.full_name || ''} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Work Email</Label>
                      <Input value={profile?.email || ''} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={profile?.phone || ''} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nationality</Label>
                      <Input value={employee?.country || 'Not set'} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 italic">To change verified personal details, please contact admin.</p>
                </SettingsCard>

                <SettingsCard icon={Lock} title="Danger Zone" description="Irreversible account actions">
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-800 dark:text-red-400">Delete Account</h4>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            Permanently delete your account and all associated data. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => setShowDeleteModal(true)}
                        variant="outline"
                        className="mt-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      >
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard icon={MapPin} title="Resident Address" description="Your current residential information">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Street Address</Label>
                      <Input value={employee?.address_line1 || ''} placeholder="e.g. 123 Riverside" readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={employee?.city || ''} placeholder="e.g. Nairobi" readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Postal Code</Label>
                        <Input value={employee?.postal_code || ''} placeholder="e.g. 00100" readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                      </div>
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}

            
            {activeTab === 'employment' && (
              <div className="space-y-6">
                {!employee?.employer_id ? (
                  <LinkEmployerCard onLink={handleLinkEmployer} linking={linkingEmployer} />
                ) : (
                  <>
                    <SettingsCard icon={Building2} title="Work Details" description="Information about your professional affiliation" locked>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Employer</Label>
                          <Input value={employee?.company_name || 'Loading...'} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Job Title</Label>
                          <Input value={employee?.job_title || 'N/A'} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Employment Type</Label>
                          <Input value={employee?.employment_type?.replace('_', ' ') || 'Full-time'} readOnly className="bg-slate-50 dark:bg-slate-800/50 capitalize" />
                        </div>
                        <div className="space-y-2">
                          <Label>Monthly Salary</Label>
                          <div className="relative">
                            <Input value={employee?.monthly_salary ? Number(employee.monthly_salary).toLocaleString() : '---'} readOnly className="bg-slate-50 dark:bg-slate-800/50 pl-12" />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{profile?.employee?.currency || 'KES'}</span>
                          </div>
                        </div>
                      </div>
                    </SettingsCard>

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
                          <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">Employment Verified</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Your account is linked to <span className="font-bold text-slate-900 dark:text-white">{employee?.company_name || '---'}</span>.
                            Your salary advances are automatically reconciled via your company&apos;s payroll system.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <SettingsCard icon={CreditCard} title="Payment Methods" description="Your saved disbursement accounts">
                  {paymentMethodsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">No payment methods saved</p>
                        <p className="text-xs text-slate-500 mt-0.5">Add a mobile money number or bank account to receive advances.</p>
                      </div>
                      <Button size="sm" className="mt-1" onClick={() => router.push('/dashboards/employee-dashboard/payment-methods')}>
                        Add Payment Method
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((pm) => {
                        const isMobile = pm.method_type === 'mobile_money';
                        return (
                          <div key={pm.id} className={cn(
                            'p-4 rounded-xl border flex items-center justify-between gap-4',
                            isMobile
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                          )}>
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                {isMobile ? <Smartphone className="w-5 h-5 text-emerald-600" /> : <Landmark className="w-5 h-5 text-slate-500" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{pm.provider_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                  {isMobile
                                    ? pm.phone_number || '---'
                                    : pm.account_number ? `•••• ${pm.account_number.slice(-4)}` : '---'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {pm.is_default && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase">Default</span>
                              )}
                              {pm.is_verified && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Verified</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 flex justify-end">
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => router.push('/dashboards/employee-dashboard/payment-methods')}>
                          Manage Payment Methods
                        </Button>
                      </div>
                    </div>
                  )}
                </SettingsCard>
              </div>
            )}

            
            {activeTab === 'kyc' && (
              <SettingsCard icon={Shield} title="KYC Compliance" description="Your identity verification status">
                <div className="space-y-3">
                  {profile?.kycDocuments && profile.kycDocuments.length > 0 ? (
                    profile.kycDocuments.map((doc) => {
                      const labelMap: Record<string, string> = {
                        face_id: 'Biometric Face Scan',
                        national_id: 'National ID (Front)',
                        passport: 'Passport (Bio Page)',
                        utility_bill: 'Proof of Address',
                        tax_certificate: 'Tax Certificate',
                        payslip: 'Latest Payslip',
                        bank_statement: 'Bank Statement',
                        employment_contract: 'Employment Contract'
                      };
                      
                      return (
                        <div key={doc.document_type} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-4">
                            {doc.status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{labelMap[doc.document_type] || doc.document_type}</p>
                              {doc.reviewer_notes && <p className="text-[10px] text-red-500 mt-0.5">{doc.reviewer_notes}</p>}
                            </div>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            doc.status === 'approved' ? "text-emerald-600 bg-emerald-100" : 
                            doc.status === 'rejected' ? "text-red-600 bg-red-100" : "text-amber-600 bg-amber-100"
                          )}>
                            {doc.status}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500">No documents submitted yet.</p>
                    </div>
                  )}
                </div>
                <Button className="w-full mt-6" variant="outline" onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}>
                  {profile?.kycDocuments?.some((d) => d.status === 'rejected') ? 'Re-upload Documents' : 'Update Documents'}
                </Button>
              </SettingsCard>
            )}

            
            {activeTab === 'notifications' && (
              <SettingsCard icon={Bell} title="Preferences" description="Control your notification settings">
                <div className="space-y-4">
                  <ToggleItem 
                    icon={Mail}
                    label="Email Alerts"
                    description="Transaction receipts and statements"
                    checked={notificationPrefs.emailAlerts}
                    onToggle={(checked: boolean) => handleNotificationUpdate('emailAlerts', checked)}
                    disabled={notificationLoading}
                  />
                  <ToggleItem
                    icon={Smartphone}
                    label="Push Notifications"
                    description="Real-time withdrawal updates"
                    checked={notificationPrefs.pushNotifications}
                    onToggle={(checked: boolean) => handleNotificationUpdate('pushNotifications', checked)}
                    disabled={notificationLoading || pushStatus === 'unsupported'}
                  />
                  {pushStatus === 'denied' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 pl-1">
                      Push notifications are blocked in your browser settings. Enable them there, or we&apos;ll continue sending you email alerts as a fallback.
                    </p>
                  )}
                  {pushStatus === 'unsupported' && (
                    <p className="text-xs text-slate-400 mt-1 pl-1">
                      Push notifications aren&apos;t supported in this browser. You&apos;ll receive email alerts instead.
                    </p>
                  )}
                </div>
              </SettingsCard>
            )}

            
            {activeTab === 'security' && (
              <div className="space-y-6">
                <SettingsCard icon={Shield} title="Multi-Factor Authentication" description="Add an extra layer of security to your account">
                  <MfaSection apiBase="/api/employee-dashboard/security/mfa" friendlyName="EaziWage Authenticator" />
                </SettingsCard>

                <SettingsCard icon={History} title="Login History & Activity" description="Recent security-related events on your account">
                  <div className="space-y-4">
                    {logsLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : activityLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No recent activity logged.</p>
                    ) : (
                      <>
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                          {activityLogs.map((log, idx) => (
                            <div key={idx} className="py-3 flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{(log.action || 'activity').replace('_', ' ')}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}</p>
                                {(log.metadata?.device_name || log.metadata?.location || log.metadata?.ip) && (
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    {log.metadata.device_name ? `💻 ${log.metadata.device_name}` : ''}
                                    {(log.metadata.location || log.metadata.ip) ? (log.metadata.device_name ? ' • ' : '') : ''}
                                    {log.metadata.location ? `📍 ${log.metadata.location}` : ''}
                                    {log.metadata.ip ? `${log.metadata.location ? ' • ' : ''}🌐 ${log.metadata.ip}` : ''}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase tracking-widest ml-3">
                                {log.metadata?.ip ? log.metadata.ip.split('.').slice(-2).join('.') : 'Verified'}
                              </span>
                            </div>
                          ))}
                        </div>
                        {logTotal > 10 && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-500">
                              Page {logPage + 1} of {Math.ceil(logTotal / 10)}
                              <span className="ml-1 text-slate-400">({logTotal} total)</span>
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs"
                                disabled={logPage === 0}
                                onClick={() => setLogPage(p => p - 1)}
                              >
                                ← Prev
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs"
                                disabled={(logPage + 1) * 10 >= logTotal}
                                onClick={() => setLogPage(p => p + 1)}
                              >
                                Next →
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </SettingsCard>

                <SettingsCard icon={Lock} title="Password" description="Update your security credentials">
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm Password</Label>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Button 
                      className="bg-primary text-white" 
                      onClick={handlePasswordUpdate}
                      disabled={passwordLoading || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      {passwordLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </div>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </SettingsCard>
              </div>
            )}

            
            {activeTab === 'help' && (
              <div className="space-y-6">
                <SettingsCard icon={HelpCircle} title="Common Questions" description="Quick answers to frequently asked questions">
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
                    <FAQItem question="How fast is the disbursement?" answer="Disbursements to M-PESA and verified bank accounts are instant, usually arriving within 60 seconds of approval." />
                    <FAQItem question="What is the maximum I can withdraw?" answer="You can access up to 60% of your earned wages. The exact amount is shown on your dashboard dial." />
                    <FAQItem question="Are there any interests charged?" answer="No. EaziWage is not a loan. We charge a small, transparent service fee per transaction." />
                  </div>
                </SettingsCard>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white/60 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4"><Phone className="w-6 h-6 text-primary" /></div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Call Support</h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4">Available Mon-Fri, 8AM-8PM</p>
                    <a href="tel:+254700123456" className="text-primary font-bold text-sm hover:underline">+254 723 154 900</a>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4"><Mail className="w-6 h-6 text-primary" /></div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Email Us</h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4">We usually reply within 2 hours</p>
                    <a href="mailto:support@eaziwage.com" className="text-primary font-bold text-sm hover:underline">support@eaziwage.com</a>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleteAccount={handleDeleteAccount}
        loading={deleteLoading}
      />
    </EmployeePageLayout>
  );
}