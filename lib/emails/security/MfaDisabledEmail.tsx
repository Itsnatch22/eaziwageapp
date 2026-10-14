import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, {
  AlertBanner,
  InfoBox,
  styles,
} from '../EmailLayout';

export interface MfaDisabledEmailProps {
  fullName: string;
  securityUrl: string;
}

export function MfaDisabledEmail({ fullName, securityUrl }: MfaDisabledEmailProps) {
  return (
    <EmailLayout
      previewText="Multi-factor authentication was disabled on your EaziWage account"
      accentColor="#dc2626"
      portalLabel="EaziWage Security"
    >
      <AlertBanner variant="warning" icon="🛡️" label="MFA Disabled" />

      <Heading style={styles.heading}>Multi-Factor Authentication Disabled</Heading>

      <Text style={styles.text}>Hi {fullName},</Text>

      <Text style={styles.text}>
        Multi-factor authentication was disabled on your EaziWage account.
      </Text>

      <InfoBox variant="danger" title="Didn't make this change?">
        <Text style={{ ...styles.mutedText, margin: 0 }}>
          Contact our security team immediately at{' '}
          <strong>security@eaziwage.com</strong>. Your account may be compromised.
        </Text>
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={securityUrl}>
          Review Account Security
        </Button>
      </Section>
    </EmailLayout>
  );
}
