'use client';

import { toast } from 'sonner';

/**
 * Wraps fetch() for authenticated client-side API calls. A 401 here means the
 * session expired or was revoked between page load and this specific request
 * (e.g. a long-idle tab, a revoked/expired refresh token) — money-critical
 * flows (advance request, wallet top-up, payday recoupment confirm) were
 * previously showing a bare "Unauthorized" toast and leaving the user stuck
 * on the same form with no indication they need to log back in, unable to
 * tell whether their action actually went through. It didn't (every route
 * checks auth before any write), but the UI gave no way to know that.
 *
 * On 401, this redirects to /login with a return path instead of leaving
 * that ambiguity, so the flow the user resumes after re-authenticating is the
 * one they were on, not a generic dashboard.
 */
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401 && typeof window !== 'undefined') {
    toast.error('Your session has expired. Please log in again.');
    // '/' is the actual login page (app/page.tsx) — it reads `next`, not
    // `redirect`, and only honors same-origin paths starting with a single '/'.
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `/?next=${encodeURIComponent(returnTo)}`;
  }

  return res;
}
