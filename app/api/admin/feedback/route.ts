import { NextRequest, NextResponse } from "next/server";
import { adminFeedbackLimiter, checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function GET(req: NextRequest) {
    const adminAccess = await requireAdmin();
    if (adminAccess instanceof NextResponse) {
        return adminAccess;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const rateLimitResult = await checkRateLimit(adminFeedbackLimiter, `admin-feedback:${ip}`);

    if(!rateLimitResult.success) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rateLimitResult.headers });
    }

    try {
        const { adminSupabase } = adminAccess;
        const columns = "id,user_id,tester_name,tester_email,reviewed_pages,answers,submitted_at";

        const [onboardingResult, disbursementResult] = await Promise.all([
            adminSupabase
                .from("onboarding_feedback")
                .select(columns)
                .order("submitted_at", { ascending: false }),
            adminSupabase
                .from("beta_disbursement_feedback")
                .select(columns)
                .order("submitted_at", { ascending: false }),
        ]);

        if (onboardingResult.error || disbursementResult.error) {
            console.error("Error loading beta feedback:", onboardingResult.error ?? disbursementResult.error);
            return NextResponse.json({ error: "Unable to load beta feedback" }, { status: 500 });
        }

        const feedback = [
            ...(onboardingResult.data ?? []).map((entry) => ({ ...entry, survey: "onboarding" as const })),
            ...(disbursementResult.data ?? []).map((entry) => ({ ...entry, survey: "disbursement" as const })),
        ].sort((a, b) => {
            const first = new Date(a.submitted_at).getTime();
            const second = new Date(b.submitted_at).getTime();
            return second - first;
        });

        return NextResponse.json({
            feedback,
            meta: {
                total: feedback.length,
                onboarding: onboardingResult.data?.length ?? 0,
                disbursement: disbursementResult.data?.length ?? 0,
            },
        }, { headers: rateLimitResult.headers });
    } catch (error) {
        console.error("Unexpected error loading beta feedback:", error);
        return NextResponse.json({ error: "Unable to load beta feedback" }, { status: 500 });
    }
}