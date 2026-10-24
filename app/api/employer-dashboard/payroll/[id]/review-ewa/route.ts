import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: IdRouteContext) {
  const { id } = await params;
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: employer, error: employerError } = await supabase
    .from("employers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (employerError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/review-ewa",
      employerError,
    );
  }
  if (!employer) {
    return NextResponse.json({ error: "Employer not found" }, { status: 404 });
  }

  const { data: upload, error: uploadError } = await supabase
    .from("payroll_uploads")
    .select("id, status, ewa_reviewed_at")
    .eq("id", id)
    .eq("employer_live_id", employer.id)
    .maybeSingle();

  if (uploadError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/review-ewa",
      uploadError,
    );
  }
  if (!upload) {
    return NextResponse.json(
      { error: "Payroll upload not found" },
      { status: 404 },
    );
  }
  if (!["processed", "partial"].includes(upload.status)) {
    return NextResponse.json(
      { error: "Only completed payroll uploads can be marked as reviewed" },
      { status: 409 },
    );
  }
  if (upload.ewa_reviewed_at) {
    return NextResponse.json({ reviewed_at: upload.ewa_reviewed_at });
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("payroll_uploads")
    .update({ ewa_reviewed_at: reviewedAt })
    .eq("id", id)
    .eq("employer_live_id", employer.id)
    .is("ewa_reviewed_at", null)
    .select("ewa_reviewed_at")
    .maybeSingle();

  if (updateError) {
    return dbErrorResponse(
      "employer-dashboard/payroll/review-ewa",
      updateError,
    );
  }
  if (!updated?.ewa_reviewed_at) {
    return NextResponse.json(
      { error: "Payroll review could not be saved" },
      { status: 409 },
    );
  }

  return NextResponse.json({ reviewed_at: updated.ewa_reviewed_at });
}
