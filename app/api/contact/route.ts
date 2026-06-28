import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import ContactNotification from "@/lib/emails/ContactNotification";
import ContactAutoReply from "@/lib/emails/ContactAutoReply";
import { contactSchema } from "@/lib/validations/contact";
import { contactLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getEnv } from "@/env";


export async function POST(request: NextRequest) {
  try {
    const env = getEnv();
    
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               request.headers.get("x-real-ip") || 
               "unknown";

    const rateLimitResult = await checkRateLimit(contactLimiter, ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          message: "Too many requests from this IP address"
        },
        { 
          status: 429,
          headers: rateLimitResult.headers
        }
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    if (parsed.data.honeypot) {
      console.log(`Bot detected from IP: ${ip}`);
      return NextResponse.json(
        { message: "Message sent successfully", success: true },
        { status: 200 }
      );
    }

    const { name, email, subject, message } = parsed.data;

    const resend = new Resend(env.RESEND_API_KEY);
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    const SUPPORT_EMAIL = env.ADMIN_NOTIFICATION_EMAIL || "support@eaziwage.com";

    const { error: dbError } = await supabase
      .from("dashboard_contact")
      .insert([
        {
          name,
          email,
          subject,
          message,
          ip_address: ip,
          user_agent: request.headers.get("user-agent") || "unknown",
          submitted_at: new Date().toISOString(),
        },
      ]);

    if (dbError) {
      console.error("Database error (dashboard_contact):", dbError);
    }

    const submittedAt = new Date();
    try {
      await resend.emails.send({
        from: `EaziWage Contact <noreply@eaziwage.com>`,
        to: SUPPORT_EMAIL,
        replyTo: email,
        subject: `[Contact Form] ${subject}`,
        react: ContactNotification({
          name,
          email,
          subject,
          message,
          submittedAt: submittedAt.toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
          }),
        }),
      });
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    try {
      await resend.emails.send({
        from: `EaziWage Support <noreply@eaziwage.com>`,
        to: email,
        subject: "We received your message - EaziWage",
        react: ContactAutoReply({
          name,
          subject,
        }),
      });
    } catch (emailError) {
      console.error("Failed to send auto-reply:", emailError);
    }

    return NextResponse.json(
      { 
        message: "Message sent successfully",
        success: true 
      },
      { 
        status: 200,
        headers: rateLimitResult.headers
      }
    );

  } catch (error) {
    console.error("Unexpected error in contact form:", error);
    
    return NextResponse.json(
      { 
        error: "An unexpected error occurred. Please try again later.",
        message: "Internal server error"
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
