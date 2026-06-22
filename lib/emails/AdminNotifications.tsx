/**
 * AdminNotifications.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All admin-facing transactional email templates for EaziWage.
 *
 * Exports:
 *   NewEmployerRegistrationEmail    – new employer signs up
 *   NewEmployeeRegistrationEmail    – new employee signs up
 *   EmployerOnboardingSubmittedEmail – employer submits KYC application
 *   NewKYCDocumentEmail             – employee uploads KYC document
 *   BankChangeRequestEmail          – employer requests bank detail change
 *   FraudAlertEmail                 – advance flagged by fraud engine
 *   WalletTopUpRequestEmail         – employer requests wallet top-up
 *   DocumentUploadNotificationEmail – generic doc upload from any party
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, {
  AlertBanner,
  MetaRow,
  StatusPill,
  InfoBox,
  styles,
} from './EmailLayout';

export interface NewEmployerRegistrationEmailProps {
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  country?: string;
  industry?: string;
  registeredAt?: string;
  dashboardUrl?: string;
}

export function NewEmployerRegistrationEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson = 'Jane Smith',
  contactEmail = 'jane@acme.com',
  contactPhone,
  country = 'Kenya',
  industry = 'Technology',
  registeredAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/admin/employers',
}: NewEmployerRegistrationEmailProps) {
  return (
    <EmailLayout
      previewText={`New employer registered: ${companyName}`}
      accentColor="#16a34a"
    >
      <AlertBanner variant="success" icon="🏢" label="New Employer Registration" />

      <Heading style={styles.heading}>A new employer has joined EaziWage</Heading>

      <Text style={styles.text}>
        <strong>{companyName}</strong> has created an employer account and will need to complete
        onboarding before they can go live. Review their details below.
      </Text>

      <InfoBox title="Registration Details">
        <MetaRow label="Company Name"    value={companyName} />
        <MetaRow label="Contact Person"  value={contactPerson} />
        <MetaRow label="Email"           value={contactEmail} />
        {contactPhone && <MetaRow label="Phone" value={contactPhone} />}
        <MetaRow label="Country"         value={country} />
        <MetaRow label="Industry"        value={industry} />
        <MetaRow label="Registered At"   value={registeredAt} />
        <MetaRow
          label="Status"
          value={<StatusPill label="Pending Onboarding" variant="yellow" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        They have been notified to complete their onboarding application. You can monitor progress
        or reach out to them directly from the admin dashboard.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Employer Profile
        </Button>
      </Section>

      <Text style={styles.mutedText}>
        This notification was triggered automatically upon account creation.
      </Text>
    </EmailLayout>
  );
}


export interface NewEmployeeRegistrationEmailProps {
  employeeName: string;
  employeeEmail: string;
  companyName?: string;
  companyCode?: string;
  country?: string;
  registeredAt?: string;
  dashboardUrl?: string;
}

export function NewEmployeeRegistrationEmail({
  employeeName = 'John Kamau',
  employeeEmail = 'john@example.com',
  companyName,
  companyCode,
  country = 'Kenya',
  registeredAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/admin/employees',
}: NewEmployeeRegistrationEmailProps) {
  return (
    <EmailLayout
      previewText={`New employee registered: ${employeeName}`}
      accentColor="#2563eb"
    >
      <AlertBanner variant="info" icon="👤" label="New Employee Registration" />

      <Heading style={styles.heading}>New employee account created</Heading>

      <Text style={styles.text}>
        <strong>{employeeName}</strong> has registered as an employee on EaziWage.
        {companyName
          ? ` They linked their account to ${companyName}.`
          : ' They have not yet linked to an employer.'}
      </Text>

      <InfoBox title="Employee Details">
        <MetaRow label="Full Name"       value={employeeName} />
        <MetaRow label="Email"           value={employeeEmail} />
        {companyName && <MetaRow label="Employer"   value={companyName} />}
        {companyCode && <MetaRow label="Company Code" value={companyCode} />}
        <MetaRow label="Country"         value={country} />
        <MetaRow label="Registered At"   value={registeredAt} />
        <MetaRow
          label="KYC Status"
          value={<StatusPill label="Pending Submission" variant="yellow" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        Their account is pending KYC verification. They will need to submit their identity
        documents before they can access wage advances.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Employee Profile
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface EmployerOnboardingSubmittedEmailProps {
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  country?: string;
  industry?: string;
  registrationNumber?: string;
  payrollCycle?: string;
  submittedAt?: string;
  onboardingId?: string;
  dashboardUrl?: string;
}

export function EmployerOnboardingSubmittedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson = 'Jane Smith',
  contactEmail = 'jane@acme.com',
  country = 'Kenya',
  industry = 'Technology',
  registrationNumber,
  payrollCycle = 'Monthly',
  submittedAt = new Date().toLocaleString(),
  onboardingId,
  dashboardUrl = 'https://app.eaziwage.com/admin/employers',
}: EmployerOnboardingSubmittedEmailProps) {
  return (
    <EmailLayout
      previewText={`Onboarding application submitted: ${companyName}`}
      accentColor="#7c3aed"
    >
      <AlertBanner variant="info" icon="📋" label="Onboarding Application Received" />

      <Heading style={styles.heading}>
        Employer onboarding application submitted
      </Heading>

      <Text style={styles.text}>
        <strong>{companyName}</strong> has completed and submitted their onboarding application.
        The application is ready for your compliance review.
      </Text>

      <InfoBox title="Application Summary">
        <MetaRow label="Company"              value={companyName} />
        <MetaRow label="Contact Person"       value={contactPerson} />
        <MetaRow label="Contact Email"        value={contactEmail} />
        <MetaRow label="Country"              value={country} />
        <MetaRow label="Industry"             value={industry} />
        {registrationNumber && (
          <MetaRow label="Reg. Number" value={registrationNumber} />
        )}
        <MetaRow label="Payroll Cycle"        value={payrollCycle} />
        <MetaRow label="Submitted At"         value={submittedAt} />
        {onboardingId && (
          <MetaRow label="Application ID" value={`#${onboardingId.slice(0, 8).toUpperCase()}`} />
        )}
        <MetaRow
          label="Status"
          value={<StatusPill label="Awaiting Review" variant="yellow" />}
        />
      </InfoBox>

      <InfoBox title="Review Checklist" variant="warn">
        <Text style={{ ...styles.mutedText, margin: '0 0 6px' }}>Before approving, ensure:</Text>
        {[
          'All required business documents are uploaded',
          'Registration and tax compliance certificates are valid',
          'Bank account details are verified',
          'Beneficial owner disclosures are complete',
          'Risk score assessment has been completed',
        ].map((item, i) => (
          <Row key={i} style={{ margin: '4px 0' }}>
            <Column style={{ width: '20px' }}>
              <Text style={{ ...styles.mutedText, margin: 0 }}>□</Text>
            </Column>
            <Column>
              <Text style={{ ...styles.mutedText, margin: 0 }}>{item}</Text>
            </Column>
          </Row>
        ))}
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Review Application
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface NewKYCDocumentEmailProps {
  employeeName: string;
  employeeEmail?: string;
  companyName?: string;
  documentType: string;
  documentNumber?: string;
  submittedAt?: string;
  totalDocuments?: number;
  allDocsSubmitted?: boolean;
  dashboardUrl?: string;
}

export function NewKYCDocumentEmail({
  employeeName = 'John Kamau',
  employeeEmail,
  companyName,
  documentType = 'national_id',
  documentNumber,
  submittedAt = new Date().toLocaleString(),
  totalDocuments = 1,
  allDocsSubmitted = false,
  dashboardUrl = 'https://app.eaziwage.com/admin/kyc',
}: NewKYCDocumentEmailProps) {
  const friendlyDocType = documentType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <EmailLayout
      previewText={`New KYC document uploaded by ${employeeName}`}
      accentColor="#0891b2"
    >
      <AlertBanner variant="info" icon="🪪" label="KYC Document Submitted" />

      <Heading style={styles.heading}>New KYC document requires review</Heading>

      <Text style={styles.text}>
        <strong>{employeeName}</strong> has uploaded a new document for identity verification.
        {allDocsSubmitted
          ? ' All required documents have now been submitted — the application is ready for a full review.'
          : ` They have submitted ${totalDocuments} document(s) so far.`}
      </Text>

      <InfoBox title="Document Details">
        <MetaRow label="Employee"       value={employeeName} />
        {employeeEmail && <MetaRow label="Email"    value={employeeEmail} />}
        {companyName   && <MetaRow label="Employer" value={companyName} />}
        <MetaRow label="Document Type"  value={friendlyDocType} />
        {documentNumber && <MetaRow label="Document No." value={documentNumber} />}
        <MetaRow label="Submitted At"   value={submittedAt} />
        <MetaRow
          label="Review Status"
          value={<StatusPill label="Pending Review" variant="yellow" />}
        />
      </InfoBox>

      {allDocsSubmitted && (
        <InfoBox variant="warn" title="All Documents Submitted">
          <Text style={{ ...styles.mutedText, margin: 0 }}>
            This employee has submitted all required documents. You can now perform a
            complete KYC review and approve or reject their application.
          </Text>
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Review KYC Documents
        </Button>
      </Section>
    </EmailLayout>
  );
}


export interface BankChangeRequestEmailProps {
  companyName: string;
  contactPerson?: string;
  contactEmail?: string;
  currentBankName?: string;
  currentAccountNumber?: string;
  requestedBankName: string;
  requestedAccountNumber: string;
  reason?: string;
  requestedAt?: string;
  requestId?: string;
  dashboardUrl?: string;
}

export function BankChangeRequestEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  contactEmail,
  currentBankName = 'Equity Bank',
  currentAccountNumber = '••••••7823',
  requestedBankName = 'KCB Bank',
  requestedAccountNumber = '1234567890',
  reason,
  requestedAt = new Date().toLocaleString(),
  requestId,
  dashboardUrl = 'https://app.eaziwage.com/admin/review-requests',
}: BankChangeRequestEmailProps) {
  return (
    <EmailLayout
      previewText={`Bank change request from ${companyName} — review required`}
      accentColor="#d97706"
    >
      <AlertBanner variant="warning" icon="🏦" label="Bank Details Change Request" />

      <Heading style={styles.heading}>Bank account change requested</Heading>

      <Text style={styles.text}>
        <strong>{companyName}</strong> has submitted a request to update their bank account
        details. This change will affect how advance repayments are processed. Please verify
        before approving.
      </Text>

      
      <Section style={{ margin: '20px 0' }}>
        <Row>
          <Column style={{ width: '48%', paddingRight: '8px' }}>
            <div style={styles.box}>
              <Text style={{ ...styles.infoBoxTitle, color: '#94a3b8' }}>Current Account</Text>
              <Hr style={{ ...styles.divider, margin: '8px 0' }} />
              <Text style={styles.mutedText}><strong>Bank:</strong></Text>
              <Text style={{ ...styles.text, margin: '0 0 8px' }}>{currentBankName}</Text>
              <Text style={styles.mutedText}><strong>Account:</strong></Text>
              <Text style={{ ...styles.text, margin: 0 }}>{currentAccountNumber}</Text>
            </div>
          </Column>
          <Column style={{ width: '4%' }}>
            <Text style={{ ...styles.text, textAlign: 'center', margin: '30px 0 0' }}>→</Text>
          </Column>
          <Column style={{ width: '48%', paddingLeft: '8px' }}>
            <div style={{ ...styles.box, borderColor: '#fde047', backgroundColor: '#fefce8' }}>
              <Text style={{ ...styles.infoBoxTitle, color: '#854d0e' }}>Requested Account</Text>
              <Hr style={{ ...styles.divider, margin: '8px 0', borderColor: '#fde047' }} />
              <Text style={styles.mutedText}><strong>Bank:</strong></Text>
              <Text style={{ ...styles.text, margin: '0 0 8px' }}>{requestedBankName}</Text>
              <Text style={styles.mutedText}><strong>Account:</strong></Text>
              <Text style={{ ...styles.text, margin: 0 }}>{requestedAccountNumber}</Text>
            </div>
          </Column>
        </Row>
      </Section>

      <InfoBox title="Request Details">
        <MetaRow label="Company"       value={companyName} />
        {contactPerson && <MetaRow label="Contact"  value={contactPerson} />}
        {contactEmail  && <MetaRow label="Email"    value={contactEmail} />}
        <MetaRow label="Requested At"  value={requestedAt} />
        {requestId && <MetaRow label="Request ID" value={`#${requestId.slice(0, 8).toUpperCase()}`} />}
        {reason && <MetaRow label="Reason Given" value={reason} />}
      </InfoBox>

      <InfoBox variant="warn">
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          ⚠️ Before approving, verify the new account details directly with{' '}
          {contactPerson || 'the employer'} via a secondary channel (phone/email).
          Do not rely solely on this request.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Review &amp; Approve Request
        </Button>
      </Section>
    </EmailLayout>
  );
}

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudAlertEmailProps {
  employeeName: string;
  employeeEmail?: string;
  employeeCode?: string;
  companyName: string;
  advanceAmount: number;
  currency?: string;
  flagType: string;
  severity: FraudSeverity;
  description: string;
  flags?: string[];
  triggeredAt?: string;
  advanceId?: string;
  dashboardUrl?: string;
}

export function FraudAlertEmail({
  employeeName = 'John Kamau',
  employeeEmail,
  employeeCode,
  companyName = 'Acme Corp Ltd',
  advanceAmount = 15000,
  currency = 'KES',
  flagType = 'velocity',
  severity = 'high',
  description = 'Multiple advance requests within a short period',
  flags = [],
  triggeredAt = new Date().toLocaleString(),
  advanceId,
  dashboardUrl = 'https://app.eaziwage.com/admin/fraud',
}: FraudAlertEmailProps) {
  const severityConfig: Record<FraudSeverity, { label: string; color: string; bg: string; accentColor: string; pill: 'red' | 'yellow' }> = {
    low:      { label: 'Low Risk',      color: '#854d0e', bg: '#fef9c3', accentColor: '#ca8a04', pill: 'yellow' },
    medium:   { label: 'Medium Risk',   color: '#92400e', bg: '#fef3c7', accentColor: '#d97706', pill: 'yellow' },
    high:     { label: 'High Risk',     color: '#991b1b', bg: '#fee2e2', accentColor: '#dc2626', pill: 'red'    },
    critical: { label: '🚨 CRITICAL',   color: '#7f1d1d', bg: '#fef2f2', accentColor: '#b91c1c', pill: 'red'    },
  };
  const cfg = severityConfig[severity];

  const friendlyFlagType = flagType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <EmailLayout
      previewText={`[${cfg.label}] Fraud flag: ${friendlyFlagType} — ${employeeName}`}
      accentColor={cfg.accentColor}
    >
      <div style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.accentColor}33`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>🚩</span>
        <div>
          <Text style={{ fontSize: '13px', fontWeight: 800, color: cfg.color, margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            Fraud Alert — {cfg.label}
          </Text>
          <Text style={{ fontSize: '13px', color: cfg.color, margin: '2px 0 0', opacity: 0.8 }}>
            {friendlyFlagType}
          </Text>
        </div>
      </div>

      <Heading style={styles.heading}>Advance flagged for review</Heading>

      <Text style={styles.text}>
        The fraud detection engine has flagged an advance request from <strong>{employeeName}</strong>{' '}
        at <strong>{companyName}</strong>. The advance has been placed on hold pending your review.
      </Text>

      <InfoBox title="Flagged Advance">
        <MetaRow label="Employee"      value={employeeName} />
        {employeeEmail && <MetaRow label="Email"    value={employeeEmail} />}
        {employeeCode  && <MetaRow label="Emp. Code" value={employeeCode} />}
        <MetaRow label="Employer"      value={companyName} />
        <MetaRow label="Amount"        value={`${currency} ${advanceAmount.toLocaleString()}`} />
        <MetaRow label="Flag Type"     value={friendlyFlagType} />
        <MetaRow
          label="Severity"
          value={<StatusPill label={cfg.label} variant={cfg.pill} />}
        />
        <MetaRow label="Triggered At"  value={triggeredAt} />
        {advanceId && (
          <MetaRow label="Advance ID"  value={`#${advanceId.slice(0, 8).toUpperCase()}`} />
        )}
      </InfoBox>

      <InfoBox variant="danger" title="Flag Description">
        <Text style={{ ...styles.text, margin: 0 }}>{description}</Text>
      </InfoBox>

      {flags.length > 0 && (
        <InfoBox title="Active Flags">
          {flags.map((flag, i) => (
            <Row key={i} style={{ margin: '4px 0' }}>
              <Column style={{ width: '16px' }}>
                <Text style={{ ...styles.mutedText, margin: 0, color: '#dc2626' }}>•</Text>
              </Column>
              <Column>
                <Text style={{ ...styles.mutedText, margin: 0 }}>{flag}</Text>
              </Column>
            </Row>
          ))}
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        <Button style={styles.buttonDanger} href={dashboardUrl}>
          Review Fraud Case
        </Button>
      </Section>

      <Text style={styles.mutedText}>
        The advance will remain on hold until you clear or confirm it from the fraud dashboard.
      </Text>
    </EmailLayout>
  );
}

export interface WalletTopUpRequestEmailProps {
  companyName: string;
  contactPerson?: string;
  contactEmail?: string;
  country?: string;
  riskRating?: string;
  requestedAmount: number;
  currency?: string;
  usdEquivalent?: number;
  currentBalance?: number;
  reference?: string;
  requestedAt?: string;
  adminWalletBalance?: number;
  dashboardUrl?: string;
}

export function WalletTopUpRequestEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  contactEmail,
  country = 'Kenya',
  riskRating = 'B',
  requestedAmount = 500000,
  currency = 'KES',
  usdEquivalent,
  currentBalance = 0,
  reference,
  requestedAt = new Date().toLocaleString(),
  adminWalletBalance,
  dashboardUrl = 'https://app.eaziwage.com/admin/wallet/topup-requests',
}: WalletTopUpRequestEmailProps) {
  const ratingPill: Record<string, 'green' | 'blue' | 'yellow' | 'red'> = {
    A: 'green', B: 'blue', C: 'yellow', D: 'red',
  };

  return (
    <EmailLayout
      previewText={`Wallet top-up request: ${companyName} — ${currency} ${requestedAmount.toLocaleString()}`}
      accentColor="#7c3aed"
    >
      <AlertBanner variant="info" icon="💰" label="Wallet Top-Up Request" />

      <Heading style={styles.heading}>Employer wallet top-up requested</Heading>

      <Text style={styles.text}>
        <strong>{companyName}</strong> has requested a wallet top-up of{' '}
        <strong>{currency} {requestedAmount.toLocaleString()}</strong>.
        This funds their advance disbursement pool. Review and approve from the admin dashboard.
      </Text>

      
      <Section style={{ backgroundColor: '#f5f3ff', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Requested Amount
        </Text>
        <Text style={{ fontSize: '32px', fontWeight: 800, color: '#4c1d95', margin: '4px 0', lineHeight: '1' }}>
          {currency} {requestedAmount.toLocaleString()}
        </Text>
        {usdEquivalent && (
          <Text style={{ fontSize: '14px', color: '#7c3aed', margin: '4px 0 0' }}>
            ≈ USD {usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        )}
      </Section>

      <InfoBox title="Employer Details">
        <MetaRow label="Company"         value={companyName} />
        {contactPerson && <MetaRow label="Contact"  value={contactPerson} />}
        {contactEmail  && <MetaRow label="Email"    value={contactEmail} />}
        <MetaRow label="Country"          value={country} />
        <MetaRow
          label="Risk Rating"
          value={<StatusPill label={`Rating ${riskRating}`} variant={ratingPill[riskRating] || 'gray'} />}
        />
        <MetaRow
          label="Current Balance"
          value={`${currency} ${currentBalance.toLocaleString()}`}
        />
        <MetaRow label="Requested At"     value={requestedAt} />
        {reference && <MetaRow label="Reference" value={reference} />}
      </InfoBox>

      {adminWalletBalance !== undefined && (
        <InfoBox title="Admin Wallet Status" variant={adminWalletBalance < requestedAmount ? 'danger' : 'default'}>
          <MetaRow
            label="Stanbic Source Balance"
            value={`USD ${adminWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          />
          {adminWalletBalance < requestedAmount && (
            <Text style={{ ...styles.mutedText, color: '#991b1b', margin: '8px 0 0' }}>
              ⚠️ Requested amount exceeds current admin wallet balance. Sync balance before approving.
            </Text>
          )}
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Approve Top-Up Request
        </Button>
      </Section>
    </EmailLayout>
  );
}
export type DocumentUploaderRole = 'employee' | 'employer';

export interface DocumentUploadNotificationEmailProps {
  uploaderName: string;
  uploaderEmail?: string;
  uploaderRole: DocumentUploaderRole;
  companyName?: string;
  documentType: string;
  documentCount?: number;
  uploadedAt?: string;
  storageSize?: string;
  dashboardUrl?: string;
}

export function DocumentUploadNotificationEmail({
  uploaderName = 'John Kamau',
  uploaderEmail,
  uploaderRole = 'employee',
  companyName,
  documentType = 'national_id',
  documentCount = 1,
  uploadedAt = new Date().toLocaleString(),
  storageSize,
  dashboardUrl = 'https://app.eaziwage.com/admin/kyc',
}: DocumentUploadNotificationEmailProps) {
  const friendlyDocType = documentType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const roleLabel = uploaderRole === 'employer' ? 'Employer' : 'Employee';
  const roleAccent = uploaderRole === 'employer' ? '#7c3aed' : '#0891b2';

  return (
    <EmailLayout
      previewText={`Document uploaded: ${friendlyDocType} by ${uploaderName}`}
      accentColor={roleAccent}
    >
      <AlertBanner
        variant={uploaderRole === 'employer' ? 'info' : 'info'}
        icon="📎"
        label={`${roleLabel} Document Upload`}
      />

      <Heading style={styles.heading}>New document uploaded for review</Heading>

      <Text style={styles.text}>
        <strong>{uploaderName}</strong>{' '}
        {companyName ? `from ${companyName}` : ''} has uploaded{' '}
        {documentCount > 1 ? `${documentCount} documents` : `a new document`}{' '}
        that requires your review.
      </Text>

      <InfoBox title="Upload Details">
        <MetaRow label={roleLabel}        value={uploaderName} />
        {uploaderEmail && <MetaRow label="Email"      value={uploaderEmail} />}
        {companyName   && <MetaRow label="Company"    value={companyName} />}
        <MetaRow label="Document Type"    value={friendlyDocType} />
        <MetaRow label="Documents"        value={`${documentCount} file${documentCount !== 1 ? 's' : ''}`} />
        {storageSize && <MetaRow label="File Size"   value={storageSize} />}
        <MetaRow label="Uploaded At"      value={uploadedAt} />
        <MetaRow
          label="Review Status"
          value={<StatusPill label="Pending Review" variant="yellow" />}
        />
      </InfoBox>

      <Section style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px 20px', margin: '16px 0' }}>
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          {uploaderRole === 'employer'
            ? `Review and verify this document as part of ${companyName || "the employer's"} KYC application.`
            : `Review and verify this document as part of ${uploaderName}'s identity verification.`}
        </Text>
      </Section>

      <Section style={styles.buttonContainer}>
        <Button style={{ ...styles.button, backgroundColor: roleAccent }} href={dashboardUrl}>
          Review Document
        </Button>
      </Section>
    </EmailLayout>
  );
}

export { NewKYCDocumentEmail as DocumentApprovedEmail };