import { Resend } from "resend";
import { getEnv } from "../env";

const env = getEnv();
const resend = new Resend(env.RESEND_API_KEY);

const FROM_EMAIL = "EaziWage Security <security@eaziwage.com>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eaziwage.com";

const newYear = new Date().getFullYear() + 1; // Always show next year for future-proofing

/**
 * Security notification utilities
 */

export interface LoginContext {
  ip: string;
  userAgent: string;
  timestamp: Date;
  location?: string;
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🔒 Your EaziWage account has been temporarily locked",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
              <div style="background-color: #fee2e2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <h1 style="color: #991b1b; margin: 0; font-size: 24px;">🔒 Account Temporarily Locked</h1>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${fullName},</p>
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Your EaziWage account has been temporarily locked due to multiple failed login attempts. This is a security measure to protect your account.
              </p>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #374151; font-size: 14px; margin: 0 0 8px;"><strong>Last attempt details:</strong></p>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  📅 Time: ${loginContext.timestamp.toLocaleString()}<br>
                  🌐 IP Address: ${loginContext.ip}<br>
                  ${loginContext.location ? `📍 Location: ${loginContext.location}<br>` : ''}
                  💻 Device: ${loginContext.userAgent}
                </p>
              </div>

              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                <strong>What happens now?</strong><br>
                Your account will automatically unlock in ${lockoutMinutes} minutes. You can then try logging in again.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${unlockUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; display: inline-block;">
                  Unlock Account Now
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 24px 0 0;">
                <strong>Wasn't you?</strong> If you didn't attempt to log in, someone may have your email address. We recommend:
              </p>
              <ul style="color: #6b7280; font-size: 14px; margin: 8px 0;">
                <li>Change your password immediately</li>
                <li>Enable two-factor authentication</li>
                <li>Contact our security team at security@eaziwage.com</li>
              </ul>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                © 2025 - ${newYear} EaziWage. This is an automated security notification.
              </p>
            </div>
          </body>
        </html>
      `,
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: isNewDevice 
        ? "🔔 New device login detected on your EaziWage account"
        : "✅ New login to your EaziWage account",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
              ${isNewDevice ? `
                <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                  <h1 style="color: #92400e; margin: 0; font-size: 24px;">🔔 New Device Login</h1>
                </div>
              ` : `
                <div style="background-color: #dcfce7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                  <h1 style="color: #166534; margin: 0; font-size: 24px;">✅ Successful Login</h1>
                </div>
              `}
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${fullName},</p>
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                ${isNewDevice 
                  ? "We noticed a login to your EaziWage account from a device we haven't seen before."
                  : "Your EaziWage account was just accessed."
                }
              </p>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #374151; font-size: 14px; margin: 0 0 8px;"><strong>Login details:</strong></p>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  📅 Time: ${loginContext.timestamp.toLocaleString()}<br>
                  🌐 IP Address: ${loginContext.ip}<br>
                  ${loginContext.location ? `📍 Location: ${loginContext.location}<br>` : ''}
                  💻 Device: ${loginContext.userAgent}
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${securityUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; display: inline-block;">
                  Review Security Settings
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 24px 0 0;">
                <strong>Wasn't you?</strong> If you didn't log in, secure your account immediately:
              </p>
              <ul style="color: #6b7280; font-size: 14px; margin: 8px 0;">
                <li>Change your password at ${BASE_URL}/reset-password</li>
                <li>Review active sessions and sign out unknown devices</li>
                <li>Contact security@eaziwage.com for assistance</li>
              </ul>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                © 2025 - ${newYear} EaziWage. This is an automated security notification.
              </p>
            </div>
          </body>
        </html>
      `,
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🔐 Your EaziWage password was changed",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px;">
              <div style="background-color: #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <h1 style="color: #1e40af; margin: 0; font-size: 24px;">🔐 Password Changed</h1>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${fullName},</p>
              
              <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Your EaziWage password was successfully changed just now.
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 24px 0;">
                <strong>Didn't change your password?</strong> Contact our security team immediately at security@eaziwage.com
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${securityUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; display: inline-block;">
                  Review Account Security
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                © 2025 - ${newYear} EaziWage. This is an automated security notification.
              </p>
            </div>
          </body>
        </html>
      `,
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