import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await response.json()
    const rates = data.rates
    const currencies = ['KES', 'UGX', 'TZS', 'RWF']

    for (const code of currencies) {
      const rate = rates[code]
      if (rate) {
        await supabase
          .from('exchange_rates')
          .upsert({ currency_code: code, rate_to_usd: rate, updated_at: new Date().toISOString() })
      }
    }
    return new Response('Rates synced', { status: 200 })
  } catch (e) {
    return new Response(e.message, { status: 500 })
  }
})
