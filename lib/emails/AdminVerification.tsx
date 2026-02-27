import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

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
  <Html>
    <Head />
    <Preview>Verify your EaziWage admin account</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Logo */}
        <Section style={logoSection}>
          <div style={logo}>
            <span style={logoText}>E</span>
          </div>
          <Text style={brandName}>EaziWage Admin</Text>
        </Section>

        {/* Main Content */}
        <Heading style={h1}>Verify Your Admin Account</Heading>
        
        <Text style={text}>Hi {fullName},</Text>
        
        <Text style={text}>
          Welcome to the EaziWage admin team! Your admin account has been created with the email address:
        </Text>

        <Section style={emailBox}>
          <Text style={emailText}>{email}</Text>
        </Section>

        <Text style={text}>
          To activate your admin account and gain full access to the platform, please verify your email address by clicking the button below:
        </Text>

        {/* Verification Button */}
        <Section style={buttonContainer}>
          <Button style={button} href={verificationUrl}>
            Verify Admin Account
          </Button>
        </Section>

        <Text style={text}>
          Or copy and paste this URL into your browser:
        </Text>
        
        <Text style={linkText}>
          <Link href={verificationUrl} style={link}>
            {verificationUrl}
          </Link>
        </Text>

        <Hr style={hr} />

        {/* Security Notice */}
        <Section style={securitySection}>
          <Text style={securityTitle}>🔒 Security Notice</Text>
          <Text style={securityText}>
            • This verification link will expire in <strong>24 hours</strong>
          </Text>
          <Text style={securityText}>
            • This is an admin account with elevated privileges
          </Text>
          <Text style={securityText}>
            • If you didn't request this account, please ignore this email
          </Text>
          <Text style={securityText}>
            • Never share your admin credentials with anyone
          </Text>
        </Section>

        <Hr style={hr} />

        {/* Footer */}
        <Text style={footer}>
          This email was sent to <strong>{email}</strong>. If you have any questions, please contact our support team.
        </Text>
        
        <Text style={footer}>
          © {new Date().getFullYear()} EaziWage. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default AdminVerificationEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const logoSection = {
  textAlign: 'center' as const,
  padding: '32px 0',
};

const logo = {
  display: 'inline-block',
  width: '56px',
  height: '56px',
  backgroundColor: '#16a34a',
  borderRadius: '12px',
  marginBottom: '16px',
};

const logoText = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  lineHeight: '56px',
};

const brandName = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#0f172a',
  margin: '0',
};

const h1 = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0 40px',
  textAlign: 'center' as const,
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 40px',
};

const emailBox = {
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 40px',
  textAlign: 'center' as const,
};

const emailText = {
  color: '#16a34a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#16a34a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
  lineHeight: '1.5',
};

const linkText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 40px',
  wordBreak: 'break-all' as const,
};

const link = {
  color: '#16a34a',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 40px',
};

const securitySection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 40px',
};

const securityTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const securityText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '8px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '16px 40px 0',
  textAlign: 'center' as const,
};