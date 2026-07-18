import { z } from 'zod';
import { isDocumentFile } from '@/lib/upload-file-types';

export const UserRoleEnum = z.enum([
  'employee',
  'employer',
  'admin',
  'super_admin',
  'compliance',
  'employer_admin',
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const DocumentStatusEnum = z.enum(['pending', 'under_review', 'approved', 'rejected']);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const EmployeeStatusEnum = z.enum([
  'active',
  'inactive',
  'suspended',
  'terminated',
  'pending',
]);
export type EmployeeStatus = z.infer<typeof EmployeeStatusEnum>;

// Matches employee_kyc_documents.document_type's CHECK constraint exactly — these
// are the 8 documents the granular per-document KYC review flow operates on.
// face_id (selfie/liveness) is a separate concept stored on employee_onboarding.face_id,
// not a row in this table — see the face_id branch in the upload route.
export const DocumentTypeEnum = z.enum([
  'id_front',
  'id_back',
  'address_proof',
  'tax_certificate',
  'payslip_1',
  'payslip_2',
  'bank_statement',
  'employment_contract',
]);
export type DocumentType = z.infer<typeof DocumentTypeEnum>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  role: UserRoleEnum,
  avatar_url: z.string().url().nullable(),
  is_active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  employer_id: z.string().uuid().nullable(),
  employee_code: z.string(),
  full_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  job_title: z.string().nullable(),
  department: z.string().nullable(),
  monthly_salary: z.number().nullable(),
  hire_date: z.string().nullable(),
  status: EmployeeStatusEnum,
  employer_name: z.string().optional(),
  kyc_status: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const KYCDocumentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  document_type: DocumentTypeEnum,
  document_url: z.string().url(),
  storage_path: z.string(),
  document_number: z.string().nullable(),
  status: DocumentStatusEnum,
  reviewer_notes: z.string().nullable(),
  reviewed_at: z.string().datetime({ offset: true }).nullable().optional(),
  reviewed_by: z.string().uuid().nullable(),
  expiry_date: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  // Supporting attachments for multi-file (financial) document types — extra
  // files that hang off this one reviewable row. See lib/constants/kyc-multi-file.ts.
  additional_files: z
    .array(z.object({
      url: z.string(),
      storage_path: z.string(),
      name: z.string(),
      uploaded_at: z.string(),
    }))
    .default([]),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type KYCDocument = z.infer<typeof KYCDocumentSchema>;

export const DocumentReviewHistorySchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  old_status: DocumentStatusEnum.nullable(),
  new_status: DocumentStatusEnum,
  reviewer_notes: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
});
export type DocumentReviewHistory = z.infer<typeof DocumentReviewHistorySchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'success', 'warning', 'error']),
  link: z.string().nullable(),
  is_read: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime({ offset: true }),
  read_at: z.string().datetime({ offset: true }).nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const DocumentUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size must be under 5 MB',
    })
    .refine(
      (file) => isDocumentFile(file),
      {
        message: 'File must be an image or document file',
      }
    ),
  document_type: DocumentTypeEnum,
  document_number: z.string().optional(),
});
export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;

export const DocumentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional().default(''),
});
export type DocumentReview = z.infer<typeof DocumentReviewSchema>;

export const DocumentQuerySchema = z.object({
  status: DocumentStatusEnum.optional(),
  user_id: z.string().uuid().optional(),
  document_type: DocumentTypeEnum.optional(),
});
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

export const EmployeeQuerySchema = z.object({
  employer_id: z.string().uuid().optional(),
  status: EmployeeStatusEnum.optional(),
  search: z.string().optional(),
});
export type EmployeeQuery = z.infer<typeof EmployeeQuerySchema>;

export type KYCDocumentWithEmployee = KYCDocument & {
  employee?: Employee;
  reviewer?: Profile;
};

export type EmployeeWithDocuments = Employee & {
  documents?: KYCDocument[];
  kyc_completion_percentage?: number;
};

export type DocumentWithHistory = KYCDocument & {
  history?: DocumentReviewHistory[];
};

export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
  });

export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
  keys: z.array(z.string()).optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_front: 'National ID (Front)',
  id_back: 'National ID (Back)',
  address_proof: 'Proof of Address',
  tax_certificate: 'Tax Compliance Certificate',
  payslip_1: 'Payslip (Month 1)',
  payslip_2: 'Payslip (Month 2)',
  bank_statement: 'Bank Statement',
  employment_contract: 'Employment Contract',
};

export const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'amber',
    icon: 'clock',
  },
  approved: {
    label: 'Approved',
    color: 'green',
    icon: 'check-circle',
  },
  rejected: {
    label: 'Rejected',
    color: 'red',
    icon: 'x-circle',
  },
} as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; 
export const ALLOWED_MIME_TYPES = [
  'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/csv',
  'application/csv',
  'text/plain',
] as const;

export type DatabaseInsert<T> = Omit<
  T,
  'id' | 'created_at' | 'updated_at'
>;
export type DatabaseUpdate<T> = Partial<
  Omit<T, 'id' | 'created_at' | 'updated_at'>
>;

export function validateDocumentType(type: unknown): DocumentType {
  return DocumentTypeEnum.parse(type);
}

export function validateDocumentStatus(status: unknown): DocumentStatus {
  return DocumentStatusEnum.parse(status);
}

export function isAdminRole(role: UserRole): boolean {
  return ['admin', 'super_admin', 'compliance', 'employer_admin'].includes(role);
}


export function isKYCDocument(obj: unknown): obj is KYCDocument {
  return KYCDocumentSchema.safeParse(obj).success;
}

export function isEmployee(obj: unknown): obj is Employee {
  return EmployeeSchema.safeParse(obj).success;
}

export function isProfile(obj: unknown): obj is Profile {
  return ProfileSchema.safeParse(obj).success;
}
