'use client';

import { useCallback, useRef, useState } from 'react';
import { StepUpPrompt } from '@/components/security/StepUpPrompt';

export function useStepUpPrompt(apiBase: string) {
  const [open, setOpen] = useState(false);
  const retryAction = useRef<(() => Promise<void>) | null>(null);

  const requireStepUp = useCallback((retry: () => Promise<void>) => {
    retryAction.current = retry;
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    retryAction.current = null;
    setOpen(false);
  }, []);

  const verified = useCallback(async () => {
    const retry = retryAction.current;
    retryAction.current = null;
    setOpen(false);
    await retry?.();
  }, []);

  const prompt = open
    ? <StepUpPrompt apiBase={apiBase} onCancel={cancel} onVerified={verified} />
    : null;

  return { requireStepUp, stepUpPrompt: prompt };
}
