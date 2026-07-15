import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const documentType = formData.get("documentType") as string;

    if (!file || !documentType) {
      return NextResponse.json(
        { error: "File and documentType are required" },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();

    const fileExt = file.name.split('.').pop();
    const fileName = `${documentType}_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("employer-documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage." },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("employer-documents")
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;

    const { data: existingProfile, error: profileError } = await supabase
      .from("employer_onboarding")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (profileError || !existingProfile) {
      return NextResponse.json(
        { error: "Employer profile not found." },
        { status: 404 }
      );
    }

    const validDocumentTypes = [
      'certificate_of_incorporation',
      'business_registration',
      'tax_compliance_certificate',
      'cr12_document',
      'kra_pin_certificate',
      'business_permit',
      'audited_financials',
      'bank_statement',
      'proof_of_address',
      'proof_of_bank_account',
      'employment_contract_template'
    ];

    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json(
        { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // employer_kyc_documents has no INSERT/UPDATE RLS policy for regular users
    // (only a read-your-own-rows SELECT policy) — writes must go through the
    // service-role client.
    const adminSupabase = createAdminClient();
    const { error: docError } = await adminSupabase
      .from('employer_kyc_documents')
      .upsert(
        {
          user_id: user.id,
          document_type: documentType,
          document_url: fileUrl,
          storage_path: filePath,
          status: 'pending',
        },
        { onConflict: 'user_id,document_type' },
      );

    if (docError) {
      throw docError;
    }

    const { notifyAdmin } = await import('@/lib/notifications');
    await notifyAdmin({
        type: 'employer_kyc',
        title: 'New KYC Document Uploaded',
        message: `${documentType.replace(/_/g, ' ')} uploaded by employer.`,
        metadata: {
            employer_id: existingProfile.id,
            document_type: documentType,
            file_url: fileUrl
        }
    });

    return NextResponse.json({
      message: "Document uploaded successfully",
      documentType,
      fileUrl,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document. Please try again." },
      { status: 500 }
    );
  }
}