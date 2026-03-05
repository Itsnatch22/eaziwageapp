import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface EmployeeKycConfirmationProps {
  employeeName: string;
  employeeEmail: string;
  companyName: string;
}

export default function EmployeeKycConfirmation({
  employeeName,
  employeeEmail,
  companyName,
}: EmployeeKycConfirmationProps) {
  return (
    <EmailLayout 
      previewText="Your EaziWage KYC application has been submitted — verification in progress."
      recipientEmail={employeeEmail}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>✅ KYC Application Submitted</span>
        </div>
        <Heading style={layoutStyles.heading}>Application Received</Heading>
        
        <Text style={layoutStyles.text}>
          Hi <strong>{employeeName}</strong>,
        </Text>
        <Text style={layoutStyles.text}>
          Your identity verification application for{' '}
          <strong>EaziWage</strong> (via <strong>{companyName}</strong>) has been received.
          Our compliance team will review your documents within 2-3 business days.
        </Text>

        {/* What's next */}
        <Section style={{ ...layoutStyles.box, backgroundColor: '#f0fdf4' }}>
          <Text style={{ fontWeight: '600', color: '#166534', margin: '0 0 12px' }}>What happens next?</Text>
          <ul style={{ color: '#166534', fontSize: '14px', lineHeight: '24px', margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>① Our team verifies your submitted documents <strong>(2-3 business days)</strong></li>
            <li style={{ marginBottom: '8px' }}>② We may contact you if additional information is needed</li>
            <li>③ Once approved, you can start requesting wage advances instantly</li>
          </ul>
        </Section>

        <Text style={layoutStyles.text}>
          Questions? Contact us at{' '}
          <Link href="mailto:support@eaziwage.com" style={{ color: '#16a34a', fontWeight: '500' }}>
            support@eaziwage.com
          </Link>
        </Text>

        <Hr style={layoutStyles.divider} />

        <Text style={{ fontSize: '12px', color: '#64748b', margin: '24px 0 0' }}>
          This email was sent to {employeeEmail}. If this wasn&apos;t you, please ignore this
          email or contact us immediately.
        </Text>
      </Section>
    </EmailLayout>
  );
}

EmployeeKycConfirmation.PreviewProps = {
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  companyName: 'Acme Corp',
} as EmployeeKycConfirmationProps;
