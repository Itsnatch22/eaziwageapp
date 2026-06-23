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

export interface NewEmployeeLinkedEmailProps {
  companyName: string;
  employeeName: string;
  employeeCode?: string;
  employeeEmail?: string;
  department?: string;
  jobTitle?: string;
  linkedAt?: string;
  dashboardUrl?: string;
}

export function NewEmployeeLinkedEmail({
  companyName = 'Acme Corp Ltd',
  employeeName = 'John Kamau',
  employeeCode,
  employeeEmail,
  department,
  jobTitle,
  linkedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/employees',
}: NewEmployeeLinkedEmailProps) {
  return (
    <EmailLayout
      previewText={`New employee linked: ${employeeName} has joined ${companyName} on EaziWage`}
      accentColor="#2563eb"
    >
      <AlertBanner variant="info" icon="👤" label="New Employee Linked" />

      <Heading style={styles.heading}>A new employee has joined your account</Heading>

      <Text style={styles.text}>
        <strong>{employeeName}</strong> has linked their EaziWage account to{' '}
        <strong>{companyName}</strong>. They will need to complete KYC verification before
        they can access earned wage advances.
      </Text>

      <InfoBox title="Employee Details">
        <MetaRow label="Full Name"     value={employeeName} />
        {employeeCode  && <MetaRow label="Employee Code" value={employeeCode} />}
        {employeeEmail && <MetaRow label="Email"         value={employeeEmail} />}
        {department    && <MetaRow label="Department"    value={department} />}
        {jobTitle      && <MetaRow label="Job Title"     value={jobTitle} />}
        <MetaRow label="Linked At"     value={linkedAt} />
        <MetaRow
          label="KYC Status"
          value={<StatusPill label="Pending Submission" variant="yellow" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        You can view and manage this employee from your dashboard. Their advance access
        will be activated once KYC is verified by our compliance team.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Employee
        </Button>
      </Section>

      <Text style={styles.mutedText}>
        This notification was sent because a new employee linked to your {companyName} account.
      </Text>
    </EmailLayout>
  );
}
export interface EmployeeKYCSubmittedEmailProps {
  companyName: string;
  employeeName: string;
  employeeCode?: string;
  documentTypes?: string[];
  submittedAt?: string;
  dashboardUrl?: string;
}

export function EmployeeKYCSubmittedEmail({
  employeeName = 'John Kamau',
  employeeCode,
  documentTypes = ['National ID'],
  submittedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/employees',
}: EmployeeKYCSubmittedEmailProps) {
  return (
    <EmailLayout
      previewText={`${employeeName} submitted their KYC documents for verification`}
      accentColor="#0891b2"
    >
      <AlertBanner variant="info" icon="🪪" label="Employee KYC Submitted" />

      <Heading style={styles.heading}>Employee KYC documents submitted</Heading>

      <Text style={styles.text}>
        <strong>{employeeName}</strong> has submitted their identity documents for KYC
        verification. Our compliance team will review the submission and update their
        status within 1–2 business days.
      </Text>

      <InfoBox title="Submission Summary">
        <MetaRow label="Employee"      value={employeeName} />
        {employeeCode && <MetaRow label="Employee Code" value={employeeCode} />}
        <MetaRow label="Documents"     value={documentTypes.join(', ')} />
        <MetaRow label="Submitted At"  value={submittedAt} />
        <MetaRow
          label="Review Status"
          value={<StatusPill label="Under Review" variant="yellow" />}
        />
      </InfoBox>

      <InfoBox variant="default" title="What happens next?">
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          Our compliance team will verify the submitted documents. You will receive an email
          once the review is complete. No action is required from you at this stage.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Employee Profile
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface EmployeeKYCApprovedEmailProps {
  companyName: string;
  employeeName: string;
  employeeCode?: string;
  approvedAt?: string;
  maxAdvancePercentage?: number;
  currency?: string;
  dashboardUrl?: string;
}

export function EmployeeKYCApprovedEmail({
  companyName = 'Acme Corp Ltd',
  employeeName = 'John Kamau',
  employeeCode,
  approvedAt = new Date().toLocaleString(),
  maxAdvancePercentage = 50,
  currency = 'KES',
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/employees',
}: EmployeeKYCApprovedEmailProps) {
  return (
    <EmailLayout
      previewText={`${employeeName}'s KYC has been approved — advance access is now active`}
      accentColor="#16a34a"
    >
      <AlertBanner variant="success" icon="✅" label="Employee KYC Approved" />

      <Heading style={styles.heading}>Employee KYC approved — advance access active</Heading>

      <Text style={styles.text}>
        <strong>{employeeName}</strong> from <strong>{companyName}</strong> has passed KYC
        verification. They can now submit earned wage advance requests within the limits
        you have configured.
      </Text>

      <InfoBox title="Approval Details">
        <MetaRow label="Employee"       value={employeeName} />
        {employeeCode && <MetaRow label="Employee Code" value={employeeCode} />}
        <MetaRow label="Approved At"    value={approvedAt} />
        <MetaRow label="Advance Access" value={`Up to ${maxAdvancePercentage}% of monthly salary (${currency})`} />
        <MetaRow
          label="Status"
          value={<StatusPill label="KYC Approved" variant="green" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        You can adjust this employee&apos;s EWA settings — including their individual advance
        cap and cooldown period — from your employee management dashboard.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Manage EWA Settings
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface EmployeeKYCRejectedEmailProps {
  companyName: string;
  employeeName: string;
  employeeCode?: string;
  rejectedAt?: string;
  reason?: string;
  canResubmit?: boolean;
  dashboardUrl?: string;
}

export function EmployeeKYCRejectedEmail({
  companyName = 'Acme Corp Ltd',
  employeeName = 'John Kamau',
  employeeCode,
  rejectedAt = new Date().toLocaleString(),
  reason,
  canResubmit = true,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/employees',
}: EmployeeKYCRejectedEmailProps) {
  return (
    <EmailLayout
      previewText={`${employeeName}'s KYC was not approved — review required`}
      accentColor="#dc2626"
    >
      <AlertBanner variant="danger" icon="❌" label="Employee KYC Rejected" />

      <Heading style={styles.heading}>Employee KYC was not approved</Heading>

      <Text style={styles.text}>
        Unfortunately, <strong>{employeeName}</strong>&apos;s KYC application for{' '}
        <strong>{companyName}</strong> did not meet our verification requirements and has
        been rejected. Their advance access remains disabled.
      </Text>

      <InfoBox title="Rejection Details">
        <MetaRow label="Employee"      value={employeeName} />
        {employeeCode && <MetaRow label="Employee Code" value={employeeCode} />}
        <MetaRow label="Rejected At"   value={rejectedAt} />
        {reason && <MetaRow label="Reason"         value={reason} />}
        <MetaRow
          label="Status"
          value={<StatusPill label="KYC Rejected" variant="red" />}
        />
      </InfoBox>

      {canResubmit && (
        <InfoBox variant="warn" title="Next Steps">
          <Text style={{ ...styles.mutedText, margin: 0 }}>
            Please inform {employeeName} that they may resubmit their documents with
            corrections. Ensure the ID is valid, legible, and unexpired before
            resubmission. Contact our support team if you need clarification on the
            rejection reason.
          </Text>
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Employee Profile
        </Button>
      </Section>
    </EmailLayout>
  );
}
export type RiskRating = 'A' | 'B' | 'C' | 'D';

export interface RiskProfileUpdatedEmailProps {
  companyName: string;
  contactPerson?: string;
  previousScore?: number;
  newScore: number;
  previousRating?: RiskRating;
  newRating: RiskRating;
  applicationFee?: number;
  updatedAt?: string;
  dashboardUrl?: string;
}

export function RiskProfileUpdatedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  previousScore,
  newScore = 3.5,
  previousRating,
  newRating = 'B',
  applicationFee,
  updatedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/risk-insights',
}: RiskProfileUpdatedEmailProps) {
  const ratingPill: Record<RiskRating, 'green' | 'blue' | 'yellow' | 'red'> = {
    A: 'green', B: 'blue', C: 'yellow', D: 'red',
  };

  const direction = previousScore !== undefined
    ? newScore > previousScore ? '↑ Improved' : newScore < previousScore ? '↓ Declined' : '→ Unchanged'
    : null;

  return (
    <EmailLayout
      previewText={`Your risk profile has been updated — Rating: ${newRating} (Score: ${newScore.toFixed(1)})`}
      accentColor="#7c3aed"
    >
      <AlertBanner variant="info" icon="📊" label="Risk Profile Updated" />

      <Heading style={styles.heading}>Your risk profile has been updated</Heading>

      <Text style={styles.text}>
        EaziWage&apos;s compliance team has completed a review of <strong>{companyName}</strong>&apos;s
        risk profile. Your updated score and rating are shown below.
      </Text>

      
      <Section style={{ backgroundColor: '#f5f3ff', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Composite Risk Score
        </Text>
        <Text style={{ fontSize: '40px', fontWeight: 800, color: '#4c1d95', margin: '4px 0', lineHeight: '1' }}>
          {newScore.toFixed(1)}<span style={{ fontSize: '18px', color: '#7c3aed' }}>/5.0</span>
        </Text>
        {direction && (
          <Text style={{ fontSize: '14px', color: '#7c3aed', margin: '4px 0 0' }}>
            {direction}{previousScore !== undefined ? ` from ${previousScore.toFixed(1)}` : ''}
          </Text>
        )}
      </Section>

      <InfoBox title="Updated Profile">
        <MetaRow label="Company"       value={companyName} />
        {contactPerson && <MetaRow label="Contact" value={contactPerson} />}
        {previousRating && <MetaRow label="Previous Rating" value={<StatusPill label={`Rating ${previousRating}`} variant={ratingPill[previousRating]} />} />}
        <MetaRow
          label="New Rating"
          value={<StatusPill label={`Rating ${newRating}`} variant={ratingPill[newRating]} />}
        />
        <MetaRow label="New Score"     value={`${newScore.toFixed(2)} / 5.00`} />
        {applicationFee !== undefined && (
          <MetaRow label="Application Fee" value={`${applicationFee.toFixed(2)}% per advance`} />
        )}
        <MetaRow label="Updated At"    value={updatedAt} />
      </InfoBox>

      <InfoBox title="What does this mean?">
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          Your risk rating determines the fee applied to each earned wage advance disbursed
          through EaziWage. A higher score (closer to 5.0) reflects stronger compliance,
          financial health, and operational stability — and results in lower platform fees.
          You can request a review if you believe the assessment is inaccurate.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Risk Insights
        </Button>
      </Section>
    </EmailLayout>
  );
}

export type EmployerStatus = 'approved' | 'suspended' | 'rejected' | 'pending' | 'under_review';

export interface EmployerStatusChangeEmailProps {
  companyName: string;
  contactPerson?: string;
  previousStatus?: EmployerStatus;
  newStatus: EmployerStatus;
  reason?: string;
  effectiveAt?: string;
  supportUrl?: string;
  dashboardUrl?: string;
}

export function EmployerStatusChangeEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  previousStatus,
  newStatus = 'approved',
  reason,
  effectiveAt = new Date().toLocaleString(),
  supportUrl = 'https://app.eaziwage.com/support',
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard',
}: EmployerStatusChangeEmailProps) {
  const statusConfig: Record<EmployerStatus, {
    label: string;
    variant: 'green' | 'yellow' | 'red' | 'blue';
    banner: 'success' | 'warning' | 'danger' | 'info';
    icon: string;
    accentColor: string;
    bodyText: string;
  }> = {
    approved: {
      label: 'Approved',
      variant: 'green',
      banner: 'success',
      icon: '✅',
      accentColor: '#16a34a',
      bodyText: `Great news! ${companyName} has been approved on EaziWage. Your employees can now access earned wage advances. Log in to your dashboard to manage your workforce and advance settings.`,
    },
    suspended: {
      label: 'Suspended',
      variant: 'yellow',
      banner: 'warning',
      icon: '⚠️',
      accentColor: '#d97706',
      bodyText: `Your account has been temporarily suspended. Advance disbursements are paused until the suspension is lifted. Please contact our support team to resolve any outstanding issues.`,
    },
    rejected: {
      label: 'Rejected',
      variant: 'red',
      banner: 'danger',
      icon: '❌',
      accentColor: '#dc2626',
      bodyText: `Unfortunately, ${companyName}'s application has not been approved at this time. Please review the reason provided below and contact our team if you wish to appeal or reapply.`,
    },
    pending: {
      label: 'Pending Review',
      variant: 'yellow',
      banner: 'info',
      icon: '⏳',
      accentColor: '#2563eb',
      bodyText: `Your application is currently pending review by our compliance team. We will notify you once a decision has been made.`,
    },
    under_review: {
      label: 'Under Review',
      variant: 'blue',
      banner: 'info',
      icon: '🔍',
      accentColor: '#0891b2',
      bodyText: `${companyName}'s account is currently under compliance review. Advance disbursements may be temporarily limited. Our team will contact you with further information.`,
    },
  };

  const cfg = statusConfig[newStatus];

  return (
    <EmailLayout
      previewText={`Account status update: ${companyName} is now ${cfg.label}`}
      accentColor={cfg.accentColor}
    >
      <AlertBanner variant={cfg.banner} icon={cfg.icon} label={`Account ${cfg.label}`} />

      <Heading style={styles.heading}>Your account status has changed</Heading>

      <Text style={styles.text}>
        {contactPerson ? `Hi ${contactPerson}, ` : ''}{cfg.bodyText}
      </Text>

      <InfoBox title="Status Update">
        <MetaRow label="Company"       value={companyName} />
        {previousStatus && (
          <MetaRow
            label="Previous Status"
            value={<StatusPill label={statusConfig[previousStatus].label} variant={statusConfig[previousStatus].variant} />}
          />
        )}
        <MetaRow
          label="New Status"
          value={<StatusPill label={cfg.label} variant={cfg.variant} />}
        />
        <MetaRow label="Effective At"  value={effectiveAt} />
        {reason && <MetaRow label="Reason"        value={reason} />}
      </InfoBox>

      {(newStatus === 'suspended' || newStatus === 'rejected') && (
        <InfoBox variant="warn" title="Need Help?">
          <Text style={{ ...styles.mutedText, margin: 0 }}>
            If you believe this decision was made in error or you need clarification, please
            contact our support team. We&apos;re here to help resolve any outstanding concerns.
          </Text>
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        {newStatus === 'approved' ? (
          <Button style={styles.button} href={dashboardUrl}>
            Go to Dashboard
          </Button>
        ) : (
          <Button style={{ ...styles.button, backgroundColor: cfg.accentColor }} href={supportUrl}>
            Contact Support
          </Button>
        )}
      </Section>
    </EmailLayout>
  );
}

export interface BankDetailsChangeOutcomeEmailProps {
  companyName: string;
  contactPerson?: string;
  outcome: 'approved' | 'rejected';
  requestedBankName: string;
  requestedAccountNumber: string;
  currentBankName?: string;
  reason?: string;
  effectiveAt?: string;
  supportUrl?: string;
  dashboardUrl?: string;
}

export function BankDetailsChangeOutcomeEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  outcome = 'approved',
  requestedBankName = 'KCB Bank',
  requestedAccountNumber = '••••••1234',
  currentBankName,
  reason,
  effectiveAt = new Date().toLocaleString(),
  supportUrl = 'https://app.eaziwage.com/support',
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/settings',
}: BankDetailsChangeOutcomeEmailProps) {
  const isApproved = outcome === 'approved';

  return (
    <EmailLayout
      previewText={`Bank details change ${isApproved ? 'approved' : 'rejected'} for ${companyName}`}
      accentColor={isApproved ? '#16a34a' : '#dc2626'}
    >
      <AlertBanner
        variant={isApproved ? 'success' : 'danger'}
        icon={isApproved ? '🏦' : '❌'}
        label={`Bank Change ${isApproved ? 'Approved' : 'Rejected'}`}
      />

      <Heading style={styles.heading}>
        Bank details change {isApproved ? 'approved' : 'not approved'}
      </Heading>

      <Text style={styles.text}>
        {isApproved
          ? `Your request to update bank details for ${companyName} has been reviewed and approved. Advance repayments will now be directed to the new account.`
          : `Your request to update bank details for ${companyName} has been reviewed and could not be approved at this time.`}
      </Text>

      <InfoBox title="Request Summary">
        <MetaRow label="Company"          value={companyName} />
        {contactPerson && <MetaRow label="Contact" value={contactPerson} />}
        {currentBankName && !isApproved && (
          <MetaRow label="Existing Bank"   value={currentBankName} />
        )}
        <MetaRow label="Requested Bank"    value={requestedBankName} />
        <MetaRow label="Account Number"    value={requestedAccountNumber} />
        <MetaRow
          label="Decision"
          value={<StatusPill label={isApproved ? 'Approved' : 'Rejected'} variant={isApproved ? 'green' : 'red'} />}
        />
        <MetaRow label="Effective At"      value={effectiveAt} />
        {reason && <MetaRow label="Reason"            value={reason} />}
      </InfoBox>

      {!isApproved && (
        <InfoBox variant="warn" title="What to do next">
          <Text style={{ ...styles.mutedText, margin: 0 }}>
            If you believe this was an error, please contact our support team with your
            bank verification documents. Do not submit another request until you have
            spoken to a member of our team.
          </Text>
        </InfoBox>
      )}

      <Section style={styles.buttonContainer}>
        <Button
          style={isApproved ? styles.button : { ...styles.button, backgroundColor: '#dc2626' }}
          href={isApproved ? dashboardUrl : supportUrl}
        >
          {isApproved ? 'View Settings' : 'Contact Support'}
        </Button>
      </Section>
    </EmailLayout>
  );
}
export interface RiskReviewCompletedEmailProps {
  companyName: string;
  contactPerson?: string;
  outcome: 'improved' | 'unchanged' | 'declined';
  newScore: number;
  newRating: RiskRating;
  newApplicationFee?: number;
  reviewNotes?: string;
  completedAt?: string;
  dashboardUrl?: string;
}

export function RiskReviewCompletedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  outcome = 'unchanged',
  newScore = 3.5,
  newRating = 'B',
  newApplicationFee,
  reviewNotes,
  completedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/risk-insights',
}: RiskReviewCompletedEmailProps) {
  const outcomeConfig = {
    improved:  { label: 'Score Improved',   variant: 'green'  as const, icon: '📈', color: '#16a34a' },
    unchanged: { label: 'Score Unchanged',  variant: 'blue'   as const, icon: '📊', color: '#2563eb' },
    declined:  { label: 'Score Declined',   variant: 'red'    as const, icon: '📉', color: '#dc2626' },
  };

  const cfg = outcomeConfig[outcome];
  const ratingPill: Record<RiskRating, 'green' | 'blue' | 'yellow' | 'red'> = {
    A: 'green', B: 'blue', C: 'yellow', D: 'red',
  };

  return (
    <EmailLayout
      previewText={`Risk review completed for ${companyName} — New rating: ${newRating}`}
      accentColor={cfg.color}
    >
      <AlertBanner variant="info" icon={cfg.icon} label="Risk Review Completed" />

      <Heading style={styles.heading}>Your risk review has been completed</Heading>

      <Text style={styles.text}>
        {contactPerson ? `Hi ${contactPerson}, ` : ''}EaziWage has completed the risk review
        you requested for <strong>{companyName}</strong>. Your updated risk profile is
        reflected below.
      </Text>

      
      <Section style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Updated Risk Score
        </Text>
        <Text style={{ fontSize: '40px', fontWeight: 800, color: '#0f172a', margin: '4px 0', lineHeight: '1' }}>
          {newScore.toFixed(1)}<span style={{ fontSize: '18px', color: '#64748b' }}>/5.0</span>
        </Text>
        <Text style={{ fontSize: '14px', color: cfg.color, fontWeight: 700, margin: '4px 0 0' }}>
          {cfg.icon} {cfg.label}
        </Text>
      </Section>

      <InfoBox title="Review Outcome">
        <MetaRow label="Company"         value={companyName} />
        <MetaRow
          label="New Rating"
          value={<StatusPill label={`Rating ${newRating}`} variant={ratingPill[newRating]} />}
        />
        <MetaRow label="Composite Score" value={`${newScore.toFixed(2)} / 5.00`} />
        {newApplicationFee !== undefined && (
          <MetaRow label="Platform Fee"  value={`${newApplicationFee.toFixed(2)}% per advance`} />
        )}
        <MetaRow label="Completed At"    value={completedAt} />
      </InfoBox>

      {reviewNotes && (
        <InfoBox title="Reviewer Notes">
          <Text style={{ ...styles.mutedText, margin: 0 }}>{reviewNotes}</Text>
        </InfoBox>
      )}

      <Text style={styles.text}>
        Your risk rating directly affects the fee applied to each advance disbursement. If
        you have questions about the outcome, you can request a detailed breakdown from our
        risk team.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Full Risk Report
        </Button>
      </Section>
    </EmailLayout>
  );
}
export interface WalletTopUpApprovedEmailProps {
  companyName: string;
  contactPerson?: string;
  approvedAmount: number;
  currency?: string;
  newBalance?: number;
  reference?: string;
  approvedAt?: string;
  dashboardUrl?: string;
}

export function WalletTopUpApprovedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  approvedAmount = 500000,
  currency = 'KES',
  newBalance,
  reference,
  approvedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/wallet',
}: WalletTopUpApprovedEmailProps) {
  return (
    <EmailLayout
      previewText={`Wallet top-up approved: ${currency} ${approvedAmount.toLocaleString()} added to ${companyName}`}
      accentColor="#16a34a"
    >
      <AlertBanner variant="success" icon="💰" label="Wallet Top-Up Approved" />

      <Heading style={styles.heading}>Your wallet has been topped up</Heading>

      <Text style={styles.text}>
        {contactPerson ? `Hi ${contactPerson}, ` : ''}The wallet top-up request for{' '}
        <strong>{companyName}</strong> has been approved and the funds are now available
        for employee advance disbursements.
      </Text>

      
      <Section style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Amount Added
        </Text>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: '#14532d', margin: '4px 0', lineHeight: '1' }}>
          {currency} {approvedAmount.toLocaleString()}
        </Text>
        {newBalance !== undefined && (
          <Text style={{ fontSize: '14px', color: '#16a34a', margin: '4px 0 0' }}>
            New balance: {currency} {newBalance.toLocaleString()}
          </Text>
        )}
      </Section>

      <InfoBox title="Transaction Details">
        <MetaRow label="Company"        value={companyName} />
        <MetaRow label="Amount Added"   value={`${currency} ${approvedAmount.toLocaleString()}`} />
        {newBalance !== undefined && (
          <MetaRow label="New Balance"  value={`${currency} ${newBalance.toLocaleString()}`} />
        )}
        {reference && <MetaRow label="Reference"   value={reference} />}
        <MetaRow label="Approved At"    value={approvedAt} />
        <MetaRow
          label="Status"
          value={<StatusPill label="Approved" variant="green" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        Your employees can now request advances up to their configured limits. Funds are
        deducted from this balance with each approved disbursement.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Wallet
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface AdvanceRequestReceivedEmailProps {
  companyName: string;
  contactPerson?: string;
  employeeName: string;
  employeeCode?: string;
  requestedAmount: number;
  currency?: string;
  disbursementMethod?: string;
  requestedAt?: string;
  advanceId?: string;
  dashboardUrl?: string;
}

export function AdvanceRequestReceivedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  employeeName = 'John Kamau',
  employeeCode,
  requestedAmount = 15000,
  currency = 'KES',
  disbursementMethod = 'M-PESA',
  requestedAt = new Date().toLocaleString(),
  advanceId,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/advances',
}: AdvanceRequestReceivedEmailProps) {
  return (
    <EmailLayout
      previewText={`New advance request: ${employeeName} — ${currency} ${requestedAmount.toLocaleString()}`}
      accentColor="#2563eb"
    >
      <AlertBanner variant="info" icon="💳" label="New Advance Request" />

      <Heading style={styles.heading}>An employee has requested an advance</Heading>

      <Text style={styles.text}>
        {contactPerson ? `Hi ${contactPerson}, ` : ''}<strong>{employeeName}</strong> at{' '}
        <strong>{companyName}</strong> has submitted an earned wage advance request.
        Review and action it from your advances dashboard.
      </Text>

      
      <Section style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Requested Amount
        </Text>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: '#1e3a8a', margin: '4px 0', lineHeight: '1' }}>
          {currency} {requestedAmount.toLocaleString()}
        </Text>
      </Section>

      <InfoBox title="Request Details">
        <MetaRow label="Employee"            value={employeeName} />
        {employeeCode && <MetaRow label="Employee Code"   value={employeeCode} />}
        <MetaRow label="Requested Amount"    value={`${currency} ${requestedAmount.toLocaleString()}`} />
        <MetaRow label="Disbursement Method" value={disbursementMethod} />
        <MetaRow label="Requested At"        value={requestedAt} />
        {advanceId && (
          <MetaRow label="Advance ID"        value={`#${advanceId.slice(0, 8).toUpperCase()}`} />
        )}
        <MetaRow
          label="Status"
          value={<StatusPill label="Pending Review" variant="yellow" />}
        />
      </InfoBox>

      <InfoBox variant="warn" title="Action Required">
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          This request is awaiting your approval. Log in to review the employee&apos;s
          eligibility and approve or deny the advance. Requests not actioned within
          48 hours may expire.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Review Advance Request
        </Button>
      </Section>
    </EmailLayout>
  );
}
export interface WalletFundedEmailProps {
  companyName: string;
  contactPerson?: string;
  fundedAmount: number;
  currency?: string;
  newBalance: number;
  previousBalance?: number;
  fundingSource?: string;
  reference?: string;
  fundedAt?: string;
  dashboardUrl?: string;
}

