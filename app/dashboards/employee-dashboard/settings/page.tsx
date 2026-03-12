"use client"

import React, { useState, useEffect } from 'react';
import { 
  Building2, Lock, Bell, HelpCircle, 
  ChevronRight, CheckCircle2,
  Shield, CreditCard, Smartphone, 
  Mail, Phone, MapPin,
  User,ScanFace,
  Briefcase, Landmark, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { EmployeePageLayout, EmployeeHeader } from '@/components/employee/EmployeeLayout';
import { updateUserAvatar } from '@/lib/stores/auth';
import { AvatarUpload } from '@/components/ui/AvatarUpload';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// ─── Sub-components ───────────────────────────────────────────────────────────

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
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

const SettingsCard = ({ icon: Icon, title, description, children, locked = false }: any) => (
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

const ToggleItem = ({ icon: Icon, label, description, checked, onToggle }: any) => (
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
    <Switch checked={checked} onCheckedChange={onToggle} />
  </div>
);

const FAQItem = ({ question, answer }: any) => {
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EmployeeSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);

  // Settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
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
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (updates: any) => {
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
          
          {/* Sidebar */}
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

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <SettingsCard icon={User} title="Personal Information" description="Manage your basic account details">
                  <div className="flex flex-col items-center mb-8">
                    <AvatarUpload 
                      userId={profile?.id} 
                      currentAvatarUrl={profile?.avatar_url} 
                      fullName={profile?.full_name}
                      onUploadSuccess={(url) => {
                        // Update the auth store so the layout avatar updates immediately
                        updateUserAvatar(url);
                      }}
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
                  <p className="mt-4 text-[10px] text-slate-400 italic">To change verified personal details, please contact HR.</p>
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

            {/* Employment Tab */}
            {activeTab === 'employment' && (
              <div className="space-y-6">
                <SettingsCard icon={Building2} title="Work Details" description="Information about your professional affiliation" locked>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employer</Label>
                      <Input value={employee?.employer_id|| 'Loading...'} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
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
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{profile?.currency || 'KES'}</span>
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
                        Your account is linked to <span className="font-bold text-slate-900 dark:text-white">{employee?.employer_id ? `•••• ${employee.employer_id.slice(-4)}` : '---'}</span>. 
                        Your salary advances are automatically reconciled via your company's payroll system.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <SettingsCard icon={Smartphone} title="Mobile Money" description="Your primary disbursement method">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                        <Smartphone className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{employee?.mobile_money_provider || 'Not linked'}</p>
                        <p className="text-sm text-emerald-600 font-medium">{employee?.mobile_money_number || '---'}</p>
                      </div>
                    </div>
                    {employee?.mobile_money_number && <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Linked</span>}
                  </div>
                </SettingsCard>

                <SettingsCard icon={Landmark} title="Bank Account" description="Alternative withdrawal method">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                        <CreditCard className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{employee?.bank_name || 'No bank linked'}</p>
                        <p className="text-sm text-slate-500">{employee?.bank_account ? `•••• ${employee.bank_account.slice(-4)}` : '---'}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}>Manage</Button>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* KYC Tab */}
            {activeTab === 'kyc' && (
              <SettingsCard icon={Shield} title="KYC Compliance" description="Your identity verification status">
                <div className="space-y-3">
                  {profile?.kycDocuments && profile.kycDocuments.length > 0 ? (
                    profile.kycDocuments.map((doc: any) => {
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
                  {profile?.kycDocuments?.some((d: any) => d.status === 'rejected') ? 'Re-upload Documents' : 'Update Documents'}
                </Button>
              </SettingsCard>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <SettingsCard icon={Bell} title="Preferences" description="Control your notification settings">
                <div className="space-y-4">
                  <ToggleItem 
                    icon={Mail}
                    label="Email Alerts"
                    description="Transaction receipts and statements"
                    checked={notificationsEnabled}
                    onToggle={setNotificationsEnabled}
                  />
                  <ToggleItem 
                    icon={Smartphone}
                    label="Push Notifications"
                    description="Real-time withdrawal updates"
                    checked={true}
                    onToggle={() => {}}
                  />
                </div>
              </SettingsCard>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <SettingsCard icon={Lock} title="Password" description="Update your security credentials">
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>New Password</Label><Input type="password" placeholder="••••••••" /></div>
                      <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" placeholder="••••••••" /></div>
                    </div>
                    <Button className="bg-primary text-white">Update Password</Button>
                  </div>
                </SettingsCard>

                <SettingsCard icon={ScanFace} title="Biometrics" description="Fast and secure authentication">
                  <ToggleItem 
                    icon={Shield}
                    label="Face ID Login"
                    description="Use facial recognition to sign in"
                    checked={biometricEnabled}
                    onToggle={() => setBiometricEnabled(!biometricEnabled)}
                  />
                </SettingsCard>
              </div>
            )}

            {/* Help Tab */}
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
    </EmployeePageLayout>
  );
}

const InfoRow = ({ icon: Icon }: any) => <Icon className="w-6 h-6 text-white" />;
