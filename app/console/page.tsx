import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ConsoleClient from './ConsoleClient';

export default async function ConsolePage() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/');

  // proxy.ts already enforces role=admin + is_founder + AAL2 for this route —
  // this is a second, server-side check so the page itself never renders for
  // anyone it shouldn't, even if the middleware were ever bypassed or changed.
  const { data: founderRow } = await supabaseAdmin
    .from('system_admins')
    .select('is_founder')
    .eq('id', user.id)
    .maybeSingle<{ is_founder: boolean }>();

  if (founderRow?.is_founder !== true) redirect('/admin');

  return <ConsoleClient />;
}