export function WalletFundedEmail({
  companyName = 'Acme Corp Ltd',
  contactPerson,
  fundedAmount = 1000000,
  currency = 'KES',
  newBalance = 1000000,
  previousBalance,
  fundingSource = 'Bank Transfer',
  reference,
  fundedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employer-dashboard/wallet',
}: WalletFundedEmailProps) {
  return (
    <EmailLayout
      previewText={`Wallet funded: ${currency} ${fundedAmount.toLocaleString()} received — ${companyName}`}
      accentColor="#16a34a"
    >
      <AlertBanner variant="success" icon="✅" label="Wallet Funded" />

      <Heading style={styles.heading}>Your EaziWage wallet has been funded</Heading>

      <Text style={styles.text}>
        {contactPerson ? `Hi ${contactPerson}, ` : ''}Funds have been successfully
        received and credited to <strong>{companyName}</strong>&apos;s EaziWage wallet.
        Your employees&apos; advance requests can now be processed immediately.
      </Text>

      
      <Section style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '24px', margin: '20px 0' }}>
        <Row>
          <Column style={{ textAlign: 'center' as const, borderRight: '1px solid #bbf7d0', paddingRight: '20px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
              Amount Received
            </Text>
            <Text style={{ fontSize: '28px', fontWeight: 800, color: '#14532d', margin: 0, lineHeight: '1.1' }}>
              {currency} {fundedAmount.toLocaleString()}
            </Text>
          </Column>
          <Column style={{ textAlign: 'center' as const, paddingLeft: '20px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
              New Balance
            </Text>
            <Text style={{ fontSize: '28px', fontWeight: 800, color: '#14532d', margin: 0, lineHeight: '1.1' }}>
              {currency} {newBalance.toLocaleString()}
            </Text>
          </Column>
        </Row>
      </Section>

      <InfoBox title="Transaction Summary">
        <MetaRow label="Company"          value={companyName} />
        <MetaRow label="Amount Credited"  value={`${currency} ${fundedAmount.toLocaleString()}`} />
        {previousBalance !== undefined && (
          <MetaRow label="Previous Balance" value={`${currency} ${previousBalance.toLocaleString()}`} />
        )}
        <MetaRow label="New Balance"       value={`${currency} ${newBalance.toLocaleString()}`} />
        <MetaRow label="Funding Source"    value={fundingSource} />
        {reference && <MetaRow label="Reference"       value={reference} />}
        <MetaRow label="Funded At"         value={fundedAt} />
        <MetaRow
          label="Status"
          value={<StatusPill label="Credited" variant="green" />}
        />
      </InfoBox>

      <Hr style={styles.divider} />

      <Text style={styles.text}>
        This balance will be drawn down as employees request and receive advances. You can
        monitor your wallet balance and transaction history from your dashboard at any time.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Wallet & Transactions
        </Button>
      </Section>

      <Text style={styles.mutedText}>
        If you did not authorise this funding or notice a discrepancy, contact our support
        team immediately.
      </Text>
    </EmailLayout>
  );
}