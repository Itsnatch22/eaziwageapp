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

interface SessionReauthEmailProps {
  fullName: string;
  email: string;
  magicUrl: string;
}

export default function SessionReauthEmail({ fullName, email, magicUrl }: SessionReauthEmailProps) {
  const firstName = (fullName || '').split(' ')[0] || 'there';

  return (
    <EmailLayout
      previewText="Continue your EaziWage session — link valid for 1 hour"
      recipientEmail={email}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>🔐 EaziWage session re-auth</span>
        </div>
        <Heading style={layoutStyles.heading}>Continue where you left off, {firstName}</Heading>
        <Text style={layoutStyles.text}>
          We detected you were inactive and require a quick re-auth to continue. Click the button below to resume your session.
        </Text>
      </Section>

      
      <Section style={layoutStyles.buttonContainer}>
        <Button href={magicUrl} style={layoutStyles.button}>
          Continue Session →
        </Button>
        <Text style={{ color: '#64748b', fontSize: '13px', marginTop: '14px' }}>
          This link expires in <strong>1 hour</strong> and can only be used once.
        </Text>
      </Section>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ padding: '28px 0' }}>
        <Text style={{ ...layoutStyles.heading, fontSize: '16px', marginBottom: '8px' }}>
          ⚠️ Didn&apos;t request this?
        </Text>
        <Text style={{ ...layoutStyles.text, fontSize: '14px', color: '#64748b' }}>
          If you didn&apos;t request this, you can safely ignore this email. If you&apos;re concerned about
          unauthorised access, contact us at <Link href="mailto:security@eaziwage.com" style={{ color: '#16a34a' }}>security@eaziwage.com</Link>.
        </Text>
      </Section>

      <Hr style={layoutStyles.divider} />

      
      <Section style={{ padding: '24px 0' }}>
        <Text style={{ color: '#64748b', fontSize: '13px', margin: '0 0 6px' }}>
          Button not working? Copy this URL into your browser:
        </Text>
        <Link href={magicUrl} style={{ color: '#16a34a', fontSize: '12px', wordBreak: 'break-all' }}>
          {magicUrl}
        </Link>
      </Section>
    </EmailLayout>
  );
}

SessionReauthEmail.PreviewProps = {
  fullName: 'Jane Wanjiku',
  email: 'jane@acme.co.ke',
  magicUrl: 'https://app.eaziwage.com/session-login?token=abc123',
} satisfies SessionReauthEmailProps;
