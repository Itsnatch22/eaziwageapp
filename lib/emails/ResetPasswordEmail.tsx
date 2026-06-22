import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface ResetPasswordEmailProps {
  fullName:  string;
  email?:    string;
  ip:        string;
  userAgent: string;
  resetUrl:  string; // Link to request another reset if this wasn't them
}

export function ResetPasswordEmail({
  fullName  = 'there',
  email,
  ip        = 'Unknown',
  userAgent = 'Unknown device',
  resetUrl  = 'https://app.eaziwage.com/forgot-password',
}: ResetPasswordEmailProps) {
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <EmailLayout 
      previewText="Your EaziWage password was successfully changed"
      recipientEmail={email}
    >
      <Section>
        <div style={{ ...layoutStyles.badge, backgroundColor: '#f1f5f9' }}>
          <span style={{ ...layoutStyles.badgeText, color: '#334155' }}>🔒 Security Notification</span>
        </div>
        <Heading style={layoutStyles.heading}>Password Changed</Heading>
        
        <Text style={layoutStyles.text}>Hi {fullName},</Text>
        
        <Text style={layoutStyles.text}>
          Your EaziWage account password was successfully updated. All active
          sessions have been signed out as a security measure.
        </Text>

        
        <Section style={layoutStyles.box}>
          <Text style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 12px' }}>
            Change Details
          </Text>
          <Hr style={{ ...layoutStyles.divider, margin: '12px 0' }} />

          <Text style={{ ...layoutStyles.text, fontSize: '14px', margin: '8px 0' }}>
            <strong>Time:</strong> {timestamp}
          </Text>
          <Text style={{ ...layoutStyles.text, fontSize: '14px', margin: '8px 0' }}>
            <strong>IP Address:</strong> {ip}
          </Text>
          <Text style={{ ...layoutStyles.text, fontSize: '14px', margin: '8px 0' }}>
            <strong>Device:</strong> {userAgent}
          </Text>
        </Section>

        
        <Section style={{ ...layoutStyles.box, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <Text style={{ fontWeight: '600', color: '#991b1b', margin: '0 0 8px' }}>
            Wasn&apos;t you?
          </Text>
          <Text style={{ color: '#b91c1c', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
            If you did not make this change, your account may be compromised.
            Reset your password immediately and contact our security team at{' '}
            <a
              href="mailto:security@eaziwage.com"
              style={{ fontWeight: '600', color: '#991b1b', textDecoration: 'underline' }}
            >
              security@eaziwage.com
            </a>.
          </Text>
        </Section>

        <Section style={layoutStyles.buttonContainer}>
          <Button
            href={resetUrl}
            style={layoutStyles.button}
          >
            Reset Password Again
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

ResetPasswordEmail.PreviewProps = {
  fullName: 'Jane Wanjiku',
  email: 'jane@example.com',
  ip: '192.168.1.1',
  userAgent: 'Chrome on macOS',
  resetUrl: 'https://app.eaziwage.com/forgot-password',
} as ResetPasswordEmailProps;

export default ResetPasswordEmail;
