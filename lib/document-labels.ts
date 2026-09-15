export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  face_id: 'Biometric Face Scan',
  national_id: 'National ID Card',
  passport: 'Passport',
  drivers_license: "Driver's License",
  utility_bill: 'Utility Bill (Proof of Address)',
  id_front: 'National ID (Front)',
  id_back: 'National ID (Back)',
  address_proof: 'Proof of Address',
  tax_certificate: 'Tax Compliance Certificate',
  payslip: 'Recent Payslip',
  payslip_1: 'Latest Payslip',
  payslip_2: 'Previous Payslip',
  bank_statement: 'Bank Statement',
  employment_contract: 'Employment Contract',
  certificate_of_incorporation: 'Certificate of Incorporation',
  business_registration: 'Business Registration',
  tax_compliance_certificate: 'Tax Compliance Certificate',
  cr12_document: 'Registered Company/Shareholders',
  kra_pin_certificate: 'KRA PIN Certificate',
  business_permit: 'Business Permit',
  audited_financials: 'Audited Financials',
  transaction_history: 'Transaction History',
  proof_of_address: 'Proof of Address',
  proof_of_bank_account: 'Proof of Bank Account',
  employment_contract_template: 'Employment Contract Template',
};

export function getDocumentLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
