import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const UserRoleEnum = z.enum([
  'employee',
  'employer',
  'admin',
  'super_admin',
  'compliance',
  'employer_admin',
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const DocumentStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const EmployeeStatusEnum = z.enum([
  'active',
  'inactive',
  'suspended',
  'terminated',
  'pending',
]);
export type EmployeeStatus = z.infer<typeof EmployeeStatusEnum>;

export const DocumentTypeEnum = z.enum([
  'national_id',
  'passport',
  'drivers_license',
  'kra_pin',
  'nhif_card',
  'nssf_card',
  'bank_statement',
  'payslip',
  'employment_letter',
  'employment_contract',
  'tax_certificate',
  'utility_bill',
  'selfie',
  'face_id',
]);
export type DocumentType = z.infer<typeof DocumentTypeEnum>;

// ============================================================================
// DATABASE SCHEMAS
// ============================================================================

// Profile Schema
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  role: UserRoleEnum,
  avatar_url: z.string().url().nullable(),
  is_active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// Employee Schema
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
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

// KYC Document Schema
export const KYCDocumentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  document_type: DocumentTypeEnum,
  document_url: z.string().url(),
  storage_path: z.string(),
  document_number: z.string().nullable(),
  status: DocumentStatusEnum,
  reviewer_notes: z.string().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  reviewed_by: z.string().uuid().nullable(),
  expiry_date: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type KYCDocument = z.infer<typeof KYCDocumentSchema>;

// Document Review History Schema
export const DocumentReviewHistorySchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  old_status: DocumentStatusEnum.nullable(),
  new_status: DocumentStatusEnum,
  reviewer_notes: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type DocumentReviewHistory = z.infer<typeof DocumentReviewHistorySchema>;

// Notification Schema
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'success', 'warning', 'error']),
  link: z.string().nullable(),
  is_read: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  read_at: z.string().datetime().nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

// Document Upload Schema
export const DocumentUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size must be under 5 MB',
    })
    .refine(
      (file) =>
        [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'application/pdf',
          'application/docx',
          'application/xlsx',
          'application/csv',
        ].includes(file.type),
      {
        message: 'File must be JPEG, PNG, WEBP, PDF, DOCX, XLSX, or CSV',
      }
    ),
  document_type: DocumentTypeEnum,
  document_number: z.string().optional(),
});
export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;

// Document Review Schema
export const DocumentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional().default(''),
});
export type DocumentReview = z.infer<typeof DocumentReviewSchema>;

// Document Query Schema
export const DocumentQuerySchema = z.object({
  status: DocumentStatusEnum.optional(),
  user_id: z.string().uuid().optional(),
  document_type: DocumentTypeEnum.optional(),
});
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

// Employee Query Schema
export const EmployeeQuerySchema = z.object({
  employer_id: z.string().uuid().optional(),
  status: EmployeeStatusEnum.optional(),
  search: z.string().optional(),
});
export type EmployeeQuery = z.infer<typeof EmployeeQuerySchema>;

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

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

// ============================================================================
// RESPONSE TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_license: 'Driving License',
  kra_pin: 'KRA PIN Certificate',
  nhif_card: 'NHIF Card',
  nssf_card: 'NSSF Card',
  bank_statement: 'Bank Statement',
  payslip: 'Payslip',
  employment_letter: 'Employment Letter',
  employment_contract: 'Employment Contract',
  tax_certificate: 'Tax Compliance Certificate',
  utility_bill: 'Utility Bill (Proof of Address)',
  selfie: 'Selfie/Photo',
  face_id: 'Face ID Verification',
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

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/docx',
  'application/xlsx',
  'application/csv',
] as const;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DatabaseInsert<T> = Omit<
  T,
  'id' | 'created_at' | 'updated_at'
>;
export type DatabaseUpdate<T> = Partial<
  Omit<T, 'id' | 'created_at' | 'updated_at'>
>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateDocumentType(type: unknown): DocumentType {
  return DocumentTypeEnum.parse(type);
}

export function validateDocumentStatus(status: unknown): DocumentStatus {
  return DocumentStatusEnum.parse(status);
}

export function isAdminRole(role: UserRole): boolean {
  return ['admin', 'super_admin', 'compliance', 'employer_admin'].includes(role);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isKYCDocument(obj: unknown): obj is KYCDocument {
  return KYCDocumentSchema.safeParse(obj).success;
}

export function isEmployee(obj: unknown): obj is Employee {
  return EmployeeSchema.safeParse(obj).success;
}

export function isProfile(obj: unknown): obj is Profile {
  return ProfileSchema.safeParse(obj).success;
}
