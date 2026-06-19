import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { DocumentStatusEnum } from '@/lib/validations/kyc-validation';
import { checkAdminAccess } from '@/lib/server/admin-auth';

const EMPLOYEE_KYC_BUCKET = 'employee-kyc-documents';

const EMPLOYER_DOCUMENT_FIELDS = [
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
  'employment_contract_template',
] as const;

type EmployeeIdentityRow = {
  user_id: string | null;
  national_id: string | null;
  id_type: string | null;
};

type EmployeeKycDocumentRow = {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string | null;
  storage_path: string | null;
  document_number: string | null;
  status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
};

function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findLatestEmployerDocumentUrl(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  documentType: (typeof EMPLOYER_DOCUMENT_FIELDS)[number]
) {
  const bucket = adminSupabase.storage.from('employer-documents');

  const { data: nestedFiles } = await bucket.list(`${userId}/${documentType}`, {
    limit: 1,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  const nestedFile = nestedFiles?.find((file) => file.name && file.id);
  let storagePath = nestedFile ? `${userId}/${documentType}/${nestedFile.name}` : null;

  if (!storagePath) {
    const { data: flatFiles } = await bucket.list(userId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    const flatFile = flatFiles?.find((file) => file.name?.startsWith(`${documentType}_`) && file.id);
    storagePath = flatFile ? `${userId}/${flatFile.name}` : null;
  }

  if (!storagePath) return null;

  const { data: signedData } = await bucket.createSignedUrl(storagePath, 60 * 60 * 24);
  return signedData?.signedUrl ?? null;
}

async function hydrateEmployerDocumentUrls(
  adminSupabase: ReturnType<typeof createAdminClient>,
  employerApps: Record<string, unknown>[]
) {
  return Promise.all(
    employerApps.map(async (app) => {
      const onboardingId = typeof app.id === 'string' ? app.id : null;
      const userId = typeof app.user_id === 'string' ? app.user_id : null;
      if (!onboardingId && !userId) return app;

      const recoveredEntries = await Promise.all(
        EMPLOYER_DOCUMENT_FIELDS.map(async (field) => {
          const storedValue = typeof app[field] === 'string' && app[field] ? app[field] as string : null;

          if (storedValue && !storedValue.startsWith('http')) {
            const { data: signedData } = await adminSupabase.storage
              .from('employer-documents')
              .createSignedUrl(storedValue, 60 * 60 * 24);
            return [field, signedData?.signedUrl ?? null] as const;
          }

          if (storedValue) return [field, storedValue] as const;

          const url = await findLatestEmployerDocumentUrl(
            adminSupabase,
            onboardingId ?? userId!,
            field
          ) ?? (userId ? await findLatestEmployerDocumentUrl(adminSupabase, userId, field) : null);

          return [field, url] as const;
        })
      );

      return {
        ...app,
        ...Object.fromEntries(recoveredEntries.filter(([, url]) => url !== null)),
      };
    })
  );
}

function recoverEmployeeStoragePath(doc: EmployeeKycDocumentRow) {
  const storedPath = doc.storage_path?.trim();
  if (storedPath && !storedPath.startsWith('http')) return storedPath;

  const urlValue = storedPath?.startsWith('http') ? storedPath : doc.document_url;
  if (!urlValue) return null;

  try {
    const url = new URL(urlValue);
    const pathPrefix = `/storage/v1/object/sign/${EMPLOYEE_KYC_BUCKET}/`;
    const publicPathPrefix = `/storage/v1/object/public/${EMPLOYEE_KYC_BUCKET}/`;
    const authenticatedPathPrefix = `/storage/v1/object/authenticated/${EMPLOYEE_KYC_BUCKET}/`;
    const matchingPrefix = [pathPrefix, publicPathPrefix, authenticatedPathPrefix]
      .find((prefix) => url.pathname.startsWith(prefix));

    if (!matchingPrefix) return null;
    return decodeURIComponent(url.pathname.slice(matchingPrefix.length));
  } catch {
    return null;
  }
}

async function getFreshEmployeeDocumentUrl(
  adminSupabase: ReturnType<typeof createAdminClient>,
  doc: EmployeeKycDocumentRow
) {
  const storagePath = recoverEmployeeStoragePath(doc);
  if (!storagePath) return doc.document_url;

  const { data: signedData, error } = await adminSupabase.storage
    .from(EMPLOYEE_KYC_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (error) {
    console.error('[GET /api/admin/kyc/documents] Failed to sign employee KYC document URL:', {
      documentId: doc.id,
      storagePath,
      error: error.message,
    });
  }

  return signedData?.signedUrl ?? doc.document_url;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase });
    if (adminAccess.error) {
      return NextResponse.json({ error: 'Failed to verify role', code: 'ROLE_CHECK_FAILED' }, { status: 500 });
    }

    if (!adminAccess.isAdmin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const userIdParam = searchParams.get('user_id');

    let status: string | null = null;
    if (statusParam) {
      const parsed = DocumentStatusEnum.safeParse(statusParam);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid status parameter', code: 'INVALID_STATUS' }, { status: 400 });
      }
      status = parsed.data;
    }

    let query = adminSupabase
      .from('employee_kyc_documents')
      .select(
        'id,user_id,document_type,document_url,storage_path,document_number,status,reviewer_notes,reviewed_at,reviewed_by,expiry_date,created_at,updated_at'
      )
      .order('created_at', { ascending: false });

    if (userIdParam) query = query.eq('user_id', userIdParam);
    if (status) query = query.eq('status', status);

    const { data: documents, error: docsError } = await query;
    if (docsError) {
      return NextResponse.json({ error: 'Failed to load KYC documents', code: 'QUERY_ERROR' }, { status: 500 });
    }

    const documentUserIds = [...new Set((documents ?? []).map((d) => d.user_id).filter(Boolean))];
    const identityByUserId = new Map<string, EmployeeIdentityRow>();

    if (documentUserIds.length > 0) {
      const { data: onboardingRows } = await adminSupabase
        .from('employee_onboarding')
        .select('user_id,national_id,id_type')
        .in('user_id', documentUserIds);

      (onboardingRows ?? []).forEach((row: EmployeeIdentityRow) => {
        if (row.user_id) {
          identityByUserId.set(row.user_id, row);
        }
      });
    }

    const normalizedDocuments = await Promise.all((documents ?? []).map(async (doc: EmployeeKycDocumentRow) => {
      const identity = identityByUserId.get(doc.user_id);
      const storedDocumentNumber = typeof doc.document_number === 'string'
        ? doc.document_number.trim()
        : null;
      const onboardingDocumentNumber = identity?.national_id?.trim() || null;
      const freshDocumentUrl = await getFreshEmployeeDocumentUrl(adminSupabase, doc);

      return {
        ...doc,
        document_url: freshDocumentUrl,
        document_number: storedDocumentNumber || onboardingDocumentNumber,
        id_type: identity?.id_type ?? null,
      };
    }));

    let empOnboardingQuery = adminSupabase
      .from('employer_onboarding')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status) empOnboardingQuery = empOnboardingQuery.eq('status', status);
    
    const { data: employerApps } = await empOnboardingQuery;
    const normalizedEmployerApps = await hydrateEmployerDocumentUrls(adminSupabase, employerApps ?? []);

    let employeeOnboardingQuery = adminSupabase
      .from('employee_onboarding')
      .select(`
        *,
        employer:employer_onboarding!employer_id (
          company_name
        )
      `)
      .order('created_at', { ascending: false });

    if (status) employeeOnboardingQuery = employeeOnboardingQuery.eq('status', status);
    const { data: employeeApps } = await employeeOnboardingQuery;

    const { data: unlinkedProfiles } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .is('company_code', null)
      .order('created_at', { ascending: false });

    const userIds = [...new Set(normalizedDocuments.map((d) => d.user_id).filter(Boolean))];
    const userMap: Record<string, { full_name: string; role: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      (profiles ?? []).forEach((p) => {
        if (p.id) {
          userMap[p.id] = {
            full_name: p.full_name ?? 'Unknown User',
            role: p.role ?? 'employee',
          };
        }
      });
    }

    return NextResponse.json(
      {
        documents: normalizedDocuments,
        employerApplications: normalizedEmployerApps,
        employeeApplications: employeeApps ?? [],
        unlinkedEmployees: unlinkedProfiles ?? [],
        usersById: userMap,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/kyc/documents] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 });
  }
}
