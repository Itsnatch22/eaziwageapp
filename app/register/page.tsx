'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, Eye, EyeOff, Lock, Check, User, Mail,
  Building2, Search, X, Phone, AlertTriangle, ChevronDown,
  Sparkles, AlertCircle, Wallet, Quote
} from 'lucide-react';

const testimonials = [
  {
    quote: "Building this one was a process, but am glad we finally got to establish it. Eaziwage is here to change our perspectives on how payroll systems work. Trust is the new currency and advance payment is how it's earned.",
    name: "Mark K.",
    title: "Co-Founder & Lead Dev",
  },
  {
    quote: "We are building more than just a payment platform we are creating a bridge of trust. One that supports growth, accelerates timelines, reduces cancellations, and brings professionalism to every transaction.",
    name: "Joel O",
    title: "Co-Founder & Backend Dev",
  },
  {
    quote: "At EaziWage, we're not just streamlining payments we're empowering connections, fostering trust, and driving success by making every transaction seamless, engaging, and impactful.",
    name: "Henry K.",
    title: "Co-Founder & CMO",
  },
  {
    quote: "As a business owner, I witnessed the stress financial delays can bring to good people. We built EaziWage to create a bridge between effort and reward so that paydays reflect the rhythm of real life, not the limits of outdated systems.",
    name: "Jason C.",
    title: "Co-Founder & CEO",
  },
];

