import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, {
  AlertBanner,
  MetaRow,
  StatusPill,
  InfoBox,
  styles,
} from './EmailLayout';


export type EmployeeNotificationType =
  | 'advance_approval'
  | 'kyc_update'
  | 'system_alert'
  | 'repayment_reminder'
  | 'balance_update';

export interface AdvanceApprovedEmailProps {
  employeeName: string;
  advanceAmount: number;
  currency?: string;
  approvedAt?: string;
  repaymentDate?: string;
  interestRate?: number;
  advanceId?: string;
  dashboardUrl?: string;
}

export function AdvanceApprovedEmail({
  employeeName = 'John Kamau',
  advanceAmount = 15000,
  currency = 'KES',
  approvedAt = new Date().toLocaleString(),
  repaymentDate,
  interestRate = 0,
  advanceId,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: AdvanceApprovedEmailProps) {
  return (
    <EmailLayout
      previewText={`Your advance of ${currency} ${advanceAmount.toLocaleString()} has been approved`}
      accentColor="#16a34a"
    >
      <AlertBanner variant="success" icon="✅" label="Advance Approved" />

      <Heading style={styles.heading}>Your wage advance has been approved</Heading>

      <Text style={styles.text}>
        Hi {employeeName}, good news — your requested advance has been approved and funds
        have been disbursed to your account.
      </Text>

      <Section style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Amount Approved
        </Text>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: '#14532d', margin: '4px 0', lineHeight: '1' }}>
          {currency} {advanceAmount.toLocaleString()}
        </Text>
        {interestRate > 0 && (
          <Text style={{ fontSize: '14px', color: '#16a34a', margin: '4px 0 0' }}>
            Fee: {interestRate}%
          </Text>
        )}
      </Section>

      <InfoBox title="Advance Details">
        <MetaRow label="Amount"         value={`${currency} ${advanceAmount.toLocaleString()}`} />
        <MetaRow label="Approved At"    value={approvedAt} />
        {repaymentDate && <MetaRow label="Repayment Due" value={repaymentDate} />}
        {advanceId && <MetaRow label="Advance ID" value={`#${advanceId.slice(0, 8).toUpperCase()}`} />}
        <MetaRow
          label="Status"
          value={<StatusPill label="Approved & Disbursed" variant="green" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        The funds should appear in your M-PESA or bank account shortly. Repayment will be
        automatically deducted from your next payroll.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Advance Details
        </Button>
      </Section>

      <Text style={styles.mutedText}>
        Track your balance and upcoming deductions in the employee dashboard.
      </Text>
    </EmailLayout>
  );
}

export interface AdvanceRejectedEmailProps {
  employeeName: string;
  requestedAmount: number;
  currency?: string;
  rejectedAt?: string;
  reason?: string;
  advanceId?: string;
  dashboardUrl?: string;
}

