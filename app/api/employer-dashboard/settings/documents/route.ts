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

    // Upload to Supabase Storage (assuming a bucket named 'employer_documents')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("employer_documents")
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
      .from("employer_documents")
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;

    // Fetch existing documents to update the JSON object
    const { data: existingProfile, error: profileError } = await supabase
      .from("employer_onboarding")
      .select("id, documents")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (profileError || !existingProfile) {
      return NextResponse.json(
        { error: "Employer profile not found." },
        { status: 404 }
      );
    }

    // Update the documents JSON object
    const updatedDocuments = {
      ...(existingProfile.documents || {}),
      [documentType]: fileUrl, // Store the URL or path
    };

    const { error: updateError } = await supabase
      .from("employer_onboarding")
      .update({ documents: updatedDocuments })
      .eq("id", existingProfile.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      message: "Document uploaded successfully",
      documents: updatedDocuments,
      fileUrl,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
