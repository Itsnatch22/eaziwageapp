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
    console.error('Payment methods GET error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error instanceof Error) {
      if (error.message.includes('column "payment_methods" does not exist')) {
        return NextResponse.json({ 
          error: 'Database schema not updated. Please contact administrator.' 
        }, { status: 500 });
      }
      if (error.message.includes('profiles')) {
        return NextResponse.json({ 
          error: 'Profile table not found. Please contact administrator.' 
        }, { status: 500 });
      }
    }
    
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
    
    const newMethod = {
      ...method,
      id: Math.random().toString(36).substring(2, 11),
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
    let userId = 'unknown';
    try {
      const supabase = await createRouteHandlerClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      userId = authUser?.id || 'unknown';
    } catch {
    }
    
    console.error('Payment methods POST error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId
    });
    
    if (error instanceof Error) {
      if (error.message.includes('column "payment_methods" does not exist')) {
        return NextResponse.json({ 
          error: 'Database schema not updated. Please contact administrator.' 
        }, { status: 500 });
      }
      if (error.message.includes('profiles')) {
        return NextResponse.json({ 
          error: 'Profile table not found. Please contact administrator.' 
        }, { status: 500 });
      }
    }
    
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

    if (currentMethods.find((m: any) => m.id === methodId)?.is_primary && updatedMethods.length > 0) {
      updatedMethods[0].is_primary = true;
    }

    await adminSupabase
      .from('profiles')
      .update({ payment_methods: updatedMethods })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    let userId = 'unknown';
    try {
      const supabase = await createRouteHandlerClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      userId = authUser?.id || 'unknown';
    } catch {
    }
    
    const methodIdToLog = new URL(req.url).searchParams.get('id') || 'unknown';
    
    console.error('Payment methods DELETE error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      methodId: methodIdToLog
    });
    
    if (error instanceof Error) {
      if (error.message.includes('column "payment_methods" does not exist')) {
        return NextResponse.json({ 
          error: 'Database schema not updated. Please contact administrator.' 
        }, { status: 500 });
      }
      if (error.message.includes('profiles')) {
        return NextResponse.json({ 
          error: 'Profile table not found. Please contact administrator.' 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