function TestimonialsPanel() {
  const [active, setActive] = useState(0);
  const [stats, setStats] = useState({
    employeesServed: '10K+',
    satisfactionRate: '98%',
    interestRate: '0%'
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);


    fetch('/api/public/stats')
      .then(res => res.json())
      .then(data => {
        setStats({
          employeesServed: data.employeesServed,
          satisfactionRate: data.satisfactionRate,
          interestRate: data.interestRate
        });
      })
      .catch(err => console.error('Failed to fetch stats:', err));

    return () => clearInterval(timer);
  }, []);

  const t = testimonials[active];

  return (
    <div className="hidden lg:flex flex-col justify-between h-full min-h-screen bg-linear-to-br from-green-700 via-green-600 to-emerald-500 p-12 relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-green-800/20 rounded-full blur-[150px] pointer-events-none" />

      
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
          <Wallet className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <span className="font-bold text-xl text-white tracking-tight">EaziWage</span>
      </div>

      
      <div className="relative z-10 flex flex-col gap-8">
        <div>
          <h2 className="text-4xl font-serif font-bold text-white leading-snug mb-3">
            Payroll that works<br />at the speed of life.
          </h2>
          <p className="text-green-100 text-base leading-relaxed max-w-sm">
            Join thousands of employers and employees who trust EaziWage for seamless, instant wage access.
          </p>
        </div>

        
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl transition-all duration-500">
          <Quote className="w-8 h-8 text-green-200 mb-4 opacity-80" />
          <p className="text-white text-base leading-relaxed mb-6 min-h-20">
            {t.quote}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-sm">
              {t.name.charAt(0)}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{t.name}</p>
              <p className="text-green-200 text-xs">{t.title}</p>
            </div>
          </div>
        </div>

        
        <div className="flex items-center gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>

      
      <div className="relative z-10 grid grid-cols-3 gap-4">
        {[
          { value: stats.employeesServed, label: 'Active Users' },
          { value: stats.satisfactionRate, label: 'Satisfaction Rate' },
          { value: stats.interestRate, label: 'Interest Rate' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-white font-bold text-xl">{stat.value}</p>
            <p className="text-green-200 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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
      render: (container: string | HTMLElement, parameters: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}


const DIALING_CODES: DialCode[] = [
  { code: 'KE', name: 'Kenya',    dialCode: '+254', flag: '/flag/KE.png' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '/flag/TZ.png' },
  { code: 'UG', name: 'Uganda',   dialCode: '+256', flag: '/flag/UG.png' },
  { code: 'RW', name: 'Rwanda',   dialCode: '+250', flag: '/flag/RW.png' },
];

function getFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';


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

  const height   = size === 'md' ? 'h-12'       : 'h-10';
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
        <span className={flagSize}>{getFlagEmoji(selected.code)}</span>
        <span className={`text-slate-900 dark:text-white font-medium ${textSize}`}>{selected.dialCode}</span>
        <ChevronDown className={`${chevron} text-slate-400 ml-auto`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] w-max bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {DIALING_CODES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => { onSelect(country); setOpen(false); }}
              className={`w-full px-3 py-2.5 flex items-center gap-3 whitespace-nowrap hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left ${
                selected.code === country.code ? 'bg-green-50 dark:bg-green-900/20' : ''
              }`}
            >
              <span className={flagSize} aria-label={country.name}>{getFlagEmoji(country.code)}</span>
              <span className={`text-slate-900 dark:text-white ${textSize}`}>{country.name}</span>
              <span className={`text-slate-500 ${textSize} ml-auto pl-3`}>{country.dialCode}</span>
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
            <button aria-label="Close" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
            My company isn&apos;t listed — Continue without code
          </button>
        </div>
      </div>
    </div>
  );
}


function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [accountType,   setAccountType]   = useState<AccountType>('employee');
  const [fullName,      setFullName]       = useState('');
  const [email,         setEmail]          = useState(searchParams.get('email') ?? '');
  const [mobileNumber,  setMobileNumber]   = useState('');
  const [dialCode,      setDialCode]       = useState<DialCode>(DIALING_CODES[0]);
  const [companyCode,   setCompanyCode]    = useState('');
  const [companyName,   setCompanyName]    = useState('');
  const [password,      setPassword]       = useState('');
  const [showPassword,  setShowPassword]   = useState(false);
  const [agreedToTerms, setAgreedToTerms]  = useState(false);

  const [selectedCompany,   setSelectedCompany]   = useState<Company | null>(null);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [noCompanyFound,    setNoCompanyFound]    = useState(false);
  const [employers,         setEmployers]          = useState<Company[]>([]);

  const [referralName,     setReferralName]     = useState('');
  const [referralEmail,    setReferralEmail]    = useState('');
  const [referralPhone,    setReferralPhone]    = useState('');
  const [referralDialCode, setReferralDialCode] = useState<DialCode>(DIALING_CODES[0]);

  const [error,              setError]              = useState('');
  const [isLoading,          setIsLoading]          = useState(false);
  const [recaptchaReady,     setRecaptchaReady]     = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsLoading(true);
    const supabase = createClient();
    const callbackUrl = new URL('/api/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('role', accountType);
    callbackUrl.searchParams.set('source', 'register');
    callbackUrl.searchParams.set(
      'next',
      accountType === 'employer'
        ? '/dashboards/employer-dashboard'
        : '/dashboards/employee-dashboard'
    );

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchEmployers = async () => {
      try {
        const res = await fetch('/api/employers/public/approved');
        if (res.ok) {
          const data: Company[] = await res.json();
          setEmployers(data ?? []);
        }
      } catch {

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
        setError("Please provide your employer&apos;s contact details so we can onboard them");
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

      const destination =
        data.role === 'employer'
          ? '/dashboards/employer-dashboard'
          : '/dashboards/employee-dashboard';
      router.replace(destination);
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
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
        onReady={() => setRecaptchaReady(true)}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden lg:flex">

        
        <div className="lg:w-[45%] lg:shrink-0">
          <TestimonialsPanel />
        </div>

        
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] pointer-events-none" />

          {showCompanySearch && (
            <CompanySearchModal
              employers={employers}
              onSelect={handleSelectCompany}
              onNotFound={handleCompanyNotFound}
              onClose={() => setShowCompanySearch(false)}
            />
          )}

          <main className="relative z-10 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-6">
            <div className="w-full max-w-md">


            <div className="flex justify-center mb-3">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-10 h-10 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                      <Wallet
                        className="h-6 w-6 text-emerald-700"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                  </div>
                  <div className="absolute inset-0 bg-green-600/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 -z-10" />
                </div>
                <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">EaziWage</span>
              </Link>
            </div>

            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-xs font-semibold text-green-700 dark:text-green-400">
                <Sparkles className="w-3.5 h-3.5" />
                Join The First Wave
              </div>
            </div>

            <div className="text-center mb-5">
              <h1 className="text-2xl font-serif sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight mb-1.5 tracking-tight">
                Get Started with{' '}
                <span className="bg-linear-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  EaziWage
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Access your earned wages instantly. No loans, no interest.
              </p>
            </div>

            {error && (
              <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-3xl p-5 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-3">

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">I am an</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['employee', 'employer'] as AccountType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setAccountType(type); if (type === 'employer') setNoCompanyFound(false); }}
                        className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all capitalize ${
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Full Name</label>
                  <div className="relative">
                    <Input type="text" placeholder="Your name as it appears on your ID card"
                      className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    {accountType === 'employer' ? 'Business Email' : 'Work Email'}
                  </label>
                  <div className="relative">
                    <Input type="email" placeholder={accountType === 'employer' ? 'ceo@company.com' : 'name@company.com'}
                      className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">
                    {accountType === 'employer' ? 'Business Mobile Number' : 'Mobile Number'}
                  </label>
                  <div className="flex gap-2">
                    <DialCodeSelector selected={dialCode} onSelect={setDialCode} size="md" />
                    <div className="relative flex-1">
                      <Input type="tel" placeholder="700 000 000"
                        className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                        value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} onKeyDown={handleKeyDown}
                      />
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs ml-1">Enter your number without the country code</p>
                </div>

                {accountType === 'employee' ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Company</label>
                    {selectedCompany ? (
                      <div className="relative">
                        <div className="h-12 pl-4 pr-12 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 flex items-center">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white text-sm">{selectedCompany.company_name}</p>
                              <p className="text-xs text-slate-500">{selectedCompany.company_code}</p>
                            </div>
                          </div>
                          <button aria-label="Clear Company" type="button" onClick={handleClearCompany}
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
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Provide your employer&apos;s details and we&apos;ll reach out to onboard them.</p>
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
                          className="h-12 px-4 rounded-xl bg-white dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600 hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all flex items-center gap-3 text-left">
                          <Search className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <span className="text-slate-500 dark:text-slate-400">Find your company…</span>
                        </button>
                        <p className="text-slate-400 text-xs ml-1">Search and select your employer from our registered companies.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Company Name</label>
                    <div className="relative">
                      <Input type="text" placeholder="Company name as it appears on official documents"
                        className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                        value={companyName} onChange={(e) => setCompanyName(e.target.value)} onKeyDown={handleKeyDown}
                      />
                      <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-medium ml-1">Password</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'}
                      placeholder="Create a secure password (min. 8 characters)"
                      className="h-12 pl-4 pr-12 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                      value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                    />
                    <button type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-green-600 transition-colors"
                      onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

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
                    <Link href="https://eaziwage.com/data.pdf" target="_blank" className="text-green-600 dark:text-green-400 hover:underline font-medium">Privacy Policy</Link>.
                  </label>
                </div>

                
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !recaptchaReady}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                    "w-full h-12 mt-1 rounded-2xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
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
                </button>

                
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                      Or
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                      "h-10 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300"
                    )}
                    onClick={() => handleSocialLogin('google')}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
                      "h-10 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-300"
                    )}
                    onClick={() => handleSocialLogin('apple')}
                  >
                    <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 384 512">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 33-17.9 63.4-17.9 31.8 0 39.6 17.9 65.4 17.9 48.6-.1 90.7-82.5 103-119.5-31.9-14.5-54.6-43.9-54.7-91.7zM224.2 81.1c16-19.8 26.8-47.3 23.8-74.7-23.4 1-51.5 15.6-68.3 35.4-15 17.5-28.2 45.4-24.8 71.9 26.2 2 53.2-12.8 69.3-32.6z"/>
                    </svg>
                    Apple
                  </button>
                </div>


                <div className="flex items-center justify-center gap-1.5">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">Bank-grade 256-bit encryption · Protected by reCAPTCHA</span>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link href="/" className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}


export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}