import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface EmployerOnboardingConfirmationProps {
  companyName: string;
  contactPerson: string;
  contactEmail: string;
}

export default function EmployerOnboardingConfirmation({
  companyName,
  contactPerson,
  contactEmail,
}: EmployerOnboardingConfirmationProps) {
  return (
    <EmailLayout 
      previewText="Your EaziWage employer application has been received — we'll be in touch within 2–3 business days."
      recipientEmail={contactEmail}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>🎉 Application Received</span>
        </div>
        <Heading style={layoutStyles.heading}>Welcome to EaziWage</Heading>
        
        <Text style={layoutStyles.text}>
          Hi <strong>{contactPerson}</strong>,
        </Text>
        <Text style={layoutStyles.text}>
          Thank you for submitting your employer onboarding application for{' '}
          <strong>{companyName}</strong>. We&apos;ve received all your details and our compliance
          team will review your application.
        </Text>

        
        <Section style={{ ...layoutStyles.box, backgroundColor: '#f0fdf4' }}>
          <Text style={{ fontWeight: '600', color: '#166534', margin: '0 0 12px' }}>What happens next?</Text>
          <ul style={{ color: '#166534', fontSize: '14px', lineHeight: '24px', margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>① Our team reviews your application <strong>(1–2 business days)</strong></li>
            <li style={{ marginBottom: '8px' }}>② We may reach out for additional documents if needed</li>
            <li>③ Upon approval you&apos;ll receive access to your employer dashboard</li>
          </ul>
        </Section>

        <Text style={layoutStyles.text}>
          If you have questions in the meantime, reply to this email or reach us at{' '}
          <Link href="mailto:support@eaziwage.com" style={{ color: '#16a34a', fontWeight: '500' }}>
            support@eaziwage.com
          </Link>.
        </Text>

        <Hr style={layoutStyles.divider} />

        <Text style={{ fontSize: '12px', color: '#64748b', margin: '24px 0 0' }}>
          This email was sent to {contactEmail} because you submitted an employer onboarding
          application on EaziWage. If this wasn&apos;t you, please ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

EmployerOnboardingConfirmation.PreviewProps = {
  companyName: 'Acme Corp',
  contactPerson: 'Jane Smith',
  contactEmail: 'jane@acmecorp.com',
} as EmployerOnboardingConfirmationProps;
