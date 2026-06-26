import { Button, Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles } from '@/lib/emails/EmailLayout';

interface ContactNotificationProps {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eaziwage.com';

export default function ContactNotification({ name, email, subject, message, submittedAt }: ContactNotificationProps) {
  return (
    <EmailLayout previewText="New Contact Form Submission Received">
      <Heading style={styles.heading}>New Contact Submission</Heading>

      <Text style={styles.text}>Hi Team,</Text>
      <Text style={styles.text}>
        You have received a new contact form submission. Details are as follows:
      </Text>

      <Section style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #d1fae5',
        borderRadius: '12px',
        padding: '20px',
        margin: '24px 0',
      }}>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Name:</strong> {name}
        </Text>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Email:</strong>{' '}
          <Link href={`mailto:${email}`} style={{ color: '#16a34a', textDecoration: 'underline' }}>
            {email}
          </Link>
        </Text>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Subject:</strong> {subject}
        </Text>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Message:</strong> {message}
        </Text>
        <Text style={{ color: '#065f46', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' }}>
          <strong>Submitted At:</strong> {submittedAt}
        </Text>
      </Section>

      <Text style={styles.text}>
        Please review the submission and follow up accordingly.
      </Text>

      <div style={styles.buttonContainer}>
        <Button style={styles.button} href={`${baseUrl}/admin`}>
          Go to Dashboard
        </Button>
      </div>
    </EmailLayout>
  );
}
