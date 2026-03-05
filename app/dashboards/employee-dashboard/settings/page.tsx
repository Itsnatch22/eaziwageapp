"use client"

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Lock, Bell, HelpCircle, 
  MessageCircle, Scale, LogOut, ChevronRight, CheckCircle2,
  Shield, CreditCard, Smartphone, 
  Mail, Phone, Camera, Edit2, Save, X, MapPin, FileText,
  User, IdCard, ChevronDown, ScanFace, Eye, EyeOff,
  Briefcase, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { logout } from '@/actions/auth';
import { EmployeePageLayout, EmployeeHeader } from '@/components/employee/EmployeeLayout';
import { useAuthStore } from '@/lib/stores/auth';
import { AvatarUpload } from '@/components/ui/AvatarUpload';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
interface ToogleSwitchProps {
  checked: boolean;
  onChange: () => void;
  id: string;
}

const ToggleSwitch = ({ checked, onChange, id }: ToogleSwitchProps) => (
  <button
    id={id}
    onClick={onChange}
    className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300",
      checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
    )}
    data-testid={`toggle-${id}`}
  >
    <span className={cn(
      "inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300",
      checked ? "translate-x-5.5" : "translate-x-0.5"
    )} />
  </button>
);

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => void | Promise<void>;
  type?: string;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}
