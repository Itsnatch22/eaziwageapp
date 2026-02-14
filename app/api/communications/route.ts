// app/api/communications/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import BroadcastEmail from '@/lib/emails/broadcast';

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(20, 'Message content must be at least 20 characters'),
  action: z.enum(['draft', 'send']),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user profile + role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'hr'].includes(profile.role!)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ errors: result.error.flatten() }, { status: 400 });
  }

  const { title, content, action } = result.data;

  // Save to DB
  const { data: communication, error } = await supabase
    .from('communications')
    .insert({
      organization_id: profile.organization_id,
      title,
      content,
      status: action,
      sender_id: user.id,
      sent_at: action === 'send' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }

  // If sending, deliver emails
  if (action === 'send') {
    const { data: employees } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('organization_id', profile.organization_id)
      .eq('role', 'employee')
      .not('email', 'is', null);

    if (employees?.length) {
      const emailPromises = employees.map((emp) =>
        resend.emails.send({
          from: 'EaziWage <no-reply@eaziwage.com>',
          to: emp.email!,
          subject: title,
          react: BroadcastEmail({
            title,
            content,
            recipientName: emp.full_name || 'Team Member',
          }),
        })
      );

      await Promise.allSettled(emailPromises); // Don't block response if one fails
    }
  }

  return NextResponse.json({
    success: true,
    message: action === 'send' ? 'Message sent to all employees' : 'Draft saved successfully',
    communication,
  });
}