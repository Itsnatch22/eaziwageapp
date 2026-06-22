"use client"

import React, { useState } from 'react';
import { X, AlertTriangle, Briefcase, Shield, DollarSign, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteAccount: (reason: string, category: string, additionalFeedback?: string) => void;
  loading?: boolean;
}

const deletionReasons = [
  {
    category: 'service_dissatisfaction',
    title: 'Service Issues',
    description: 'Problems with the service experience',
    icon: AlertTriangle,
    reasons: [
      'Service is too slow',
      'Difficult to use interface',
      'Poor customer support',
      'Features not working properly',
      'Other service issues'
    ]
  },
  {
    category: 'financial_issues',
    title: 'Financial Concerns',
    description: 'Issues related to fees, limits, or payments',
    icon: DollarSign,
    reasons: [
      'Fees are too high',
      'Withdrawal limits too low',
      'Payment processing delays',
      'Better offers elsewhere',
      'Other financial concerns'
    ]
  },
  {
    category: 'employment_change',
    title: 'Employment Changes',
    description: 'Changes in job or employment status',
    icon: Briefcase,
    reasons: [
      'Changed jobs',
      'Lost employment',
      'Employer no longer uses EaziWage',
      'Retirement',
      'Other employment changes'
    ]
  },
  {
    category: 'privacy_concerns',
    title: 'Privacy & Security',
    description: 'Concerns about data privacy or security',
    icon: Shield,
    reasons: [
      'Privacy concerns',
      'Security worries',
      'Data sharing concerns',
      'No longer trust the service',
      'Other privacy/security issues'
    ]
  },
  {
    category: 'other',
    title: 'Other Reasons',
    description: 'Any other reason for leaving',
    icon: MessageSquare,
    reasons: [
      'No longer need the service',
      'Taking a break',
      'Personal reasons',
      'Moving to another country',
      'Other'
    ]
  }
];

export function DeleteAccountModal({ isOpen, onClose, onDeleteAccount, loading }: DeleteAccountModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalFeedback, setAdditionalFeedback] = useState<string>('');

  const handleSubmit = () => {
    if (!selectedCategory || !selectedReason) return;
    
    onDeleteAccount(selectedReason, selectedCategory, additionalFeedback);
  };

  const handleClose = () => {
    if (loading) return;
    setSelectedCategory('');
    setSelectedReason('');
    setAdditionalFeedback('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedCategoryData = deletionReasons.find(cat => cat.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative">
          <button
            onClick={handleClose}
            disabled={loading}
            className="absolute right-4 top-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-600">Delete Account</CardTitle>
              <CardDescription>
                We&apos;re sorry to see you go. Please help us understand why you&apos;re leaving.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  This action cannot be undone
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Deleting your account will permanently remove all your data, including transaction history and personal information.
                </p>
              </div>
            </div>
          </div>

          
          {!selectedCategory ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">What category best describes your reason?</h3>
              <div className="grid gap-3">
                {deletionReasons.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.category}
                      onClick={() => setSelectedCategory(category.category)}
                      className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 dark:text-white">{category.title}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{category.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedCategory('')}
                  disabled={loading}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  {selectedCategoryData && <selectedCategoryData.icon className="w-5 h-5 text-primary" />}
                  <h3 className="font-semibold text-slate-900 dark:text-white">{selectedCategoryData?.title}</h3>
                </div>
              </div>

              
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900 dark:text-white">Please select a specific reason:</h4>
                <div className="grid gap-2">
                  {selectedCategoryData?.reasons.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={cn(
                        "p-3 text-left rounded-lg border transition-colors",
                        selectedReason === reason
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                      )}
                    >
                      <span className="text-sm">{reason}</span>
                    </button>
                  ))}
                </div>
              </div>

              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900 dark:text-white">
                  Additional feedback (optional)
                </label>
                <Textarea
                  placeholder="Tell us more about your experience..."
                  value={additionalFeedback}
                  onChange={(e) => setAdditionalFeedback(e.target.value)}
                  disabled={loading}
                  className="min-h-[100px]"
                />
              </div>

              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedReason || loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? 'Deleting...' : 'Delete Account'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
