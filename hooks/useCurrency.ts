import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_ADMIN_CURRENCY, getCurrencySymbol } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth';

type Role = 'super_admin' | 'employer_admin' | 'employee';

interface CurrencySnapshot {
  currency: string;
  symbol: string;
  loading: boolean;
}

// Module-level singleton — one fetch per user per browser session.
// Currency preference is stable for the session (tied to the onboarding record);
// no realtime subscription is needed.
const supabase = createClient();

let cachedUserId: string | null = null;
let snapshot: CurrencySnapshot = { currency: 'KES', symbol: getCurrencySymbol('KES'), loading: true };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

async function load(userId: string, role: Role | undefined): Promise<void> {
  let next: CurrencySnapshot;

  if (role === 'super_admin') {
    const c = DEFAULT_ADMIN_CURRENCY;
    next = { currency: c, symbol: getCurrencySymbol(c), loading: false };
  } else {
    const table = role === 'employer_admin' ? 'employer_onboarding'
                : role === 'employee'       ? 'employee_onboarding'
                : null;

    if (!table) {
      next = { currency: 'KES', symbol: getCurrencySymbol('KES'), loading: false };
    } else {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('currency')
          .eq('user_id', userId)
          .single();
        const c = (!error && data?.currency) ? data.currency : 'KES';
        next = { currency: c, symbol: getCurrencySymbol(c), loading: false };
      } catch {
        next = { currency: 'KES', symbol: getCurrencySymbol('KES'), loading: false };
      }
    }
  }

  // Discard stale results if a different user logged in while this fetch was in-flight.
  if (cachedUserId !== userId) return;
  snapshot = next;
  broadcast();
}

function ensureLoaded(userId: string, role: Role | undefined): void {
  if (cachedUserId === userId && !snapshot.loading) return; // cache hit

  if (cachedUserId !== userId) {
    // User changed — reset cache. The stale-result guard in load() handles any in-flight fetch.
    cachedUserId = userId;
    snapshot = { currency: 'KES', symbol: getCurrencySymbol('KES'), loading: true };
    inflight = null;
  }

  if (!inflight) {
    inflight = load(userId, role).finally(() => { inflight = null; });
  }
}

export function useCurrency() {
  const user = useAuthStore((s) => s.user);

  // Lazy initializer: if this user's data is already cached, skip the loading flash entirely.
  const [snap, setSnap] = useState<CurrencySnapshot>(() =>
    user?.id && cachedUserId === user.id
      ? snapshot
      : { currency: 'KES', symbol: getCurrencySymbol('KES'), loading: !!user?.id }
  );

  useEffect(() => {
    const sync = () => setSnap({ ...snapshot });
    listeners.add(sync);

    if (user?.id) {
      ensureLoaded(user.id, user.role);
      sync(); // Apply immediately — may already be fully cached from a prior mount.
    }

    return () => { listeners.delete(sync); };
  }, [user?.id, user?.role]);

  return { currency: snap.currency, loading: snap.loading, symbol: snap.symbol };
}
