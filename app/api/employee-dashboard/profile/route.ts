import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SupabaseClient, User } from '@supabase/supabase-js';

const profileUpdateSchema = z.object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Invalid phone number format').optional(),
});

async function getFullProfile( supabase: SupabaseClient, userId: string, user: User){
    let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

    if (!profile) {
        const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || 'User',
            email: user?.email || '',
            role: user?.user_metadata?.role || 'employee',
            role_normalized: user?.user_metadata?.role || 'employee',
        })
        .select()
        .single();
        profile = newProfile;
    }

    let { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .single();
    
    if (!employee) {
        const { data: newEmployee } = await supabase
        .from('employees')
        .insert({ user_id: userId, kyc_status: 'pending' })
        .select()
        .single();
        employee = newEmployee;
    }

    // Fetch onboarding data joined with employer info
    const { data: onboarding } = await supabase
    .from('employee_onboarding')
    .select(`
        *,
        employer_onboarding!employer_id (
            company_name,
            user_id
        )
    `)
    .eq('user_id', userId)
    .maybeSingle();

    let employerPersonName = 'N/A';
    if (onboarding?.employer_onboarding?.user_id) {
        const { data: employerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', onboarding.employer_onboarding.user_id)
            .single();
        if (employerProfile) {
            employerPersonName = employerProfile.full_name;
        }
    }

    const mergedEmployee = {
        ...(employee || {}),
        ...(onboarding || {}),
        company_name: onboarding?.employer_onboarding?.company_name || 'Unlinked',
        employer_person_name: employerPersonName,
        kyc_status: onboarding?.status || employee?.kyc_status || 'pending',
    };

    const docMap: Record<string, string> = {
        id_front: 'id_front',
        address_proof: 'address_proof',
        payslip_1: 'payslip_1',
        employment_contract: 'employment_contract',
        face_id: 'face_id',
    };

    const employeeData = mergedEmployee as Record<string, unknown>;
    const kycDocuments = Object.entries(docMap).map(([docType,field]) => ({
        document_type: docType,
        status: employeeData[field] ? ('submitted' as const) : null,
    }));

    return {
        ...profile,
        employee: mergedEmployee,
        kycDocuments,
    };
}

export async function GET() {
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 400 });
    }

    const profile = await getFullProfile(supabase, user.id, user);
    return Response.json({profile});
}

export async function POST(req: NextRequest) {
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    };

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const file = formData.get('profilePicture') as File | null;

        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            return Response.json({ error: 'Invalid image format' }, { status: 400 });
        }
        if (file.size > 2 * 1024 * 1024) {
            return Response.json({ error: 'File too large (max 2MB)' }, { status: 400 });
        }

        const filePath = `${user.id}`;
        const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

        if (uploadError) {
            return Response.json({ error: 'Upload failed' }, { status: 500 });
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

        await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

        const profile = await getFullProfile(supabase, user.id, user);
        return Response.json({ profile });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.full_name) updates.full_name = parsed.data.full_name;
    if (parsed.data.phone) updates.phone = parsed.data.phone;

    const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

    if (error) {
        return Response.json({ error: 'Update failed' }, { status: 500 });
    }

    const profile = await getFullProfile(supabase, user.id, user);
    return Response.json({ profile });
}
