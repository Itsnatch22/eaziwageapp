import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/env";
import { LoginContext, sendLoginNotification } from "./security-alerts";
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
    await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      email: email.toLowerCase(),
      ip_address: ip,
      user_agent: userAgent,
      success: true,
      logged_in_at: new Date().toISOString(),
    });

    const deviceFingerprint = buildDeviceFingerprint(ctx);

    // 3. Check if this device is already trusted
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

      // Register this as a new trusted device
      await supabaseAdmin.from("trusted_devices").insert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        device_name: parseDeviceName(userAgent),
        user_agent: userAgent,
        ip_address: ip,
        last_used_at: new Date().toISOString(),
      });
    } else {
      // Update the last_used_at timestamp for the existing device
      await supabaseAdmin
        .from("trusted_devices")
        .update({
          last_used_at: new Date().toISOString(),
          ip_address: ip,
        })
        .eq("id", trustedDevice.id);
    }

    // 4. Send the security notification email
    // This will use the "Google-like" template updated in security-alerts.ts
    await sendLoginNotification(email, fullName, ctx, isNewDevice);

    return { isNewDevice };
  } catch (error) {
    console.error("[security-service] Fatal error in handleLoginSecurity:", error);
    // Fallback: still return something so login isn't blocked by security logging
    return { isNewDevice: false };
  }
}

/**
 * Basic parser to extract a human-readable device name from User-Agent
 */
function parseDeviceName(userAgent: string): string {
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android\s+[^;]+;\s+([^;)]+)/);
    return match ? match[1] : "Android Device";
  }
  if (userAgent.includes("Windows NT 10.0")) return "Windows 10/11 PC";
  if (userAgent.includes("Macintosh")) return "MacBook / iMac";
  if (userAgent.includes("Linux")) return "Linux PC";
  return "Unknown Device";
}
