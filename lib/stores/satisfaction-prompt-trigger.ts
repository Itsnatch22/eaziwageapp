'use client';

import { useEffect } from 'react';

export type SatisfactionMoment =
  | 'employee_third_withdrawal'
  | 'employee_kyc_verified_3d'
  | 'employer_first_bulk_sync'
  | 'employer_topup_completed';

interface TriggerRequest {
  moment: SatisfactionMoment;
  advanceId?: string;
}

type Listener = (req: TriggerRequest) => void;

const listeners = new Set<Listener>();

// Trigger-point pages (children of the dashboard layouts) and the
// layout-mounted SatisfactionPromptMount are in different subtrees relative
// to each other's mount point — Context would require restructuring how
// each layout wraps {children}. Mirrors the module-level singleton +
// listener-Set idiom already established in lib/stores/auth.ts for exactly
// this kind of cross-tree signal.
export function notifyEligibleMoment(moment: SatisfactionMoment, opts?: { advanceId?: string }) {
  listeners.forEach((listener) => listener({ moment, advanceId: opts?.advanceId }));
}

export function useSatisfactionPromptRequests(onRequest: Listener) {
  useEffect(() => {
    listeners.add(onRequest);
    return () => {
      listeners.delete(onRequest);
    };
  }, [onRequest]);
}
