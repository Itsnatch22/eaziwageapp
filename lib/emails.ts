import VerificationEmail from "./emails/templates/VerificationEmail";
import ResetPasswordEmail from "./emails/templates/ResetPasswordEmail";
import React from "react";
import { Resend } from "resend";

const key = process.env.RESEND_API_KEY ?? "";
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";

if (!key || !fromEmail) {
  throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL missing!");
}

const resend = new Resend(key);

export async function sendVerificationEmail(to: string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  return resend.emails.send({
    from: fromEmail,
    to,
    subject: "Verify your EaziWage email",
    react: React.createElement(VerificationEmail, { link }),
  });
}

export async function sendResetEmail(to: string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  return resend.emails.send({
    from: fromEmail,
    to,
    subject: "Reset your EaziWage password",
    react: React.createElement(ResetPasswordEmail, { link }),
  });
}
