import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRates() {
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
    }
    fetchRates();
  }, []);

  return { rates, loading };
}
