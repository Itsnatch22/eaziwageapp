import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/env";
import { LoginContext, sendLoginNotification } from "./security-alerts";
import { getDeviceName } from '@/lib/ua-parser';
import crypto from "crypto";

const env = getEnv();

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function buildDeviceFingerprint(ctx: LoginContext): string {
  const visitorId = ctx.fingerprintVisitorId?.trim();

  if (visitorId) {
    return `fpjs:${crypto
      .createHash("sha256")
      .update(visitorId)
      .digest("hex")}`;
  }

  return `ua:${crypto
    .createHash("sha256")
    .update(ctx.userAgent)
    .digest("hex")}`;
}

/**
 * Handles security checks and logging after a successful login
 */
export async function handleLoginSecurity(
  userId: string,
  email: string,
  fullName: string,
  ctx: LoginContext
): Promise<{ isNewDevice: boolean }> {
  const { ip, userAgent } = ctx;

  try {
    const deviceFingerprint = buildDeviceFingerprint(ctx);
    const { error: historyError } = await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      email: email.toLowerCase(),
      ip_address: ip,
      user_agent: userAgent,
      location: ctx.location ?? null,
      device_fingerprint: deviceFingerprint,
      session_id: ctx.sessionId ?? null,
      success: true,
      logged_in_at: new Date().toISOString(),
    });
    if (historyError) {
      console.error('[security-service] Successful login history insert failed:', { userId, error: historyError });
    }

    const { data: trustedDevice, error: fetchError } = await supabaseAdmin
      .from("trusted_devices")
      .select("id")
      .eq("user_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    let isNewDevice = false;

    if (fetchError) {
      console.error("[security-service] Error fetching trusted device:", fetchError);
    }

    if (!trustedDevice) {
      isNewDevice = true;
      console.log(`[security-service] New device detected for user ${userId}`);

      await supabaseAdmin.from("trusted_devices").insert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
      device_name: getDeviceName(userAgent),
        user_agent: userAgent,
        ip_address: ip,
        last_used_at: new Date().toISOString(),
      });
    } else {
      await supabaseAdmin
        .from("trusted_devices")
        .update({
          last_used_at: new Date().toISOString(),
          ip_address: ip,
        })
        .eq("id", trustedDevice.id);
    }

    await sendLoginNotification(email, fullName, ctx, isNewDevice);

    return { isNewDevice };
  } catch (error) {
    console.error("[security-service] Fatal error in handleLoginSecurity:", error);
    return { isNewDevice: false };
  }
}

export async function handleFailedLoginSecurity(
  userId: string,
  email: string,
  ctx: LoginContext,
): Promise<void> {
  const { error } = await supabaseAdmin.from('login_history').insert({
    user_id: userId,
    email: email.toLowerCase(),
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    location: ctx.location ?? null,
    device_fingerprint: buildDeviceFingerprint(ctx),
    session_id: null,
    success: false,
    logged_in_at: ctx.timestamp.toISOString(),
  });
  if (error) {
    console.error('[security-service] Failed login history insert failed:', { userId, error });
  }
}