export function AdvanceRejectedEmail({
  employeeName = 'John Kamau',
  requestedAmount = 15000,
  currency = 'KES',
  rejectedAt = new Date().toLocaleString(),
  reason,
  advanceId,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: AdvanceRejectedEmailProps) {
  return (
    <EmailLayout
      previewText={`Your advance request was not approved`}
      accentColor="#dc2626"
    >
      <AlertBanner variant="danger" icon="❌" label="Advance Request Declined" />

      <Heading style={styles.heading}>Advance request not approved</Heading>

      <Text style={styles.text}>
        Hi {employeeName}, unfortunately your recent advance request for{' '}
        <strong>{currency} {requestedAmount.toLocaleString()}</strong> could not be approved at this time.
      </Text>

      <InfoBox title="Request Summary">
        <MetaRow label="Requested Amount" value={`${currency} ${requestedAmount.toLocaleString()}`} />
        <MetaRow label="Submitted At"     value={rejectedAt} />
        {advanceId && <MetaRow label="Advance ID" value={`#${advanceId.slice(0, 8).toUpperCase()}`} />}
        <MetaRow
          label="Status"
          value={<StatusPill label="Rejected" variant="red" />}
        />
      </InfoBox>

      {reason && (
        <InfoBox variant="warn" title="Reason">
          <Text style={styles.text}>{reason}</Text>
        </InfoBox>
      )}

      <InfoBox title="Next Steps">
        <Text style={styles.mutedText}>
          You may submit a new request once your eligibility resets. Common reasons for
          rejection include insufficient earned wages or active deductions.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Check Eligibility
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface KYCUpdateEmailProps {
  employeeName: string;
  status: 'approved' | 'rejected' | 'pending' | 'under_review';
  updatedAt?: string;
  reason?: string;
  dashboardUrl?: string;
}

export function KYCUpdateEmail({
  employeeName = 'John Kamau',
  status = 'approved',
  updatedAt = new Date().toLocaleString(),
  reason,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: KYCUpdateEmailProps) {
  const isApproved = status === 'approved';

  return (
    <EmailLayout
      previewText={`KYC status update: ${status}`}
      accentColor={isApproved ? '#16a34a' : '#dc2626'}
    >
      <AlertBanner
        variant={isApproved ? 'success' : 'danger'}
        icon={isApproved ? '✅' : '❌'}
        label={`KYC ${isApproved ? 'Approved' : 'Update'}`}
      />

      <Heading style={styles.heading}>Your KYC status has been updated</Heading>

      <Text style={styles.text}>
        Hi {employeeName}, your identity verification status is now <strong>{status}</strong>.
      </Text>

      <InfoBox title="KYC Details">
        <MetaRow label="Status"      value={<StatusPill label={status.toUpperCase()} variant={isApproved ? 'green' : 'red'} />} />
        <MetaRow label="Updated At"  value={updatedAt} />
      </InfoBox>

      {reason && (
        <InfoBox title="Notes">
          <Text style={styles.text}>{reason}</Text>
        </InfoBox>
      )}

      {isApproved ? (
        <Text style={styles.text}>
          You can now request earned wage advances. Welcome to EaziWage advances!
        </Text>
      ) : (
        <Text style={styles.text}>
          Please review any feedback and resubmit required documents if eligible.
        </Text>
      )}

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface RepaymentReminderEmailProps {
  employeeName: string;
  outstandingAmount: number;
  currency?: string;
  dueDate?: string;
  advanceId?: string;
  dashboardUrl?: string;
}

export function RepaymentReminderEmail({
  employeeName = 'John Kamau',
  outstandingAmount = 12000,
  currency = 'KES',
  dueDate,
  advanceId,
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: RepaymentReminderEmailProps) {
  return (
    <EmailLayout
      previewText={`Repayment reminder: ${currency} ${outstandingAmount.toLocaleString()} due`}
      accentColor="#d97706"
    >
      <AlertBanner variant="warning" icon="⏰" label="Repayment Reminder" />

      <Heading style={styles.heading}>Upcoming repayment due</Heading>

      <Text style={styles.text}>
        Hi {employeeName}, this is a friendly reminder that your wage advance repayment is due soon.
      </Text>

      <Section style={{ backgroundColor: '#fefce8', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Outstanding
        </Text>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: '#713f12', margin: '4px 0', lineHeight: '1' }}>
          {currency} {outstandingAmount.toLocaleString()}
        </Text>
        {dueDate && <Text style={{ fontSize: '14px', color: '#854d0e' }}>Due: {dueDate}</Text>}
      </Section>

      <InfoBox title="Repayment Info">
        {advanceId && <MetaRow label="Advance ID" value={`#${advanceId.slice(0, 8).toUpperCase()}`} />}
        {dueDate && <MetaRow label="Due Date" value={dueDate} />}
        <MetaRow
          label="Status"
          value={<StatusPill label="Due Soon" variant="yellow" />}
        />
      </InfoBox>

      <Text style={styles.text}>
        This will be automatically deducted from your upcoming payroll. Ensure your employer has
        processed payroll on time to avoid any balance carry-over.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Balance
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface BalanceUpdateEmailProps {
  employeeName: string;
  newBalance: number;
  currency?: string;
  changeAmount?: number;
  changeType?: 'advance' | 'repayment' | 'topup' | 'adjustment';
  updatedAt?: string;
  dashboardUrl?: string;
}

export function BalanceUpdateEmail({
  employeeName = 'John Kamau',
  newBalance = 4500,
  currency = 'KES',
  changeAmount,
  changeType,
  updatedAt = new Date().toLocaleString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: BalanceUpdateEmailProps) {
  return (
    <EmailLayout
      previewText={`Balance update: ${currency} ${newBalance.toLocaleString()}`}
      accentColor="#0891b2"
    >
      <AlertBanner variant="info" icon="💰" label="Balance Updated" />

      <Heading style={styles.heading}>Your EaziWage balance has been updated</Heading>

      <Text style={styles.text}>
        Hi {employeeName}, your available wage advance balance is now updated.
      </Text>

      <Section style={{ backgroundColor: '#dbeafe', borderRadius: '12px', padding: '24px', margin: '20px 0', textAlign: 'center' as const }}>
        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>
          Current Balance
        </Text>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: '#1e3a8a', margin: '4px 0', lineHeight: '1' }}>
          {currency} {newBalance.toLocaleString()}
        </Text>
      </Section>

      <InfoBox title="Details">
        {changeAmount !== undefined && <MetaRow label="Change" value={`${changeType === 'advance' ? '-' : '+'} ${currency} ${Math.abs(changeAmount).toLocaleString()}`} />}
        <MetaRow label="Updated At" value={updatedAt} />
        <MetaRow
          label="Status"
          value={<StatusPill label="Active" variant="blue" />}
        />
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          View Full Balance History
        </Button>
      </Section>
    </EmailLayout>
  );
}

export interface SystemAlertEmailProps {
  employeeName: string;
  title: string;
  message: string;
  dashboardUrl?: string;
}

export function SystemAlertEmail({
  employeeName = 'John Kamau',
  title = 'System Notification',
  message = 'Important update regarding your account.',
  dashboardUrl = 'https://app.eaziwage.com/dashboards/employee-dashboard',
}: SystemAlertEmailProps) {
  return (
    <EmailLayout
      previewText={title}
      accentColor="#64748b"
    >
      <AlertBanner variant="info" icon="ℹ️" label="System Alert" />

      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.text}>
        Hi {employeeName},
      </Text>

      <InfoBox title="Message">
        <Text style={styles.text}>{message}</Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Go to Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}

