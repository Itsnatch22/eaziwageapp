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

interface WelcomeEmailProps {
  fullName: string;
  email: string;
  role: 'employee' | 'employer' | 'admin';
  verificationUrl: string;
  companyName?: string;
}

export default function WelcomeEmail({
  fullName,
  email,
  role,
  verificationUrl,
  companyName,
}: WelcomeEmailProps) {
  const isEmployer    = role === 'employer';
  const firstName     = fullName.split(' ')[0];
  const previewText   = `Welcome to EaziWage, ${firstName}! Verify your email to get started.`;

  const roleLabel     = isEmployer ? 'Employer' : 'Employee';
  const roleTagline   = isEmployer
    ? 'You can now onboard your team and manage earned wage access.'
    : 'You now have access to your earned wages — instantly, with no interest.';

  const featureItems = isEmployer
    ? [
        { icon: '🏢', text: 'Onboard your employees in minutes' },
        { icon: '📊', text: 'Real-time payroll dashboard' },
        { icon: '🔒', text: 'Compliance-ready wage access controls' },
      ]
    : [
        { icon: '💸', text: 'Withdraw earned wages anytime' },
        { icon: '🚫', text: 'No loans, no interest — ever' },
        { icon: '📱', text: 'M-Pesa & mobile money integrations' },
      ];

  return (
    <EmailLayout previewText={previewText} recipientEmail={email}>
      
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>✅ {roleLabel} Account Created</span>
        </div>
        <Heading style={layoutStyles.heading}>
          Welcome aboard, <span style={{ color: '#16a34a' }}>{firstName}!</span>
        </Heading>
        <Text style={layoutStyles.text}>{roleTagline}</Text>
      </Section>

      
      <Section style={layoutStyles.buttonContainer}>
        <Text style={{ ...layoutStyles.text, marginBottom: '20px' }}>
          First things first — confirm your email address:
        </Text>
        <Button href={verificationUrl} style={layoutStyles.button}>
          Verify My Email Address →
        </Button>
        <Text style={{ color: '#64748b', fontSize: '13px', marginTop: '14px' }}>
          This link expires in <strong>24 hours</strong>.
        </Text>
      </Section>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ padding: '32px 0' }}>
        <Heading as="h2" style={{ ...layoutStyles.heading, fontSize: '20px' }}>
          What&apos;s waiting for you
        </Heading>
        {featureItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px', marginRight: '12px' }}>{item.icon}</span>
            <Text style={{ ...layoutStyles.text, margin: 0, fontSize: '14px' }}>{item.text}</Text>
          </div>
        ))}
      </Section>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ ...layoutStyles.box, margin: '32px 0' }}>
        <Heading as="h2" style={{ ...layoutStyles.heading, fontSize: '18px' }}>Your Account</Heading>
        <div style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Name</Text>
          <Text style={styles.summaryValue}>{fullName}</Text>
        </div>
        <div style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Email</Text>
          <Text style={styles.summaryValue}>{email}</Text>
        </div>
        <div style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Role</Text>
          <Text style={styles.summaryValue}>{roleLabel}</Text>
        </div>
        {isEmployer && companyName && (
          <div style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Company</Text>
            <Text style={styles.summaryValue}>{companyName}</Text>
          </div>
        )}
      </Section>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ padding: '24px 0' }}>
        <Text style={{ color: '#64748b', fontSize: '13px', margin: '0 0 6px' }}>
          Button not working? Copy and paste this URL into your browser:
        </Text>
        <Link href={verificationUrl} style={{ color: '#16a34a', fontSize: '12px', wordBreak: 'break-all' }}>
          {verificationUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: '13px',
    margin: 0,
    minWidth: '80px',
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '500',
    margin: 0,
    textAlign: 'right' as const,
  },
};

WelcomeEmail.PreviewProps = {
  fullName:        'Jane Wanjiku',
  email:           'jane@acmecorp.co.ke',
  role:            'employee' as const,
  verificationUrl: 'https://app.eaziwage.com/verify-email?token=abc123',
  companyName:     'Acme Corporation',
} satisfies WelcomeEmailProps;
