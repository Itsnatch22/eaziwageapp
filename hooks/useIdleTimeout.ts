'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls onIdle after `timeoutMs` of no mouse/keyboard/scroll activity.
 * Used by /console to enforce a shorter session timeout than the rest of the
 * app, given the aggregate financial visibility it has.
 */
export function useIdleTimeout(timeoutMs: number, onIdle: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);
}
