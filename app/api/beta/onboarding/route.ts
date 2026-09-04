import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { checkRateLimit, betaOnboardingLimiter } from '@/lib/rate-limit';
import { Resend } from 'resend';
import BetaOnboardingFeedback from '@/lib/emails/BetaOnboardingFeedback';
import { betaOnboardingSchema } from '@/lib/validations/beta-onboarding';

export async function POST(req: NextRequest) {
    try {
        const env = getEnv();

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";

        const rateLimitResult = await checkRateLimit(betaOnboardingLimiter, ip);

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

        const body = await req.json();
        const parsed = betaOnboardingSchema.safeParse(body);

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
                { message: "Feedback submitted successfully", success: true },
                { status: 200 }
            );
        }

        const { name, email, userId, reviewedPages, answers } = parsed.data;
        const resend = new Resend(env.RESEND_API_KEY);

        const supabase = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        )

        const userAgent = req.headers.get("user-agent") || "unknown";
        const SUPPORT_EMAIL = env.ADMIN_NOTIFICATION_EMAIL || "support@eaziwage.com"
        const { error: dbError } = await supabase
        .from("onboarding_feedback")
        .insert([{
            user_id: userId ?? null,
            tester_name: name,
            tester_email: email,
            reviewed_pages: reviewedPages ?? [],
            answers,
            user_ip: ip,
            user_agent: userAgent,
        }])
        .select()
        .single();

        if (dbError) {
            console.error("Error inserting onboarding feedback into database:", dbError);
            return NextResponse.json(
                { error: "Internal server error. Please try again later." },
                { status: 500 }
            );
        }

        const submittedAt = new Date();

        try {
            await resend.emails.send({
                from: "EaziWage Beta Testers <noreply@eaziwage.com>",
                to: SUPPORT_EMAIL,
                subject: `New Beta Onboarding Feedback Submission from ${name}`,
                replyTo: email,
                react: BetaOnboardingFeedback({
                    userId,
                    userName: name,
                    userEmail: email,
                    reviewedPages,
                    answers,
                    submittedAt: submittedAt.toLocaleString("en-US", {
                        dateStyle: "long",
                        timeStyle: "short",
                    }),
                    ipAddress: ip,
                    userAgent,
                    dashboardUrl: `${env.NEXT_PUBLIC_APP_URL || "https://app.eaziwage.com"}/admin`,
                }),
            });
        } catch (error) {
            console.error("Error sending onboarding feedback email:", error);
        }

        return NextResponse.json(
            { message: "Feedback submitted successfully", success: true },
            {
                status: 200,
                headers: rateLimitResult.headers
            }
        );
    } catch (error) {
        console.error("Error processing onboarding feedback:", error);
        return NextResponse.json(
            { error: "Internal server error. Please try again later." },
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
