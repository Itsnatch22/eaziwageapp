import { createClient } from "../supabase/client";
import { useEffect, useState } from "react";

interface AuthState {
  user: any;
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

// Client-side initialization
if (typeof window !== 'undefined') {
  const initializeAuth = async () => {
    const supabase = createClient();

    const syncUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const enhancedUser = {
            ...user,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          };
          setState({ user: enhancedUser, loading: false });
        } else {
          setState({ user: null, loading: false });
        }
      } catch (error) {
        console.error('Error syncing user:', error);
        setState({ user: null, loading: false });
      }
    };

    syncUser();

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const enhancedUser = {
          ...session.user,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
        };
        setState({ user: enhancedUser, loading: false });
      } else {
        setState({ user: null, loading: false });
      }
    });
  };

  initializeAuth();
}
