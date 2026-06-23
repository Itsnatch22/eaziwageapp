import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reason, category, additionalFeedback } = body;

    if (!reason || !category) {
      return NextResponse.json(
        { error: 'Reason and category are required' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const { error: deletionEventError } = await adminSupabase
      .from('account_deletion_events')
      .insert({
        user_id: user.id,
        user_email: profile.email,
        user_full_name: profile.full_name,
        user_role: profile.role,
        deletion_reason: reason,
        deletion_reason_category: category,
        additional_feedback: additionalFeedback || null,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (deletionEventError) {
      console.error('Error recording deletion event:', deletionEventError);
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      console.error('Error soft deleting profile:', profileUpdateError);
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    const { error: employeeUpdateError } = await supabase
      .from('employees')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (employeeUpdateError) {
      console.error('Error soft deleting employee record:', employeeUpdateError);
    }

    await supabase.auth.signOut();

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
