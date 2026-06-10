import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_ADMIN_CURRENCY, getCurrencySymbol } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth';

export function useCurrency() {
  const user = useAuthStore((state) => state.user);
  const [currency, setCurrency] = useState('KES');
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('KSh');

  useEffect(() => {
    async function fetchCurrency() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (user.role === 'super_admin') {
          const c = DEFAULT_ADMIN_CURRENCY;
          setCurrency(c);
          setSymbol(getCurrencySymbol(c));
          setLoading(false);
          return;
        }

        const supabase = createClient();
        let tableName = '';
        if (user.role === 'employer_admin') tableName = 'employer_onboarding';
        else if (user.role === 'employee') tableName = 'employee_onboarding';
        else {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from(tableName)
          .select('currency')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.currency) {
          setCurrency(data.currency);
          setSymbol(getCurrencySymbol(data.currency));
        } else {
          setCurrency('KES');
          setSymbol(getCurrencySymbol('KES'));
        }
      } catch {
        setCurrency('KES');
        setSymbol(getCurrencySymbol('KES'));
      } finally {
        setLoading(false);
      }
    }

    fetchCurrency();
  }, [user?.id, user?.role]);

  return { currency, loading, symbol };
}
