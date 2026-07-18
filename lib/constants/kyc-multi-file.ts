/**
 * KYC document types that accept multiple files (financial documents only —
 * per product decision 2026-07-18). Extra files are stored as "supporting
 * attachments" in employer_kyc_documents.additional_files /
 * employee_kyc_documents.additional_files — they never create additional
 * reviewable rows, so the required-N counting in the recompute triggers and
 * the one-status-per-type admin review are unaffected.
 */

export const EMPLOYER_MULTI_FILE_TYPES = [
  'audited_financials',
  'bank_statement',
  'proof_of_bank_account',
] as const;

export const EMPLOYEE_MULTI_FILE_TYPES = [
  'bank_statement',
  'payslip_1',
  'payslip_2',
] as const;

export type EmployerMultiFileType = (typeof EMPLOYER_MULTI_FILE_TYPES)[number];
export type EmployeeMultiFileType = (typeof EMPLOYEE_MULTI_FILE_TYPES)[number];

export function isEmployerMultiFileType(t: string): boolean {
  return (EMPLOYER_MULTI_FILE_TYPES as readonly string[]).includes(t);
}

export function isEmployeeMultiFileType(t: string): boolean {
  return (EMPLOYEE_MULTI_FILE_TYPES as readonly string[]).includes(t);
}

/** Shape of one supporting-attachment entry in the additional_files jsonb array. */
export interface KycAdditionalFile {
  url: string;
  storage_path: string;
  name: string;
  uploaded_at: string;
}
