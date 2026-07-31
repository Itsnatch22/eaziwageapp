import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Module-level singleton — one client, one channel, one fetch shared across all consumers.
const supabase = createClient();

const DEFAULT_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  KES: 129.5,
  UGX: 3700,
  TZS: 2650,
  RWF: 1350,
  GHS: 15.5,
  NGN: 1500,
  ZAR: 18.5,
  EUR: 0.92,
  GBP: 0.78,
};

let cachedRates: Record<string, number> = { ...DEFAULT_FALLBACK_RATES };
let cachedLoading = true;
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

async function loadRates() {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency_code, rate_to_usd');

  if (!error && data && data.length > 0) {
    const map: Record<string, number> = { ...DEFAULT_FALLBACK_RATES };
    data.forEach(r => { map[r.currency_code] = Number(r.rate_to_usd); });
    cachedRates = map;
  } else if (Object.keys(cachedRates).length === 0) {
    cachedRates = { ...DEFAULT_FALLBACK_RATES };
  }
  cachedLoading = false;
  broadcast();
}

let subscribed = false;
function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  supabase
    .channel('exchange_rates_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exchange_rates' }, () => { void loadRates(); })
    .subscribe();
  void loadRates();
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>(cachedRates);
  const [loading, setLoading] = useState(cachedLoading);

  useEffect(() => {
    const sync = () => {
      setRates(cachedRates);
      setLoading(cachedLoading);
    };
    listeners.add(sync);
    ensureSubscription();
    sync(); // Catch rates already loaded before this component mounted
    return () => { listeners.delete(sync); };
  }, []);

  return { rates, loading };
}
