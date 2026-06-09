'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, Users, Building2, CreditCard, 
  ArrowRight, Command, X, Loader2, Sparkles,
  Settings, Shield, FileCheck, DollarSign, Activity,
  Bell, GitBranch, FileText, AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Navigation items for admin dashboard
const adminNavItems = [
  { id: 'dashboard', title: 'Dashboard', href: '/admin', icon: BarChart3 },
  { id: 'advances', title: 'Advances', href: '/admin/advances', icon: CreditCard },
  { id: 'employees', title: 'Employees', href: '/admin/employees', icon: Users },
  { id: 'employers', title: 'Employers', href: '/admin/employers', icon: Building2 },
  { id: 'billing', title: 'Billing', href: '/admin/billing', icon: DollarSign },
  { id: 'fraud-detection', title: 'Fraud Detection', href: '/admin/fraud-detection', icon: Shield },
  { id: 'kyc-review', title: 'KYC Review', href: '/admin/kyc-review', icon: FileCheck },
  { id: 'reconciliation', title: 'Reconciliation', href: '/admin/reconciliation', icon: GitBranch },
  { id: 'review-requests', title: 'Review Requests', href: '/admin/review-requests', icon: FileText },
  { id: 'risk-scoring', title: 'Risk Scoring', href: '/admin/risk-scoring', icon: AlertTriangle },
  { id: 'settings', title: 'Settings', href: '/admin/settings', icon: Settings },
  { id: 'notifications', title: 'Notifications', href: '/admin/notifications', icon: Bell },
  { id: 'api-health', title: 'API Health', href: '/admin/api-health', icon: Activity },
  { id: 'docs', title: 'Documentation', href: '/admin/docs', icon: FileText }
];

interface SearchResult {
  type: 'employer' | 'employee' | 'advance' | 'navigation';
  id: string;
  title: string;
  href: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setApiResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const matchedNavItems = useMemo<SearchResult[]>(() => {
    const normalizedQuery = debouncedQuery.toLowerCase();
    return adminNavItems
      .filter(item => item.title.toLowerCase().includes(normalizedQuery))
      .map(item => ({
        type: 'navigation' as const,
        id: item.id,
        title: item.title,
        href: item.href,
      }));
  }, [debouncedQuery]);

  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      return matchedNavItems;
    }
    return [...matchedNavItems, ...apiResults];
  }, [debouncedQuery, matchedNavItems, apiResults]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/admin/search?q=${encodeURIComponent(debouncedQuery)}`);
          if (cancelled) return;

          if (res.ok) {
            const data = await res.json();
            setApiResults(data.results || []);
          } else {
            setApiResults([]);
          }
          setSelectedIndex(0);
        } catch (err) {
          console.error('Search error:', err);
          if (!cancelled) setApiResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [debouncedQuery]);

  const handleSelect = useCallback((result: SearchResult) => {
    setIsOpen(false);
    router.push(result.href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (results.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (results.length || 1)) % (results.length || 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employer': return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'employee': return <Users className="w-4 h-4 text-green-500" />;
      case 'advance':  return <CreditCard className="w-4 h-4 text-purple-500" />;
      case 'navigation': return <ArrowRight className="w-4 h-4 text-orange-500" />;
      default:         return <ArrowRight className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 mr-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search for anything in the admin dashboard..."
                className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-lg"
              />
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-100 overflow-y-auto p-2 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  <p className="text-xs font-medium text-slate-500">Searching across platform...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left",
                        index === selectedIndex 
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          index === selectedIndex ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                        )}>
                          {getTypeIcon(result.type)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{result.title}</p>
                          <p className={cn(
                            "text-[10px] uppercase font-bold tracking-wider",
                            index === selectedIndex ? "text-white/70" : "text-slate-400"
                          )}>
                            {result.type}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={cn("w-4 h-4", index === selectedIndex ? "opacity-100" : "opacity-0")} />
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 ? (
                <div className="py-12 text-center">
                  <X className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No results found for &quot;{query}&quot;</p>
                </div>
              ) : (
                <div className="py-8 px-4 text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Quick Platform Search</p>
                  <p className="text-xs text-slate-500 mt-1">Start typing to find anything on EaziWage</p>
                  
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {adminNavItems.slice(0, 6).map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                          <Icon className="w-3 h-3" />
                          {item.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">Enter</kbd>
                  Select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">Esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
