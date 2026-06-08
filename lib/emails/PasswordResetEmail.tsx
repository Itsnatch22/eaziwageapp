import {
  Button,
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface PasswordResetEmailProps {
  fullName:  string;
  email:     string;
  resetUrl:  string;
}

export default function PasswordResetEmail({ fullName, email, resetUrl }: PasswordResetEmailProps) {
  const firstName = fullName.split(' ')[0];

  return (
    <EmailLayout 
      previewText="Reset your EaziWage password — link valid for 1 hour"
      recipientEmail={email}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>🔑 Password Reset Request</span>
        </div>
        <Heading style={layoutStyles.heading}>Reset your password, {firstName}</Heading>
        <Text style={layoutStyles.text}>
          We received a request to reset the password for your EaziWage account.
          Click the button below to choose a new password.
        </Text>
      </Section>

      {/* CTA */}
      <Section style={layoutStyles.buttonContainer}>
        <Button href={resetUrl} style={layoutStyles.button}>
          Reset My Password →
        </Button>
        <Text style={{ color: '#64748b', fontSize: '13px', marginTop: '14px' }}>
          This link expires in <strong>1 hour</strong> and can only be used once.
        </Text>
      </Section>

      <Hr style={layoutStyles.divider} />

      {/* Security info */}
      <Section style={{ padding: '28px 0' }}>
        <Text style={{ ...layoutStyles.heading, fontSize: '16px', marginBottom: '8px' }}>
          ⚠️ Didn&apos;t request this?
        </Text>
        <Text style={{ ...layoutStyles.text, fontSize: '14px', color: '#64748b' }}>
          If you didn&apos;t request a password reset, you can safely ignore this email — your password
          will remain unchanged. If you&apos;re concerned about unauthorised access, contact us immediately at{' '}
          <Link href="mailto:security@eaziwage.com" style={{ color: '#16a34a' }}>security@eaziwage.com</Link>.
        </Text>
      </Section>

      <Hr style={layoutStyles.divider} />

      {/* Fallback */}
      <Section style={{ padding: '24px 0' }}>
        <Text style={{ color: '#64748b', fontSize: '13px', margin: '0 0 6px' }}>
          Button not working? Copy this URL into your browser:
        </Text>
        <Link href={resetUrl} style={{ color: '#16a34a', fontSize: '12px', wordBreak: 'break-all' }}>
          {resetUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  fullName: 'Jane Wanjiku',
  email:    'jane@acme.co.ke',
  resetUrl: 'https://app.eaziwage.com/reset-password?token=abc123',
} satisfies PasswordResetEmailProps;
