import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles } from '@/lib/emails/EmailLayout';

interface ContactAutoReplyProps {
  name: string;
  subject: string;
}

export default function ContactAutoReply({ name, subject }: ContactAutoReplyProps) {
  return (
    <EmailLayout previewText="We received your message - EaziWage">
      <Heading style={styles.heading}>Hi {name},</Heading>

      <Text style={styles.text}>
        Thank you for reaching out to us. We&apos;ve received your message and our team will
        get back to you within 24 hours.
      </Text>

      <Section style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #d1fae5',
        borderRadius: '12px',
        padding: '20px',
        margin: '24px 0',
      }}>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Your Message Subject:</strong> {subject}
        </Text>
      </Section>

      <Text style={styles.text}>
        In the meantime, feel free to explore more about how EaziWage is transforming
        financial wellbeing for Africa&apos;s workforce.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>The EaziWage Team</strong>
      </Text>
    </EmailLayout>
  );
}
