import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles } from './EmailLayout';

interface AdminSupportNotificationProps {
  submitterEmail: string;
  subject: string;
  message: string;
  ticketId: string;
  dashboardUrl?: string;
}

export function AdminSupportNotification({
  submitterEmail,
  subject,
  message,
  ticketId,
  dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com',
}: AdminSupportNotificationProps) {
  const ticketUrl = `${dashboardUrl}/admin/support/tickets/${ticketId}`;

  return (
    <EmailLayout previewText={`New support ticket: ${subject}`}>
      <Heading style={styles.heading}>New Support Ticket</Heading>

      <Text style={styles.text}>
        A new support ticket has been submitted by <strong>{submitterEmail}</strong>.
      </Text>

      <Section style={styles.box}>
        <Text style={{ ...styles.mutedText, margin: '0 0 8px' }}>
          <strong>Subject:</strong> {subject}
        </Text>
        <Text style={{ ...styles.text, margin: 0 }}>
          {message.length > 800 ? `${message.slice(0, 800)}…` : message}
        </Text>
      </Section>

      <div style={styles.buttonContainer}>
        <Button style={styles.button} href={ticketUrl}>
          View Ticket in Admin
        </Button>
      </div>
    </EmailLayout>
  );
}

export default AdminSupportNotification;
