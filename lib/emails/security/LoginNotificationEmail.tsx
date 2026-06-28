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

export interface LoginNotificationEmailProps {
  fullName: string;
  isNewDevice: boolean;
  securityUrl: string;
  resetPasswordUrl: string;
  loginContext: {
    ip: string;
    userAgent: string;
    timestamp: string;
    location?: string;
  };
}

export function LoginNotificationEmail({
  fullName,
  isNewDevice,
  securityUrl,
  resetPasswordUrl,
  loginContext,
}: LoginNotificationEmailProps) {
  const formattedTime = new Date(loginContext.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <EmailLayout
      previewText={
        isNewDevice
          ? `Security alert: new device detected on your EaziWage account`
          : `Successful login to your EaziWage account`
      }
      accentColor={isNewDevice ? '#dc2626' : '#16a34a'}
      portalLabel="EaziWage Security"
    >
      {isNewDevice ? (
        <AlertBanner variant="danger" icon="📱" label="New Device Detected" />
      ) : (
        <AlertBanner variant="success" icon="✅" label="Successful Login" />
      )}

      <Heading style={styles.heading}>
        {isNewDevice ? 'New Device Detected' : 'Successful Login'}
      </Heading>

      <Text style={styles.text}>Hi {fullName},</Text>

      <Text style={styles.text}>
        {isNewDevice
          ? "Your EaziWage account was recently signed into from a new device. If this was you, you can safely ignore this email. No further action is required."
          : "Your EaziWage account was just accessed."}
      </Text>

      <InfoBox title="Login Details">
        <MetaRow label="Time"       value={formattedTime} />
        <MetaRow label="Device"     value={loginContext.userAgent} />
        <MetaRow label="IP Address" value={loginContext.ip} />
        {loginContext.location && (
          <MetaRow label="Location" value={loginContext.location} />
        )}
      </InfoBox>

      {isNewDevice ? (
        <InfoBox variant="danger" title="Wasn't you?">
          <Text style={{ ...styles.mutedText, margin: '0 0 12px' }}>
            Your account may be compromised. Please take these steps immediately:
          </Text>
          <Section style={styles.buttonContainer}>
            <Button style={styles.buttonDanger} href={resetPasswordUrl}>
              Secure My Account
            </Button>
          </Section>
        </InfoBox>
      ) : (
        <Section style={styles.buttonContainer}>
          <Button style={styles.button} href={securityUrl}>
            Review Security Settings
          </Button>
        </Section>
      )}

      <Text style={styles.mutedText}>
        To keep your account secure, we recommend:
      </Text>
      {[
        'Enable Two-Factor Authentication (2FA)',
        'Never share your password with anyone',
        'Use a strong, unique password for EaziWage',
      ].map((item, i) => (
        <Row key={i} style={{ margin: '4px 0' }}>
          <Column style={{ width: '16px' }}>
            <Text style={{ ...styles.mutedText, margin: 0, color: '#64748b' }}>•</Text>
          </Column>
          <Column>
            <Text style={{ ...styles.mutedText, margin: 0 }}>{item}</Text>
          </Column>
        </Row>
      ))}
    </EmailLayout>
  );
}
