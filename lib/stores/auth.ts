'use client';

import { createClient } from "../supabase/client";
import { useCallback, useSyncExternalStore } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface AuthState {
  user: (User & { full_name?: string; avatar_url?: string; role?: 'super_admin' | 'employer_admin' | 'employee' }) | null;
  loading: boolean;
}

let state: AuthState = {
  user: null,
  loading: true,
};

const listeners = new Set<() => void>();

const setState = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

// Every call site in this codebase passes an inline arrow function selector
// (e.g. `useAuthStore(s => s.user)`) — a fresh reference on every render.
// The previous implementation re-subscribed on every render as a result
// (useEffect depended on [selector]), and at least one caller
// (AdminPortalLayout) had a downstream effect keyed on the resulting value's
// object identity, which combined into an observed live infinite render/
// prefetch loop. useSyncExternalStore is built for exactly this — it
// doesn't require the selector to be stable, and its snapshot comparison
// prevents the tear-down/rebuild-every-render churn regardless.
export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  const subscribe = useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);

  // getSnapshot is allowed to be a fresh closure every render (selector
  // itself may be inline at the call site) — useSyncExternalStore only
  // cares that repeated calls against an unchanged `state` return the same
  // value via Object.is, which holds here since every selector in this
  // codebase either reads a property straight off `state` or derives a
  // primitive from it.
  //
  // A third arg (getServerSnapshot) is mandatory for SSR — without it React
  // throws "Missing getServerSnapshot" during server rendering. The
  // client-init block below is gated on `typeof window !== 'undefined'`, so
  // `state` never changes from its module-level default on the server;
  // reusing the same selector closure there is correct and matches the
  // pre-hydration client snapshot exactly, avoiding a hydration mismatch.
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
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

async function fetchUserRole(supabase: SupabaseClient, userId: string): Promise<{ role: 'super_admin' | 'employer_admin' | 'employee' | undefined; adminProfile?: { full_name: string | null; avatar_url: string | null } }> {

  const { data: admin } = await supabase.from('system_admins').select('id, full_name, avatar_url').eq('id', userId).single();
  if (admin) return { role: 'super_admin', adminProfile: { full_name: admin.full_name, avatar_url: admin.avatar_url } };

  const { data: employer } = await supabase.from('employer_onboarding').select('id').eq('user_id', userId).single();
  if (employer) return { role: 'employer_admin' };

  const { data: employee } = await supabase.from('employee_onboarding').select('id').eq('user_id', userId).single();
  if (employee) return { role: 'employee' };

  return { role: undefined };
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

        const [profileResult, { role, adminProfile }] = await Promise.all([
          supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
          fetchUserRole(supabase, user.id)
        ]);

        // Admins have no `profiles` row (they live only in system_admins), so
        // for them prefer the record fetchUserRole already retrieved.
        const enhancedUser = {
          ...user,
          full_name: adminProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
          avatar_url: adminProfile?.avatar_url || profileResult.data?.avatar_url || user.user_metadata?.avatar_url,
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
