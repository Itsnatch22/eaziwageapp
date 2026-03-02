import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";


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

    // Convert file to array buffer for upload
    const fileBuffer = await file.arrayBuffer();

    // Create a unique file path for the employer
    const fileExt = file.name.split('.').pop();
    const fileName = `${documentType}_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from("employer-documents")
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;

    // Fetch existing profile to ensure it exists
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

    // Map documentType to the correct column name
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

    // Update the specific document column
    const { error: updateError } = await supabase
      .from('employer_onboarding')
      .update({ [documentType]: fileUrl })
      .eq('id', existingProfile.id);

    if (updateError) {
      throw updateError;
    }

    // Trigger notification to Admin
    const { notifyAdmins } = await import('@/lib/notifications');
    await notifyAdmins({
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
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}