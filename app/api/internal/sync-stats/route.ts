import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { count: totalUsers, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (usersError) throw new Error(`profiles count failed: ${usersError.message}`);

    const { count: activeEmployers, error: employersError } = await supabaseAdmin
      .from("employers")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    if (employersError) throw new Error(`employers count failed: ${employersError.message}`);

    const { count: activeEmployees, error: employeesError } = await supabaseAdmin
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "Active");

    if (employeesError) throw new Error(`employees count failed: ${employeesError.message}`);

    const { data: disbursedData, error: disbursedError } = await supabaseAdmin
      .from("advances")
      .select("amount")
      .in("status", ["disbursed", "completed", "repaid"]);

    if (disbursedError) throw new Error(`advances sum failed: ${disbursedError.message}`);

    const totalDisbursed = (disbursedData ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0
    );

    const { error: upsertError } = await supabaseAdmin
      .from("public_stats")
      .upsert(
        {
          id: 1,
          total_users: totalUsers ?? 0,
          active_employers: activeEmployers ?? 0,
          active_employees: activeEmployees ?? 0,
          total_disbursed: totalDisbursed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

    return NextResponse.json({
      ok: true,
      synced: {
        total_users: totalUsers,
        active_employers: activeEmployers,
        active_employees: activeEmployees,
        total_disbursed: totalDisbursed,
      },
      synced_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-stats]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}