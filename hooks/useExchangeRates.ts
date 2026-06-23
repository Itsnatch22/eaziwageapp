import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd');

    if (!error && data) {
      const rateMap: Record<string, number> = {};
      data.forEach((r) => {
        rateMap[r.currency_code] = Number(r.rate_to_usd);
      });
      setRates(rateMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRates();

    const supabase = createClient();
    const channel = supabase
      .channel('exchange_rates_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exchange_rates' },
        () => { fetchRates(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRates]);

  return { rates, loading };
}
