import { Resend } from "resend";
import { render } from "@react-email/render";
import { getEnv } from "../env";
import { AccountLockedEmail } from "./emails/security/AccountLockedEmail";
import { LoginNotificationEmail } from "./emails/security/LoginNotificationEmail";
import { PasswordChangedEmail } from "./emails/security/PasswordChangedEmail";

const env = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const FROM_EMAIL = "EaziWage Security <security@eaziwage.com>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.eaziwage.com";

/**
 * Security notification utilities
 */

export interface LoginContext {
  ip: string;
  userAgent: string;
  timestamp: Date;
  location?: string;
  fingerprintVisitorId?: string;
}

/**
 * Send account lockout notification
 */
export async function sendAccountLockedEmail(
  email: string,
  fullName: string,
  lockoutMinutes: number,
  loginContext: LoginContext
): Promise<{ success: boolean; error?: string }> {
  try {
    const unlockUrl = `${BASE_URL}/unlock-account?email=${encodeURIComponent(email)}`;

    const html = await render(
      AccountLockedEmail({
        fullName,
        lockoutMinutes,
        unlockUrl,
        loginContext: {
          ip: loginContext.ip,
          userAgent: loginContext.userAgent,
          timestamp: loginContext.timestamp.toISOString(),
          location: loginContext.location,
        },
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🔒 Your EaziWage account has been temporarily locked",
      html,
      tags: [
        { name: "category", value: "security" },
        { name: "type", value: "account-locked" },
      ],
    });

    if (error) {
      console.error("Failed to send account locked email:", error);
      return { success: false, error: error.message };
    }

    console.log(`Account locked email sent to ${email}, ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("Error sending account locked email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send successful login notification (for new devices)
 */
export async function sendLoginNotification(
  email: string,
  fullName: string,
  loginContext: LoginContext,
  isNewDevice: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const securityUrl = `${BASE_URL}/security`;
    const resetPasswordUrl = `${BASE_URL}/reset-password`;

    const html = await render(
      LoginNotificationEmail({
        fullName,
        isNewDevice,
        securityUrl,
        resetPasswordUrl,
        loginContext: {
          ip: loginContext.ip,
          userAgent: loginContext.userAgent,
          timestamp: loginContext.timestamp.toISOString(),
          location: loginContext.location,
        },
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: isNewDevice
        ? "🚨 Security Alert: New device detected on your EaziWage account"
        : "✅ Successful login to your EaziWage account",
      html,
      tags: [
        { name: "category", value: "security" },
        { name: "type", value: isNewDevice ? "new-device-login" : "login-notification" },
      ],
    });

    if (error) {
      console.error("Failed to send login notification:", error);
      return { success: false, error: error.message };
    }

    console.log(`Login notification sent to ${email}, ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("Error sending login notification:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send password changed notification
 */
export async function sendPasswordChangedEmail(
  email: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const securityUrl = `${BASE_URL}/security`;

    const html = await render(
      PasswordChangedEmail({
        fullName,
        securityUrl,
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🔐 Your EaziWage password was changed",
      html,
      tags: [
        { name: "category", value: "security" },
        { name: "type", value: "password-changed" },
      ],
    });

    if (error) {
      console.error("Failed to send password changed email:", error);
      return { success: false, error: error.message };
    }

    console.log(`Password changed email sent to ${email}, ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("Error sending password changed email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
