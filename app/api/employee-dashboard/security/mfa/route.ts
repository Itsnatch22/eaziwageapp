import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      return NextResponse.json({ error: "Failed to check MFA status" }, { status: 500 });
    }

    const totpFactors = factors?.all?.filter(factor => factor.factor_type === 'totp') || [];
    const mfaEnabled = totpFactors.length > 0;

    return NextResponse.json({ 
      enabled: mfaEnabled,
      factors: totpFactors
    });

  } catch (error: unknown) {
    console.error("Get MFA status error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'enable') {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'EaziWage Authenticator'
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      return NextResponse.json({ 
        success: true,
        qrCode: data.totp?.qr_code || '',
        secret: data.totp?.secret || '',
        factorId: data.id || ''
      });

    } else if (action === 'disable') {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        return NextResponse.json({ error: "Failed to list MFA factors" }, { status: 500 });
      }

      const totpFactors = factors?.all?.filter(factor => factor.factor_type === 'totp') || [];
      
      if (totpFactors.length === 0) {
        return NextResponse.json({ error: "No MFA factors found" }, { status: 400 });
      }

      const { error: unregisterError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactors[0].id
      });

      if (unregisterError) {
        return NextResponse.json({ error: unregisterError.message }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "MFA disabled successfully"
      });

    } else if (action === 'verify') {
      const { factorId, code } = body;

      if (!factorId || !code) {
        return NextResponse.json({ error: "Factor ID and verification code are required" }, { status: 400 });
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });

      if (error) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "MFA verification successful"
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error("MFA action error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
