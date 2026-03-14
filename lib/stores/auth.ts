import { createClient } from "../supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: (User & { full_name?: string; avatar_url?: string }) | null;
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

// Function to update user avatar in the store (used after avatar upload)
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

// Client-side initialization
if (typeof window !== 'undefined') {
  const initializeAuth = async () => {
    const supabase = createClient();

    const syncUser = async () => {
      try {
        // Get user with a more generous timeout (5 seconds instead of 2)
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Auth timeout')), 5000)
          ),
        ]) as Awaited<ReturnType<typeof supabase.auth.getUser>>;

        const { data: { user }, error } = result;
        
        if (error) {
          console.error('Error getting user:', error);
          setState({ user: null, loading: false });
          return;
        }

        if (user) {
          // Fetch avatar_url from profiles table
          let avatar_url: string | undefined;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', user.id)
              .single();
            avatar_url = profile?.avatar_url;
          } catch (e) {
            // Ignore profile fetch errors - it's okay if this fails
            console.log('Could not fetch profile avatar');
          }
          
          const enhancedUser = {
            ...user,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            avatar_url: avatar_url || user.user_metadata?.avatar_url,
          };
          setState({ user: enhancedUser, loading: false });
        } else {
          setState({ user: null, loading: false });
        }
      } catch (error) {
        console.error('Error syncing user:', error);
        // Set loading to false even on error to prevent infinite loading
        setState({ user: null, loading: false });
      }
    };

    // Run initial sync
    await syncUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      
      if (session?.user) {
        // Fetch avatar_url from profiles table on auth state change
        let avatar_url: string | undefined;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', session.user.id)
            .single();
          avatar_url = profile?.avatar_url;
        } catch (e) {
          // Ignore profile fetch errors
        }
        
        const enhancedUser = {
          ...session.user,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
          avatar_url: avatar_url || session.user.user_metadata?.avatar_url,
        };
        setState({ user: enhancedUser, loading: false });
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, loading: false });
      } else {
        // For other events without a session, keep current state but ensure loading is false
        setState({ loading: false });
      }
    });

    // Cleanup on unmount (though this rarely happens in practice)
    return () => {
      subscription.unsubscribe();
    };
  };

  initializeAuth().catch((err) => {
    console.error('Failed to initialize auth:', err);
    // Ensure loading is set to false even if initialization fails
    setState({ user: null, loading: false });
  });
}