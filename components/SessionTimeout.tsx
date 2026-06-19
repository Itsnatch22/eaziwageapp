"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Tracks user inactivity and navigates to /session-expired after timeout
export default function SessionTimeout() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        // Navigate to session-expired page when user is inactive
        router.push('/session-expired');
      }, TIMEOUT_MS);
    };

    // activity events
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset));

    // start timer
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router, TIMEOUT_MS]);

  return null;
}