const EditableField = ({ label, value, onSave, type = 'text', placeholder, icon: Icon, disabled = false }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue !== value) {
      await onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {Icon && (
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 text-sm font-semibold text-slate-900 dark:text-white bg-transparent border-b border-primary focus:outline-none"
            />
            <button onClick={handleSave} className="p-1 text-primary hover:bg-primary/10 rounded">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {value || <span className="text-slate-400">Not set</span>}
          </p>
        )}
      </div>
      {!isEditing && !disabled && (
        <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

interface SettingsItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
}
const SettingsItem = ({ icon: Icon, title, subtitle, onClick, rightContent, showChevron = true }: SettingsItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
    data-testid={`settings-${title.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex flex-col items-start flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">{subtitle}</p>}
    </div>
    {rightContent || (showChevron && <ChevronRight className="w-5 h-5 text-slate-400" />)}
  </button>
);

interface SectionHeaderProps {
  title: string;
}
const SectionHeader = ({ title }: SectionHeaderProps) => (
  <h3 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase px-4 pt-4 pb-2">{title}</h3>
);

interface KYCDocumentItemProps {
    title: string;
    status: 'approved' | 'pending' | 'submitted' | null;
    icon: React.ComponentType<{ className?: string }>;
};

const KYCDocumentItem = ({ title, status, icon: Icon }: KYCDocumentItemProps) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center",
      status === 'approved' ? 'bg-primary' : status === 'pending' || status === 'submitted' ? 'bg-primary/60' : 'bg-slate-200 dark:bg-slate-700'
    )}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{title}</span>
    {status === 'approved' ? (
      <CheckCircle2 className="w-4 h-4 text-primary" />
    ) : status === 'pending' || status === 'submitted' ? (
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">Pending</span>
    ) : (
      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Not uploaded</span>
    )}
  </div>
);

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    // In a real app, call API to change password
    setTimeout(() => {
      toast.success('Password changed successfully');
      setLoading(false);
      onClose();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-11 px-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 px-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl bg-primary text-white">
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactSupportModal = ({ isOpen, onClose }: ContactSupportModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Contact Support</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Our team is here to help you 24/7</p>
        
        <div className="space-y-3">
          <a href="tel:+254700123456" className="flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Call Us</p>
              <p className="text-sm text-primary">+254 700 123 456</p>
            </div>
          </a>
          
          <a href="mailto:support@eaziwage.com" className="flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Email Us</p>
              <p className="text-sm text-primary">support@eaziwage.com</p>
            </div>
          </a>
          
          <a href="https://wa.me/254723154900" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">WhatsApp</p>
              <p className="text-sm text-primary">+254 723 154 900</p>
            </div>
          </a>
        </div>
        
        <p className="text-xs text-slate-400 text-center mt-4">Available Mon-Fri 8AM-8PM EAT</p>
        
        <Button onClick={onClose} variant="outline" className="w-full mt-4 h-11 rounded-xl">Close</Button>
      </div>
    </div>
  );
};


interface HelpCenterSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const HelpCenterSection = ({ isExpanded, onToggle }: HelpCenterSectionProps) => {
  const faqs = [
    {
      q: "How do I request a wage advance?",
      a: "Go to the 'Advance' tab, select your desired amount using the slider, choose your disbursement method (M-PESA or Bank), and tap 'Transfer'. Your funds will arrive in seconds."
    },
    {
      q: "What are the fees?",
      a: "Our fees range from 3.5% to 6.5% depending on your employer&apos;s plan. The exact fee is shown before you confirm any transaction. There are no hidden charges or interest."
    },
    {
      q: "How much can I access?",
      a: "You can access up to 60% of your earned wages at any time. Your available balance is shown on your dashboard and updates as you earn."
    },
    {
      q: "When will my KYC be approved?",
      a: "KYC verification typically takes 1-2 business days. You'll receive a notification once your account is verified and ready to use."
    },
    {
      q: "How do I update my payment details?",
      a: "Go to Profile & Settings, scroll to Payment Methods, and tap to edit your M-PESA number or bank account details."
    },
    {
      q: "Is my data secure?",
      a: "Yes! We use bank-grade 256-bit encryption. Your employer only sees aggregated data - your personal transactions remain private."
    }
  ];

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Help Center</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">FAQs and guides</p>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 max-h-80 overflow-y-auto">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="font-semibold text-sm text-slate-900 dark:text-white mb-1">{faq.q}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TermsPrivacySectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}
const TermsPrivacySection = ({ isExpanded, onToggle }: TermsPrivacySectionProps) => {
  const content = {
    terms: `
TERMS OF SERVICE

Last Updated: February 2026

1. ACCEPTANCE OF TERMS
By accessing and using EaziWage&apos;s services, you agree to be bound by these Terms of Service.

2. SERVICES
EaziWage provides earned wage access services, allowing you to access a portion of your earned wages before your scheduled payday.

3. ELIGIBILITY
You must be at least 18 years old and employed by a participating employer to use our services.

4. FEES
Our service fees range from 3.5% to 6.5% per transaction. The exact fee is displayed before you confirm each advance request.

5. REPAYMENT
All advances are automatically deducted from your next salary payment through your employer&apos;s payroll system.

6. USER RESPONSIBILITIES
You agree to provide accurate information and maintain the security of your account credentials.

7. PRIVACY
Your use of our services is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information.

8. LIMITATION OF LIABILITY
EaziWage is not liable for any indirect, incidental, or consequential damages arising from your use of our services.
    `,
    privacy: `
PRIVACY POLICY

Last Updated: February 2026

1. INFORMATION WE COLLECT
- Personal identification information (name, email, phone number, national ID)
- Employment information (employer, salary, job title)
- Financial information (bank account, mobile money details)
- Transaction history

2. HOW WE USE YOUR INFORMATION
- To provide and improve our services
- To verify your identity and employment
- To process wage advance requests
- To communicate with you about your account

3. DATA SECURITY
We implement bank-grade 256-bit encryption and industry-standard security measures to protect your data.

4. DATA SHARING
We do not sell your personal information. We may share data with:
- Your employer (aggregated, non-personal data only)
- Payment processors (to complete transactions)
- Regulatory authorities (when required by law)

5. YOUR RIGHTS
You have the right to access, correct, or delete your personal data. Contact support@eaziwage.com for data requests.
    `
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Terms & Privacy</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Legal information</p>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 max-h-80 overflow-y-auto">
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Terms of Service</h4>
              <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                {content.terms.trim()}
              </pre>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Privacy Policy</h4>
              <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                {content.privacy.trim()}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BiometricScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const BiometricScanModal = ({ isOpen, onClose, onSuccess }: BiometricScanModalProps) => {
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 300, height: 300 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      toast.error('Camera access required for face scan');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && !scanning && !scanComplete) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleScan = () => {
    setScanning(true);
    // Simulate face scan process
    setTimeout(() => {
      setScanning(false);
      setScanComplete(true);
      stopCamera();
      setTimeout(() => {
        onSuccess();
        onClose();
        setScanComplete(false);
      }, 1500);
    }, 2000);
  };

  const handleClose = () => {
    stopCamera();
    setScanComplete(false);
    setScanning(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 text-center">Face Verification</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">Position your face within the circle</p>
        
        <div className="relative mx-auto w-56 h-56 mb-4">
          {/* Video feed */}
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover rounded-full"
          />
          
          {/* Scanning overlay */}
          <div className={cn(
            "absolute inset-0 rounded-full border-4 transition-colors duration-300",
            scanning ? "border-primary animate-pulse" : scanComplete ? "border-primary" : "border-slate-300 dark:border-slate-600"
          )} />
          
          {/* Scan line animation */}
          {scanning && (
            <div className="absolute inset-4 overflow-hidden rounded-full">
              <div className="absolute inset-x-0 h-1 bg-linear-to-r from-transparent via-primary to-transparent animate-scan" />
            </div>
          )}
          
          {/* Success checkmark */}
          {scanComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-full">
              <CheckCircle2 className="w-20 h-20 text-primary" />
            </div>
          )}
        </div>
        
        <p className="text-xs text-slate-400 text-center mb-4">
          {scanning ? 'Scanning...' : scanComplete ? 'Verification successful!' : 'Make sure your face is well-lit'}
        </p>
        
        {!scanComplete && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-xl">Cancel</Button>
            <Button 
              onClick={handleScan} 
              disabled={scanning}
              className="flex-1 h-11 rounded-xl bg-primary text-white"
            >
              {scanning ? 'Scanning...' : 'Start Scan'}
            </Button>
          </div>
        )}
        
        <style>{`
          @keyframes scan {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
          }
          .animate-scan {
            animation: scan 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  );
};

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: { type: string; title: string; message: string; time: string }[];
}

const NotificationsPanel = ({ isOpen, onClose, notifications }: NotificationsPanelProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-end pt-16 px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notif, i) => (
              <div key={i} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", notif.type === 'success' ? 'bg-primary/10' : 'bg-blue-100 dark:bg-blue-500/20')}>
                    {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{notif.title}</p>
                    <p className="text-xs text-slate-500">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{notif.time}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface EmployeeProfile {
  employer_name?: string;
  kyc_status?: string;
  job_title?: string;
  nationality?: string;
  employment_type?: string;
  address_line1?: string;
  city?: string;
  postal_code?: string;
  mobile_money_provider?: string;
  mobile_money_number?: string;
  bank_name?: string;
  bank_account?: string;
  id_document_front?: string;
  address_proof?: string;
  payslip_1?: string;
  employment_contract?: string;
  selfie?: string;
  [key: string]: unknown;
}

interface KycDocument {
  document_type: string;
  status?: 'approved' | 'pending' | 'submitted';
}

interface ProfileData {
  full_name?: string;
  email?: string;
  phone?: string;
  profile_picture_url?: string;
  employee?: EmployeeProfile;
  kycDocuments?: KycDocument[];
}

export default function Settings() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [user, setUser] = useState<{ full_name?: string }>({});


    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showBiometricModal, setShowBiometricModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    
    // Expandable sections
    const [helpExpanded, setHelpExpanded] = useState(false);
    const [termsExpanded, setTermsExpanded] = useState(false);
    
    // Settings states
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const notifications = [
    { type: 'success', title: 'KYC Submitted', message: 'Your documents are under review', time: '2 hours ago' },
    { type: 'info', title: 'Welcome to EaziWage', message: 'Complete your profile to start accessing advances', time: '1 day ago' },
  ];

  useEffect(() => {
    try {
      const storedUser = window.localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      setUser({});
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/employee-dashboard/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
        const formData = new FormData();
        formData.append('profilePicture', file);

        const res = await fetch('/api/employee-dashboard/profile', {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            const data = await res.json();
            setProfile(data.profile);
            toast.success('Profile picture updated successfully');
        } else {
            const err = await res.json();
            toast.error(err.message || 'Failed to update profile picture');
        }
    } catch (error) {
        console.error('Error updating profile picture:', error);
    } finally {
        setUploading(false);
    }
};
    const handleUserSettingsSave = async (field: string, value: string) => {
        try {
            const res = await fetch('/api/employee-dashboard/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data.profile);
                toast.success('Settings saved successfully');
            } else {
                const err = await res.json();
                toast.error(err.message || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    const handleBiometricToggle = () => {
        if (!biometricEnabled) {
            setShowBiometricModal(true);
        } else {
            setShowBiometricModal(false);
            toast.info('Biometric authentication disabled');
        }
    };

    const handleEmployeeSettingsSave = async (field: string, value: string) => {
        try {
            const res = await fetch('/api/employee-dashboard/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data.profile);
                toast.success('Settings saved successfully');
            } else {
                const err = await res.json();
                toast.error(err.message || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    const handleBiometricSuccess = () => {
        setBiometricEnabled(true);
        toast.success('Face ID enabled successfully');
    };

    if (loading) {
        return (
        <EmployeePageLayout>
            <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        </EmployeePageLayout>
        );
    }

    const employee = profile?.employee;
    const kycDocs = profile?.kycDocuments ?? [];

    const getDocStatus = (docType: string): 'approved' | 'pending' | 'submitted' | null => {
        const doc = kycDocs.find((d: KycDocument) => d.document_type === docType);
        return doc?.status || (employee?.[docType] ? 'submitted' : null);
    };

    return (
    <EmployeePageLayout>
      <EmployeeHeader 
        title="Profile & Settings"
        rightContent={
          <button 
            onClick={() => setShowNotifications(true)}
            className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
            data-testid="notifications-btn"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        }
      />

      <main className="relative z-10 max-w-md mx-auto px-4 pb-28 space-y-4">
        {/* Profile Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-700/30">
          <div className="h-20 bg-linear-to-r from-primary via-emerald-500 to-teal-500 relative">
            <div className="absolute inset-0 bg-grid opacity-20" />
          </div>
          
          <div className="px-5 pb-5 -mt-10 relative">
            <div className="flex justify-center mb-4">
              <div className="p-1.5 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl">
                <AvatarUpload 
                  userId={profile?.email || 'user'} // Using email as fallback or identifier if needed
                  currentAvatarUrl={profile?.profile_picture_url ? `${BACKEND_URL}${profile.profile_picture_url}` : null}
                  fullName={profile?.full_name || user?.full_name}
                  onUploadSuccess={(url) => setProfile(prev => prev ? { ...prev, profile_picture_url: url.replace(BACKEND_URL, '') } : null)}
                />
              </div>
            </div>

            <div className="mt-3 text-center">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {profile?.full_name || user?.full_name || 'User'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {employee?.employer_name || 'Employee'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                  employee?.kyc_status === 'approved' 
                    ? "bg-primary/10 text-primary" 
                    : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                )}>
                  {employee?.kyc_status === 'approved' ? (
                    <><CheckCircle2 className="w-3 h-3" /> Verified</>
                  ) : (
                    <><Shield className="w-3 h-3" /> {employee?.kyc_status || 'Pending'}</>
                  )}
                </span>
                {employee?.job_title && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">• {employee.job_title}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Personal Information" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <EditableField 
              label="Full Name" 
              value={profile?.full_name || ''} 
              onSave={(val) => handleUserSettingsSave('full_name', val)}
              icon={User}
              placeholder="Enter your full name"
            />
            <EditableField 
              label="Email" 
              value={profile?.email || ''} 
              icon={Mail}
              type="email"
              disabled
              onSave={() => undefined}
            />
            <EditableField 
              label="Phone Number" 
              value={profile?.phone || ''} 
              onSave={(val) => handleUserSettingsSave('phone', val)}
              icon={Phone}
              placeholder="Enter phone number"
            />
            <EditableField 
              label="Nationality" 
              value={employee?.nationality || ''} 
              onSave={(val) => handleEmployeeSettingsSave('nationality', val)}
              icon={Globe}
              placeholder="Your nationality"
            />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Address" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <EditableField 
              label="Address Line 1" 
              value={employee?.address_line1 || ''} 
              onSave={(val) => handleEmployeeSettingsSave('address_line1', val)}
              icon={MapPin}
              placeholder="Street address"
            />
            <EditableField 
              label="City" 
              value={employee?.city || ''} 
              onSave={(val) => handleEmployeeSettingsSave('city', val)}
              icon={Building2}
              placeholder="City"
            />
            <EditableField 
              label="Postal Code" 
              value={employee?.postal_code || ''} 
              onSave={(val) => handleEmployeeSettingsSave('postal_code', val)}
              icon={MapPin}
              placeholder="Postal code"
            />
          </div>
        </div>

        {/* Employment Details */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Employment" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <EditableField 
              label="Job Title" 
              value={employee?.job_title || ''} 
              onSave={(val) => handleEmployeeSettingsSave('job_title', val)}
              icon={Briefcase}
              placeholder="Your job title"
            />
            <EditableField 
              label="Employment Type" 
              value={employee?.employment_type || ''} 
              onSave={(val) => handleEmployeeSettingsSave('employment_type', val)}
              icon={User}
              placeholder="e.g. Full-time"
            />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">Monthly Gross Salary</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {employee?.monthly_salary ? Number(employee.monthly_salary).toLocaleString() : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Payment Methods" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <SettingsItem 
              icon={Smartphone} 
              title="Mobile Money"
              subtitle={employee?.mobile_money_provider && employee?.mobile_money_number 
                ? `${employee.mobile_money_provider} · ${employee.mobile_money_number}` 
                : 'Not configured'
              }
              rightContent={employee?.mobile_money_provider && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              )}
              onClick={() => {}}
              showChevron={false}
            />
            <SettingsItem 
              icon={CreditCard} 
              title="Bank Account"
              subtitle={employee?.bank_name && employee?.bank_account 
                ? `${employee.bank_name} · ••••${employee.bank_account?.slice(-4)}` 
                : 'Not configured'
              }
              rightContent={employee?.bank_name && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              )}
              onClick={() => {}}
              showChevron={false}
            />
          </div>
        </div>

        {/* KYC Documents Summary */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">KYC Documents</h3>
            <button 
              onClick={() => router.push('/dashboards/employee-dashboard/onboarding')}
              className="text-xs font-semibold text-primary flex items-center gap-1"
            >
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <KYCDocumentItem 
              title="Face ID Verification" 
              status={getDocStatus('face_id')}
              icon={ScanFace}
            />
            <KYCDocumentItem 
              title="National ID / Passport" 
              status={getDocStatus('id_front')}
              icon={IdCard}
            />
            <KYCDocumentItem 
              title="Proof of Address" 
              status={getDocStatus('address_proof')}
              icon={MapPin}
            />
            <KYCDocumentItem 
              title="Payslips" 
              status={getDocStatus('payslip_1')}
              icon={FileText}
            />
            <KYCDocumentItem 
              title="Employment Contract" 
              status={getDocStatus('employment_contract')}
              icon={FileText}
            />
          </div>
        </div>

        {/* Security */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Security" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <SettingsItem 
              icon={Lock} 
              title="Change Password" 
              subtitle="Update your password"
              onClick={() => setShowPasswordModal(true)}
            />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <ScanFace className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Face ID / Biometric</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Quick & secure login</p>
              </div>
              <ToggleSwitch id="biometric" checked={biometricEnabled} onChange={handleBiometricToggle} />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <SectionHeader title="Preferences" />
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Push Notifications</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Transaction alerts</p>
              </div>
              <ToggleSwitch id="notifications" checked={notificationsEnabled} onChange={() => setNotificationsEnabled(!notificationsEnabled)} />
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase px-1">Support</h3>
          
          {/* Help Center - Expandable FAQs */}
          <HelpCenterSection 
            isExpanded={helpExpanded} 
            onToggle={() => setHelpExpanded(!helpExpanded)} 
          />
          
          {/* Contact Support */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
            <SettingsItem 
              icon={MessageCircle} 
              title="Contact Support" 
              subtitle="Get help from our team"
              onClick={() => setShowSupportModal(true)}
            />
          </div>
          
          {/* Terms & Privacy - Expandable Content */}
          <TermsPrivacySection 
            isExpanded={termsExpanded} 
            onToggle={() => setTermsExpanded(!termsExpanded)} 
          />
        </div>

        {/* Logout */}
        <div className="pt-2 pb-4">
          <button 
            onClick={logout}
            className="w-full py-4 rounded-xl border border-red-200 dark:border-red-500/20 text-red-500 font-semibold bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" /> Log Out
          </button>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-4">Version 1.0.0 · EaziWage</p>
        </div>
      </main>

      {/* Modals */}
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      <ContactSupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <BiometricScanModal 
        isOpen={showBiometricModal} 
        onClose={() => setShowBiometricModal(false)} 
        onSuccess={handleBiometricSuccess}
      />
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
      />
    </EmployeePageLayout>
  );
}

