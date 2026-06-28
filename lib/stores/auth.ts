import { createClient } from "../supabase/client";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface AuthState {
  user: (User & { full_name?: string; avatar_url?: string; role?: 'super_admin' | 'employer_admin' | 'employee' }) | null;
  loading: boolean;
}

let state: AuthState = {
  user: null,
  loading: true,
};

const listeners = new Set<(state: AuthState) => void>();

const setState = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  const [value, setValue] = useState(() => selector(state));

  useEffect(() => {
    const listener = (newState: AuthState) => {
      setValue(selector(newState));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [selector]);

  return value;
}

export function updateUserAvatar(avatarUrl: string) {
  if (state.user) {
    setState({ 
      user: { 
        ...state.user, 
        avatar_url: avatarUrl 
      } 
    });
  }
}

async function fetchUserRole(supabase: SupabaseClient, userId: string): Promise<'super_admin' | 'employer_admin' | 'employee' | undefined> {

  const { data: admin } = await supabase.from('system_admins').select('id').eq('id', userId).single();
  if (admin) return 'super_admin';

  const { data: employer } = await supabase.from('employer_onboarding').select('id').eq('user_id', userId).single();
  if (employer) return 'employer_admin';

  const { data: employee } = await supabase.from('employee_onboarding').select('id').eq('user_id', userId).single();
  if (employee) return 'employee';

  return undefined;
}

if (typeof window !== 'undefined') {
  const initializeAuth = async () => {
    const supabase = createClient();

    const syncUser = async (sessionUser?: User) => {
      try {
        const user = sessionUser || (await supabase.auth.getUser()).data.user;
        
        if (!user) {
          setState({ user: null, loading: false });
          return;
        }

        const [profileResult, role] = await Promise.all([
          supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
          fetchUserRole(supabase, user.id)
        ]);
        
        const enhancedUser = {
          ...user,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          avatar_url: profileResult.data?.avatar_url || user.user_metadata?.avatar_url,
          role,
        };
        setState({ user: enhancedUser, loading: false });
      } catch (error) {
        console.error('Error syncing user:', error);
        setState({ user: null, loading: false });
      }
    };

    await syncUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        await syncUser(session.user);
        window.dispatchEvent(new CustomEvent('auth:signed-in'));
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        await syncUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, loading: false });
        window.location.href = '/';
      } else {
        setState({ loading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  };

  initializeAuth().catch((err) => {
    console.error('Failed to initialize auth:', err);
    setState({ user: null, loading: false });
  });
}
