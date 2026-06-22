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

interface AdminVerificationEmailProps {
  fullName: string;
  email: string;
  verificationUrl: string;
}

export const AdminVerificationEmail = ({
  fullName = 'Admin',
  email = 'admin@example.com',
  verificationUrl = 'https://app.eaziwage.com/verify-email?token=abc123',
}: AdminVerificationEmailProps) => (
  <EmailLayout 
    previewText="Verify your EaziWage admin account"
    recipientEmail={email}
  >
    <Section>
      <div style={layoutStyles.badge}>
        <span style={layoutStyles.badgeText}>🛡️ Admin Verification</span>
      </div>
      <Heading style={layoutStyles.heading}>Verify Your Admin Account</Heading>
      
      <Text style={layoutStyles.text}>Hi {fullName},</Text>
      
      <Text style={layoutStyles.text}>
        Welcome to the EaziWage admin team! Your admin account has been created with the email address:
      </Text>

      <Section style={layoutStyles.box}>
        <Text style={{ color: '#16a34a', fontSize: '18px', fontWeight: '600', margin: 0, textAlign: 'center' }}>
          {email}
        </Text>
      </Section>

      <Text style={layoutStyles.text}>
        To activate your admin account and gain full access to the platform, please verify your email address by clicking the button below:
      </Text>

      
      <Section style={layoutStyles.buttonContainer}>
        <Button style={layoutStyles.button} href={verificationUrl}>
          Verify Admin Account
        </Button>
      </Section>

      <Text style={{ ...layoutStyles.text, fontSize: '14px' }}>
        Or copy and paste this URL into your browser:
      </Text>
      
      <Link href={verificationUrl} style={{ color: '#16a34a', fontSize: '12px', wordBreak: 'break-all', display: 'block', marginBottom: '24px' }}>
        {verificationUrl}
      </Link>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ ...layoutStyles.box, backgroundColor: '#fef3c7' }}>
        <Text style={{ color: '#92400e', fontSize: '16px', fontWeight: '600', margin: '0 0 12px' }}>
          🔒 Security Notice
        </Text>
        <ul style={{ color: '#78350f', fontSize: '14px', lineHeight: '22px', margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>This verification link will expire in <strong>24 hours</strong></li>
          <li style={{ marginBottom: '8px' }}>This is an admin account with elevated privileges</li>
          <li style={{ marginBottom: '8px' }}>If you didn&apos;t request this account, please ignore this email</li>
          <li>Never share your admin credentials with anyone</li>
        </ul>
      </Section>
    </Section>
  </EmailLayout>
);

export default AdminVerificationEmail;
