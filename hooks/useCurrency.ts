import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrencyFromCountry } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth';

export function useCurrency() {
  const user = useAuthStore((state) => state.user);
  const [currency, setCurrency] = useState('KES');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrency() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('phone_country_code')
          .eq('id', user.id)
          .single();

        if (error) {
          // console.error('Error fetching currency:', error);
        } else if (data?.phone_country_code) {
          setCurrency(getCurrencyFromCountry(data.phone_country_code));
        }
      } catch (err) {
        // console.error('useCurrency error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCurrency();
  }, [user?.id]);

  return { currency, loading };
}
