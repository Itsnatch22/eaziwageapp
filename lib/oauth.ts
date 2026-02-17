/**
 * OAuth utilities for Google and Apple Sign-In
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Initialize OAuth sign-in with Google
 */
export async function signInWithGoogle(
  supabase: SupabaseClient,
  redirectTo: string
) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Initialize OAuth sign-in with Apple
 */
export async function signInWithApple(
  supabase: SupabaseClient,
  redirectTo: string
) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: redirectTo,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Handle OAuth callback and create profile
 * This should be called in the OAuth callback page
 */
export async function handleOAuthCallback(
  supabase: SupabaseClient,
  role: "employer" | "employee",
  additionalData?: {
    companyName?: string;
    companySize?: number;
    phone?: string;
  }
) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Failed to get user after OAuth");
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      // Profile exists, redirect to dashboard
      return {
        success: true,
        redirectTo:
          existingProfile.role === "employer"
            ? "/dashboards/employer-dashboard"
            : "/dashboards/employee-dashboard",
      };
    }

    // Create profile for new OAuth user
    let companyId: string | null = null;

    if (role === "employer" && additionalData?.companyName) {
      // Create company for employer
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: additionalData.companyName,
          size: additionalData.companySize ?? 1,
          created_by: user.id,
        })
        .select()
        .single();

      if (companyError) {
        throw companyError;
      }

      companyId = company.id;
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      email: user.email!,
      role: role,
      company_id: companyId,
      phone: additionalData?.phone,
    });

    if (profileError) {
      throw profileError;
    }

    return {
      success: true,
      redirectTo:
        role === "employer"
          ? "/dashboards/employer-dashboard"
          : "/dashboards/employee-dashboard",
    };
  } catch (error) {
    console.error("OAuth callback error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete OAuth sign-in",
    };
  }
}