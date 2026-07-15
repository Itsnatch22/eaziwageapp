'use client';

import React, { useEffect, useState } from 'react';
import { Star, X, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth';
import { useSatisfactionPrompt } from '@/hooks/useSatisfactionPrompt';

const THANKS_AUTO_CLOSE_MS = 2500;

interface StarRatingStepProps {
  onSelect: (rating: number) => void;
  submitting: boolean;
}

function StarRatingStep({ onSelect, submitting }: StarRatingStepProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="p-6 pt-8 text-center">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">
        How&apos;s EaziWage working for you?
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Your feedback helps us improve.
      </p>
      <div
        className="flex items-center justify-center gap-1.5"
        role="radiogroup"
        aria-label="Rate your experience"
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = hovered !== null && value <= hovered;
          return (
            <button
              key={value}
              type="button"
              disabled={submitting}
              onClick={() => onSelect(value)}
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              className="p-1 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Star
                className={cn(
                  'w-8 h-8 transition-colors',
                  filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600',
                )}
              />
            </button>
          );
        })}
      </div>
      {submitting && (
        <div className="flex justify-center mt-4">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        </div>
      )}
    </div>
  );
}

interface CommentStepProps {
  comment: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  submitting: boolean;
}

function CommentStep({ comment, onChange, onSubmit, onSkip, submitting }: CommentStepProps) {
  return (
    <div className="p-6 pt-8">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">What went wrong?</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">We&apos;d love to fix it.</p>
      <textarea
        value={comment}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tell us what happened…"
        rows={3}
        maxLength={2000}
        autoFocus
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
      />
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !comment.trim()}
          className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function ThanksStep({ rating }: { rating: number | null }) {
  const positive = (rating ?? 0) >= 4;

  return (
    <div className="p-6 py-10 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
      </div>
      <p className="font-semibold text-slate-900 dark:text-white mb-1">
        {positive ? 'Thanks for the kind words!' : "Thanks — we'll look into this."}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {positive
          ? "We're glad EaziWage is working well for you."
          : 'Your feedback helps us make EaziWage better.'}
      </p>
    </div>
  );
}

// Layout-mounted (not route-mounted), so it persists across in-dashboard
// navigation without unmounting — same pattern as PaydayRecoupmentModal.
// Self-contained: reads its own userId, no props. Renders identically for
// employer and employee dashboards; the only difference between them is
// which trigger points call notifyEligibleMoment() and when.
export function SatisfactionPromptMount() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const {
    visible,
    step,
    rating,
    comment,
    submitting,
    setComment,
    selectRating,
    submitComment,
    skipComment,
    dismiss,
    close,
  } = useSatisfactionPrompt(userId);

  useEffect(() => {
    if (!visible || step !== 'thanks') return;
    const timer = setTimeout(close, THANKS_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [visible, step, close]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void dismiss('passive');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <>
      {/* Mobile-only tap-to-dismiss backdrop; the desktop corner card is
          non-blocking, so no backdrop there. */}
      <div
        className="fixed inset-0 z-[69] bg-black/30 sm:hidden"
        onClick={() => void dismiss('passive')}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Satisfaction survey"
        className={cn(
          'fixed z-[70] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden',
          'inset-x-0 bottom-0 rounded-t-3xl',
          'sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 sm:rounded-3xl',
        )}
      >
        {step !== 'thanks' && (
          <button
            type="button"
            onClick={() => void dismiss('hard')}
            aria-label="Not now"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {step === 'rating' && <StarRatingStep onSelect={selectRating} submitting={submitting} />}
        {step === 'comment' && (
          <CommentStep
            comment={comment}
            onChange={setComment}
            onSubmit={submitComment}
            onSkip={skipComment}
            submitting={submitting}
          />
        )}
        {step === 'thanks' && <ThanksStep rating={rating} />}
      </div>
    </>
  );
}
