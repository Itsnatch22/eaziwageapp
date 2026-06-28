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

export interface PasswordChangedEmailProps {
  fullName: string;
  securityUrl: string;
}

export function PasswordChangedEmail({
  fullName,
  securityUrl,
}: PasswordChangedEmailProps) {
  return (
    <EmailLayout
      previewText={`Your EaziWage password was changed`}
      accentColor="#2563eb"
      portalLabel="EaziWage Security"
    >
      <AlertBanner variant="info" icon="🔐" label="Password Changed" />

      <Heading style={styles.heading}>Password Changed</Heading>

      <Text style={styles.text}>Hi {fullName},</Text>

      <Text style={styles.text}>
        Your EaziWage password was successfully changed just now.
      </Text>

      <InfoBox variant="danger" title="Didn't change your password?">
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
