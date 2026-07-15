'use client';

import { useCallback, useRef, useState } from 'react';
import { sessionFetch } from '@/lib/client/session-fetch';
import {
  useSatisfactionPromptRequests,
  type SatisfactionMoment,
} from '@/lib/stores/satisfaction-prompt-trigger';

export type SatisfactionPromptStep = 'rating' | 'comment' | 'thanks';

// Trigger points 2 and 3 (KYC-verified, org-approved badges) fire on every
// qualifying render rather than only on an edge, so this avoids hammering
// /api/satisfaction/status. The server-side eligibility check remains the
// real gate — this is purely a network-efficiency nicety.
const STATUS_CHECK_DEBOUNCE_MS = 60_000;

export function useSatisfactionPrompt(userId: string | null) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<SatisfactionPromptStep>('rating');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentMomentRef = useRef<SatisfactionMoment | null>(null);
  const advanceIdRef = useRef<string | undefined>(undefined);
  const feedbackIdRef = useRef<string | null>(null);
  const lastCheckedRef = useRef<Map<SatisfactionMoment, number>>(new Map());

  const handleRequest = useCallback(
    async ({ moment, advanceId }: { moment: SatisfactionMoment; advanceId?: string }) => {
      if (!userId || visible) return;

      const now = Date.now();
      const last = lastCheckedRef.current.get(moment);
      if (last && now - last < STATUS_CHECK_DEBOUNCE_MS) return;
      lastCheckedRef.current.set(moment, now);

      try {
        const statusRes = await sessionFetch('/api/satisfaction/status');
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (!status.eligible) return;

        await sessionFetch('/api/satisfaction/prompt-shown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moment }),
        });

        currentMomentRef.current = moment;
        advanceIdRef.current = advanceId;
        feedbackIdRef.current = null;
        setRating(null);
        setComment('');
        setStep('rating');
        setVisible(true);
      } catch {
        // Silent — this is a background eligibility check, not a page-critical fetch.
      }
    },
    [userId, visible],
  );

  useSatisfactionPromptRequests(handleRequest);

  const selectRating = useCallback(async (value: number) => {
    const moment = currentMomentRef.current;
    if (!moment) return;

    setRating(value);
    setSubmitting(true);
    try {
      const res = await sessionFetch('/api/satisfaction/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: value,
          advance_id: advanceIdRef.current,
          moment,
        }),
      });
      if (!res.ok) {
        setVisible(false);
        return;
      }
      const data = await res.json();
      feedbackIdRef.current = typeof data.id === 'string' ? data.id : null;
      setStep(value >= 4 ? 'thanks' : 'comment');
    } catch {
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const submitComment = useCallback(async () => {
    const feedbackId = feedbackIdRef.current;
    if (!feedbackId || !comment.trim()) {
      setStep('thanks');
      return;
    }

    setSubmitting(true);
    try {
      await sessionFetch(`/api/satisfaction/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      });
    } catch {
      // Non-fatal — the rating itself is already saved.
    } finally {
      setSubmitting(false);
      setStep('thanks');
    }
  }, [comment]);

  const skipComment = useCallback(() => {
    setStep('thanks');
  }, []);

  const dismiss = useCallback(async (type: 'hard' | 'passive') => {
    const moment = currentMomentRef.current ?? undefined;
    setVisible(false);
    try {
      await sessionFetch('/api/satisfaction/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, moment }),
      });
    } catch {
      // Non-fatal — worst case the cooldown doesn't register for this dismissal.
    }
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return {
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
  };
}
