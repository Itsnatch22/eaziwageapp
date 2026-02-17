'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Eye, EyeOff, Lock, Check, User, Mail,
  Building2, Search, X, Phone, AlertTriangle, ChevronDown,
  Sparkles, Sun, Moon, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTheme } from '@/lib/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DialCode {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

interface Company {
  id: string;
  company_name: string;
  company_code: string;
}

type AccountType = 'employee' | 'employer';

interface EmployerReferral {
  employer_name: string;
  employer_email: string;
  employer_phone: string;
}

interface RegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  phone_country_code: string;
  password: string;
  role: AccountType;
  company_code: string;
  company_name: string;
  recaptcha_token: string;
  employer_referral: EmployerReferral | null;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, parameters: Record<string, any>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIALING_CODES: DialCode[] = [
  { code: 'KE', name: 'Kenya',    dialCode: '+254', flag: '🇰🇪' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda',   dialCode: '+256', flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda',   dialCode: '+250', flag: '🇷🇼' },
];

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DialCodeSelectorProps {
  selected: DialCode;
  onSelect: (code: DialCode) => void;
  size?: 'sm' | 'md';
}

function DialCodeSelector({ selected, onSelect, size = 'md' }: DialCodeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const height   = size === 'md' ? 'h-14'       : 'h-12';
  const minWidth = size === 'md' ? 'min-w-[110px]' : 'min-w-[95px]';
  const textSize = size === 'md' ? 'text-sm'    : 'text-xs';
  const flagSize = size === 'md' ? 'text-lg'    : 'text-base';
  const chevron  = size === 'md' ? 'w-4 h-4'   : 'w-3 h-3';
  const px       = size === 'md' ? 'px-3'      : 'px-2';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${height} ${px} ${minWidth} rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-green-600 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 flex items-center gap-2 transition-colors`}
      >
        <span className={flagSize}>{selected.flag}</span>
        <span className={`text-slate-900 dark:text-white font-medium ${textSize}`}>{selected.dialCode}</span>
        <ChevronDown className={`${chevron} text-slate-400 ml-auto`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {DIALING_CODES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => { onSelect(country); setOpen(false); }}
              className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left ${
                selected.code === country.code ? 'bg-green-50 dark:bg-green-900/20' : ''
              }`}
            >
              <span className={flagSize}>{country.flag}</span>
              <span className={`text-slate-900 dark:text-white ${textSize}`}>{country.name}</span>
              <span className={`text-slate-500 ${textSize} ml-auto`}>{country.dialCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CompanySearchModalProps {
  employers: Company[];
  onSelect: (company: Company) => void;
  onNotFound: () => void;
  onClose: () => void;
}

function CompanySearchModal({ employers, onSelect, onNotFound, onClose }: CompanySearchModalProps) {
  const [query, setQuery] = useState('');

  const results = query.trim()
    ? employers.filter(
        (e) =>
          e.company_name?.toLowerCase().includes(query.toLowerCase()) ||
          e.company_code?.toLowerCase().includes(query.toLowerCase()),
      )
    : employers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">Find Your Company</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by company name or code…"
              className="h-12 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((company) => (
                <button
                  key={company.id}
                  onClick={() => onSelect(company)}
                  className="w-full p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{company.company_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Code: {company.company_code}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 mb-1">No companies found</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Try a different search or continue without a code</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onNotFound}
            className="w-full py-3 text-sm font-medium text-green-600 dark:text-green-400 hover:underline"
          >
            My company isn't listed — Continue without code
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // — Form state —
  const [accountType,   setAccountType]   = useState<AccountType>('employee');
  const [fullName,      setFullName]       = useState('');
  const [email,         setEmail]          = useState('');
  const [mobileNumber,  setMobileNumber]   = useState('');
  const [dialCode,      setDialCode]       = useState<DialCode>(DIALING_CODES[0]);
  const [companyCode,   setCompanyCode]    = useState('');
  const [companyName,   setCompanyName]    = useState('');
  const [password,      setPassword]       = useState('');
  const [showPassword,  setShowPassword]   = useState(false);
  const [agreedToTerms, setAgreedToTerms]  = useState(false);

  // — Company selection —
  const [selectedCompany,   setSelectedCompany]   = useState<Company | null>(null);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [noCompanyFound,    setNoCompanyFound]    = useState(false);
  const [employers,         setEmployers]          = useState<Company[]>([]);

  // — Employer referral —
  const [referralName,     setReferralName]     = useState('');
  const [referralEmail,    setReferralEmail]    = useState('');
  const [referralPhone,    setReferralPhone]    = useState('');
  const [referralDialCode, setReferralDialCode] = useState<DialCode>(DIALING_CODES[0]);

  // — UI —
  const [error,              setError]              = useState('');
  const [isLoading,          setIsLoading]          = useState(false);
  const [recaptchaReady,     setRecaptchaReady]     = useState(false);

  useEffect(() => {
    const fetchEmployers = async () => {
      try {
        const res = await fetch('/api/employers/public/approved');
        if (res.ok) {
          const data: Company[] = await res.json();
          setEmployers(data ?? []);
        }
      } catch {
        // Non-critical
      }
    };
    fetchEmployers();
  }, []);

  const handleSelectCompany = useCallback((company: Company) => {
    setSelectedCompany(company);
    setCompanyCode(company.company_code ?? '');
    setShowCompanySearch(false);
    setNoCompanyFound(false);
    setReferralName('');
    setReferralEmail('');
    setReferralPhone('');
  }, []);

  const handleClearCompany  = useCallback(() => { setSelectedCompany(null); setCompanyCode(''); }, []);
  const handleCompanyNotFound = useCallback(() => {
    setShowCompanySearch(false);
    setNoCompanyFound(true);
    setSelectedCompany(null);
    setCompanyCode('');
  }, []);

  /** Executes reCAPTCHA v3 and returns the token. */
  const getReCaptchaToken = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!RECAPTCHA_SITE_KEY) return reject(new Error('reCAPTCHA site key not configured'));
      if (!recaptchaReady || !window.grecaptcha) return reject(new Error('reCAPTCHA not ready'));
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          reject(err);
        }
      });
    });
  }, [recaptchaReady]);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!fullName.trim() || !email.trim() || !password || !mobileNumber.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (cleanedMobile.length < 9) {
      setError('Please enter a valid mobile number');
      return;
    }
    if (accountType === 'employer' && !companyName.trim()) {
      setError('Please enter your company name');
      return;
    }
    if (accountType === 'employee' && noCompanyFound) {
      if (!referralName.trim() || !referralEmail.trim() || !referralPhone.trim()) {
        setError("Please provide your employer's contact details so we can onboard them");
        return;
      }
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);
    try {
      const recaptchaToken = await getReCaptchaToken('register');

      const payload: RegisterPayload = {
        full_name:          fullName.trim(),
        email:              email.trim().toLowerCase(),
        phone:              `${dialCode.dialCode}${cleanedMobile}`,
        phone_country_code: dialCode.code,
        password,
        role:               accountType,
        company_code:       accountType === 'employee' ? companyCode : '',
        company_name:       accountType === 'employer' ? companyName.trim() : '',
        recaptcha_token:    recaptchaToken,
        employer_referral:  noCompanyFound
          ? {
              employer_name:  referralName.trim(),
              employer_email: referralEmail.trim().toLowerCase(),
              employer_phone: `${referralDialCode.dialCode}${referralPhone.replace(/\D/g, '')}`,
            }
          : null,
      };

      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.');
        return;
      }

      router.push(accountType === 'employer' ? '/employer/onboarding' : '/employee/onboarding');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    fullName, email, password, mobileNumber, dialCode, accountType,
    companyCode, companyName, noCompanyFound,
    referralName, referralEmail, referralPhone, referralDialCode,
    agreedToTerms, getReCaptchaToken, router,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <>
      {/**
       * reCAPTCHA v3 — lazyOnload defers loading until after the page is
       * interactive, keeping the initial bundle unblocked.
       * onReady fires once the script and grecaptcha object are available.
       */}
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-20 right-0 w-150 h-150 bg-green-500/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-125 h-125 bg-slate-900/5 dark:bg-green-900/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Company Search Modal */}
        {showCompanySearch && (
          <CompanySearchModal
            employers={employers}
            onSelect={handleSelectCompany}
            onNotFound={handleCompanyNotFound}
            onClose={() => setShowCompanySearch(false)}
          />
        )}

        {/* Header */}
        <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-end">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full max-w-md">

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-12 h-12 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-600/30">
                    <span className="text-white font-bold text-2xl">E</span>
                  </div>
                  <div className="absolute inset-0 bg-green-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                </div>
                <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
              </Link>
            </div>

            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-sm font-semibold text-green-700 dark:text-green-400">
                <Sparkles className="w-4 h-4" />
                Join 50,000+ workers across East Africa
              </div>
            </div>

            {/* Headline */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-serif sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
                Get Started with{' '}
                <span className="bg-linear-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  EaziWage
                </span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400">
                Access your earned wages instantly. No loans, no interest.
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            {/* Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-5">

                {/* Account Type Toggle */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">I am an</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['employee', 'employer'] as AccountType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setAccountType(type); if (type === 'employer') setNoCompanyFound(false); }}
                        className={`py-3 px-4 rounded-lg text-sm font-semibold transition-all capitalize ${
                          accountType === type
                            ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Full Name</label>
                  <div className="relative">
                    <Input type="text" placeholder="e.g. Jane Doe"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    {accountType === 'employer' ? 'Business Email' : 'Work Email'}
                  </label>
                  <div className="relative">
                    <Input type="email" placeholder={accountType === 'employer' ? 'ceo@company.com' : 'name@company.com'}
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {/* Mobile */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    {accountType === 'employer' ? 'Business Mobile Number' : 'Mobile Number'}
                  </label>
                  <div className="flex gap-2">
                    <DialCodeSelector selected={dialCode} onSelect={setDialCode} size="md" />
                    <div className="relative flex-1">
                      <Input type="tel" placeholder="700 000 000"
                        className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                        value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} onKeyDown={handleKeyDown}
                      />
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs ml-1">Enter your number without the country code</p>
                </div>

                {/* Company */}
                {accountType === 'employee' ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Company</label>
                    {selectedCompany ? (
                      <div className="relative">
                        <div className="h-14 pl-4 pr-12 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 flex items-center">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white text-sm">{selectedCompany.company_name}</p>
                              <p className="text-xs text-slate-500">{selectedCompany.company_code}</p>
                            </div>
                          </div>
                          <button type="button" onClick={handleClearCompany}
                            className="absolute right-3 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    ) : noCompanyFound ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Company not on EaziWage yet</p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Provide your employer's details and we'll reach out to onboard them.</p>
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <Input type="text" placeholder="Employer / Company Name"
                            className="h-12 pl-4 pr-10 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                            value={referralName} onChange={(e) => setReferralName(e.target.value)} />
                          <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                        <div className="relative">
                          <Input type="email" placeholder="HR / Contact Email"
                            className="h-12 pl-4 pr-10 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                            value={referralEmail} onChange={(e) => setReferralEmail(e.target.value)} />
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-slate-600 dark:text-slate-400 text-xs font-medium ml-1">HR / Contact Phone</label>
                          <div className="flex gap-2">
                            <DialCodeSelector selected={referralDialCode} onSelect={setReferralDialCode} size="sm" />
                            <div className="relative flex-1">
                              <Input type="tel" placeholder="700 000 000"
                                className="h-12 pl-3 pr-10 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                                value={referralPhone} onChange={(e) => setReferralPhone(e.target.value)} />
                              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={() => { setNoCompanyFound(false); setShowCompanySearch(true); }}
                          className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
                          ← Search for company again
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => setShowCompanySearch(true)}
                          className="h-14 px-4 rounded-xl bg-white dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600 hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all flex items-center gap-3 text-left">
                          <Search className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <span className="text-slate-500 dark:text-slate-400">Find your company…</span>
                        </button>
                        <p className="text-slate-400 text-xs ml-1">Search and select your employer from our registered companies.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Company Name</label>
                    <div className="relative">
                      <Input type="text" placeholder="e.g. Acme Corporation"
                        className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                        value={companyName} onChange={(e) => setCompanyName(e.target.value)} onKeyDown={handleKeyDown}
                      />
                      <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Password</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'}
                      placeholder="Create a secure password (min. 8 characters)"
                      className="h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <button type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-green-600 transition-colors"
                      onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 py-1">
                  <div className="relative flex items-center mt-0.5">
                    <input type="checkbox" id="terms" checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 checked:border-green-600 checked:bg-green-600 transition-all hover:border-green-600"
                    />
                    <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                  </div>
                  <label htmlFor="terms" className="text-sm text-slate-500 dark:text-slate-400 leading-snug cursor-pointer select-none">
                    I agree to the{' '}
                    <Link href="https://eaziwage.com/terms.pdf" target="_blank" className="text-green-600 dark:text-green-400 hover:underline font-medium">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="hhtps://eaziwage.com/data.pdf" target="_blank" className="text-green-600 dark:text-green-400 hover:underline font-medium">Privacy Policy</Link>.
                  </label>
                </div>

                {/* Submit */}
                <Button type="button" onClick={handleSubmit} disabled={isLoading || !recaptchaReady}
                  className="w-full h-14 mt-2 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Account…
                    </span>
                  ) : !recaptchaReady ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading security check…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {accountType === 'employee' ? 'Create Employee Account' : 'Create Employer Account'}
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-slate-900 text-slate-400">or sign up with</span>
                  </div>
                </div>

                {/* Google */}
                <button type="button" onClick={() => router.push('/api/auth/google')}
                  className="flex items-center justify-center gap-2 h-12 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all text-sm font-medium text-slate-700 dark:text-slate-300 w-full">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                {/* Security note */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">Bank-grade 256-bit encryption · Protected by reCAPTCHA</span>
                </div>

              </div>
            </div>

            {/* Sign-in CTA */}
            <div className="mt-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link href="/" className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}