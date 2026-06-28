'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function logout() {
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



          }
        },
      }
    }
  );

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Logout error:', error)
    redirect('/error')
  }

  revalidatePath('/', 'layout');
  redirect('/')
}
