"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, ChevronLeft, X, Sparkles, 
  CheckCircle2, Info, Lightbulb 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface OnboardingGuideProps {
  steps: Step[];
  guideKey: string; // e.g. 'admin-overview', 'employee-home'
}

export function OnboardingGuide({ steps, guideKey }: OnboardingGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem(`guide_${guideKey}`);
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 1500); // Wait for page load
      return () => clearTimeout(timer);
    }
  }, [guideKey]);

  const handleClose = (complete = false) => {
    setIsOpen(false);
    if (complete) {
      localStorage.setItem(`guide_${guideKey}`, 'true');
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex gap-1 p-1">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex-1 h-full rounded-full transition-all duration-500",
                  idx <= currentStep ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-800"
                )}
              />
            ))}
          </div>

          <button 
            onClick={() => handleClose(false)}
            className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 md:p-12">
            <div className="flex flex-col items-center text-center">
              <motion.div 
                key={currentStep}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mb-8"
              >
                {steps[currentStep].icon}
              </motion.div>

              <motion.div
                key={`content-${currentStep}`}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="space-y-4"
              >
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {steps[currentStep].title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </motion.div>
            </div>

            <div className="mt-12 flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={handleBack}
                disabled={currentStep === 0}
                className="rounded-xl h-12 px-6 font-bold uppercase tracking-widest text-[10px]"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>

              <div className="flex items-center gap-3">
                {currentStep < steps.length - 1 ? (
                  <Button 
                    variant="ghost"
                    onClick={() => handleClose(true)}
                    className="rounded-xl h-12 px-6 font-bold uppercase tracking-widest text-[10px] text-slate-400"
                  >
                    Skip
                  </Button>
                ) : null}
                
                <Button 
                  onClick={handleNext}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
                >
                  {currentStep === steps.length - 1 ? 'Got it!' : 'Next'} <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
