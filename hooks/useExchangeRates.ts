import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Module-level singleton — one client, one channel, one fetch shared across all consumers.
const supabase = createClient();

let cachedRates: Record<string, number> = {};
let cachedLoading = true;
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

async function loadRates() {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency_code, rate_to_usd');

  if (!error && data) {
    const map: Record<string, number> = {};
    data.forEach(r => { map[r.currency_code] = Number(r.rate_to_usd); });
    cachedRates = map;
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
