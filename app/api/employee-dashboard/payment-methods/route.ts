import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('payment_methods')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ 
      methods: profile?.payment_methods || [] 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { method } = await req.json();
    if (!method.type || !method.account_number) {
      return NextResponse.json({ error: 'Invalid method details' }, { status: 400 });
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('payment_methods')
      .eq('id', user.id)
      .single();

    const currentMethods = Array.isArray(profile?.payment_methods) ? profile.payment_methods : [];
    
    // Add unique ID and handle primary flag
    const newMethod = {
      ...method,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      is_primary: currentMethods.length === 0 || method.is_primary
    };

    let updatedMethods = [...currentMethods];
    if (newMethod.is_primary) {
      updatedMethods = updatedMethods.map(m => ({ ...m, is_primary: false }));
    }
    updatedMethods.push(newMethod);

    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({ payment_methods: updatedMethods })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, method: newMethod });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const methodId = searchParams.get('id');
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('payment_methods')
      .eq('id', user.id)
      .single();

    const currentMethods = Array.isArray(profile?.payment_methods) ? profile.payment_methods : [];
    const updatedMethods = currentMethods.filter((m: any) => m.id !== methodId);

    // If we deleted the primary, make another one primary if exists
    if (currentMethods.find((m: any) => m.id === methodId)?.is_primary && updatedMethods.length > 0) {
      updatedMethods[0].is_primary = true;
    }

    await adminSupabase
      .from('profiles')
      .update({ payment_methods: updatedMethods })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
