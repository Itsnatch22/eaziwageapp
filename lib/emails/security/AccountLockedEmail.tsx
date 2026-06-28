import {
  Button,
  Heading,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, {
  AlertBanner,
  MetaRow,
  InfoBox,
  styles,
} from '../EmailLayout';

export interface AccountLockedEmailProps {
  fullName: string;
  lockoutMinutes: number;
  unlockUrl: string;
  loginContext: {
    ip: string;
    userAgent: string;
    timestamp: string;
    location?: string;
  };
}

export function AccountLockedEmail({
  fullName,
  lockoutMinutes,
  unlockUrl,
  loginContext,
}: AccountLockedEmailProps) {
  const formattedTime = new Date(loginContext.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <EmailLayout
      previewText={`Your EaziWage account has been temporarily locked`}
      accentColor="#dc2626"
      portalLabel="EaziWage Security"
    >
      <AlertBanner variant="danger" icon="🔒" label="Account Temporarily Locked" />

      <Heading style={styles.heading}>Account Temporarily Locked</Heading>

      <Text style={styles.text}>Hi {fullName},</Text>

      <Text style={styles.text}>
        Your EaziWage account has been temporarily locked due to multiple failed login
        attempts. This is a security measure to protect your account.
      </Text>

      <InfoBox title="Last Attempt Details">
        <MetaRow label="Time"       value={formattedTime} />
        <MetaRow label="IP Address" value={loginContext.ip} />
        {loginContext.location && (
          <MetaRow label="Location" value={loginContext.location} />
        )}
        <MetaRow label="Device"     value={loginContext.userAgent} />
      </InfoBox>

      <Text style={styles.text}>
        <strong>What happens now?</strong>
        {'\n'}Your account will automatically unlock in {lockoutMinutes} minutes. You can
        also use the button below to unlock it immediately.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.buttonDanger} href={unlockUrl}>
          Unlock Account Now
        </Button>
      </Section>

      <InfoBox variant="danger" title="Wasn't you?">
        <Text style={{ ...styles.mutedText, margin: '0 0 10px' }}>
          If you didn&apos;t attempt to log in, someone may have your email address. We recommend:
        </Text>
        {[
          'Change your password immediately',
          'Enable two-factor authentication',
          'Contact our security team at security@eaziwage.com',
        ].map((item, i) => (
          <Row key={i} style={{ margin: '4px 0' }}>
            <Column style={{ width: '16px' }}>
              <Text style={{ ...styles.mutedText, margin: 0, color: '#991b1b' }}>•</Text>
            </Column>
            <Column>
              <Text style={{ ...styles.mutedText, margin: 0 }}>{item}</Text>
            </Column>
          </Row>
        ))}
      </InfoBox>
    </EmailLayout>
  );
}
