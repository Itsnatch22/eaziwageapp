import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, apiLimiter } from "@/lib/rate-limit";
import { getEnv } from "@/env";

const env = getEnv();

const schema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: Request) {
  try {
    // Extract IP for rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    // Rate limit check
    const rateLimit = await checkRateLimit(apiLimiter, ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: rateLimit.headers,
        }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    
    let input;
    try {
      input = schema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0].message },
          { status: 400, headers: rateLimit.headers }
        );
      }
      throw err;
    }

    // Search for company (case-insensitive, fuzzy match)
    const { data: companies, error } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        created_at,
        profiles!companies_created_by_fkey (
          full_name,
          email,
          phone
        )
      `)
      .ilike("name", `%${input.companyName}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Company search error:", error);
      return NextResponse.json(
        { error: "Failed to search for company" },
        { status: 500, headers: rateLimit.headers }
      );
    }

    // No company found
    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { found: false },
        { status: 200, headers: rateLimit.headers }
      );
    }

    const company = companies[0];
    const employer = Array.isArray(company.profiles) 
      ? company.profiles[0] 
      : company.profiles;

    // Return company with employer details
    return NextResponse.json(
      {
        found: true,
        company: {
          id: company.id,
          name: company.name,
          employer_name: employer?.full_name || "Unknown",
          employer_email: employer?.email || "Unknown",
          employer_phone: employer?.phone,
          created_at: company.created_at,
        },
      },
      { status: 200, headers: rateLimit.headers }
    );
  } catch (err) {
    console.error("Company search error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}