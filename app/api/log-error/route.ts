import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyAdmins } from "@/lib/notifications";

function getErrorSeverity(
  url: string | null,
  message: string | null
): "critical" | "high" | "low" {
  const u = url?.toLowerCase() ?? "";
  const m = message?.toLowerCase() ?? "";

  if (
    u.includes("advance") ||
    u.includes("wallet") ||
    u.includes("disburse") ||
    u.includes("repay")
  )
    return "critical";

  if (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("unauthorized")
  )
    return "high";

  return "low";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { message, digest, stack, url, role, userId } = body as {
      message: string | null;
      digest: string | null;
      stack: string | null;
      url: string | null;
      role: "admin" | "employer" | "employee" | "public";
      userId: string | null;
    };

    const { data: insertedRow } = await supabaseAdmin
      .from("error_logs")
      .insert({
        message: message ?? null,
        digest: digest ?? null,
        stack: stack ?? null,
        url: url ?? null,
        role: role ?? "public",
        user_id: userId ?? null,
        resolved: false,
      })
      .select("id")
      .single();

    // Only notify for user-facing portal errors — admin and public are noise
    if (role === "employer" || role === "employee") {
      if (!insertedRow?.id) return NextResponse.json({ ok: true });

      // DB-backed cooldown: skip notification if same url+role errored in last 15min
      // Survives server restarts and deploys — the DB is the source of truth
      const cooldownSince = new Date(
        Date.now() - 15 * 60 * 1000
      ).toISOString();
      const { data: recentError } = await supabaseAdmin
        .from("error_logs")
        .select("id")
        .eq("url", url ?? "unknown")
        .eq("role", role)
        .gte("created_at", cooldownSince)
        .neq("id", insertedRow.id) // exclude the row we just inserted
        .limit(1)
        .maybeSingle();

      if (recentError) {
        // Cooldown active — error is logged, skip notification
        return NextResponse.json({ ok: true });
      }

      const severity = getErrorSeverity(url, message);
      const title =
        severity === "critical"
          ? `🚨 Critical Error — ${role} portal`
          : severity === "high"
          ? `⚠️ Error — ${role} portal`
          : `ℹ️ Error logged — ${role} portal`;

      if (severity === "critical" || severity === "high") {
        notifyAdmins({
          type: "system_alert",
          title,
          message: `A ${role} encountered an error on ${url ?? "unknown route"}. Error ID: ${digest ?? "N/A"}. Message: ${message?.slice(0, 120) ?? "No message"}`,
          metadata: {
            error_log_id: insertedRow.id,
            role,
            url,
            digest,
            message: message?.slice(0, 200),
            severity,
          },
        }).catch(() => {}); // never surface notification errors to the caller
      } else {
        // low — in-app only: insert directly without triggering email
        void supabaseAdmin.from("admin_notifications").insert({
          type: "system_alert",
          title,
          message: `A ${role} encountered an error on ${url ?? "unknown route"}. Error ID: ${digest ?? "N/A"}.`,
          metadata: {
            error_log_id: insertedRow.id,
            role,
            url,
            digest,
            severity,
          },
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    // intentionally silent — logging must never crash the error page
  }

  return NextResponse.json({ ok: true });
}
