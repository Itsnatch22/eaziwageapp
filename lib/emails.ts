import { render } from "@react-email/render";
import VerificationEmail from "./emails/templates/VerificationEmail";
import ResetPasswordEmail from "./emails/templates/ResetPasswordEmail";
import React from "react";

const RESEND_API = "https://api.resend.com/emails";

type SendOpts = { to: string; subject: string; html: string };

async function sendRawEmail({ to, subject, html }: SendOpts) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if(!key || !from) throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL missing!");

    const body = {
        from,
        to,
        subject,
        html,
    };

    const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error("Resend error:", res.status, errText);
        throw new Error("Failed to send email");
    }

    return res.json();
}

export async function sendVerificationEmail(to: string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  const html = await render(React.createElement(VerificationEmail, { link }));
  return sendRawEmail({ to, subject: "Verify your EaziWage email", html });
}

export async function sendResetEmail(to: string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const html = await render(React.createElement(ResetPasswordEmail, { link }));
  return sendRawEmail({ to, subject: "Reset your EaziWage password", html });
}