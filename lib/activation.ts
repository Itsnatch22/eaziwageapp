import { supabaseAdmin } from './supabaseAdmin';

export interface ActivationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Single source of truth for activating a user profile.
 * Sets is_active and onboarding_complete to true.
 */
export async function activateUser(userId: string): Promise<ActivationResult> {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_active: true, 
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error(`[activation] Error activating user ${userId}:`, error);
      return { success: false, message: 'Failed to activate user profile', error: error.message };
    }

    return { success: true, message: 'User profile activated successfully' };
  } catch (err: unknown) {
    console.error(`[activation] Unexpected error activating user ${userId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: 'An unexpected error occurred during activation', error: errorMessage };
  }
}

/**
 * Single source of truth for deactivating or rejecting a user profile.
 * Ensures is_active is false.
 */
export async function deactivateUser(userId: string): Promise<ActivationResult> {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error(`[activation] Error deactivating user ${userId}:`, error);
      return { success: false, message: 'Failed to deactivate user profile', error: error.message };
    }

    return { success: true, message: 'User profile deactivated successfully' };
  } catch (err: unknown) {
    console.error(`[activation] Unexpected error deactivating user ${userId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: 'An unexpected error occurred during deactivation', error: errorMessage };
  }
}
