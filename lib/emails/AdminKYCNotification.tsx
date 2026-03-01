import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface DocumentApprovedEmailProps {
  employeeName: string;
  documentType: string;
  approvedDate: string;
  dashboardUrl?: string;
}

export const DocumentApprovedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  approvedDate = new Date().toLocaleDateString(),
  dashboardUrl = 'https://yourapp.com/dashboard',
}: DocumentApprovedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your {documentType} document has been approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>✅ Document Approved</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {employeeName},</Text>
            
            <Text style={paragraph}>
              Great news! Your <strong>{documentType}</strong> document has been reviewed and approved by our compliance team.
            </Text>

            <Section style={statusCard}>
              <Text style={statusTitle}>Document Status</Text>
              <Hr style={hr} />
              <Text style={detailText}>
                <strong>Document Type:</strong> {documentType}
              </Text>
              <Text style={detailText}>
                <strong>Status:</strong> <span style={approvedBadge}>Approved ✓</span>
              </Text>
              <Text style={detailText}>
                <strong>Approved On:</strong> {approvedDate}
              </Text>
            </Section>

            <Text style={paragraph}>
              You can now proceed with the onboarding process. If you have more documents to submit, please upload them through your dashboard.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                View Dashboard
              </Button>
            </Section>

            <Text style={footerText}>
              If you have any questions, please don&pos;t hesitate to contact our support team.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Your Company. All rights reserved.
            </Text>
            <Text style={footerText}>
              This is an automated message, please do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

interface DocumentRejectedEmailProps {
  employeeName: string;
  documentType: string;
  rejectedDate: string;
  rejectionReason?: string;
  dashboardUrl?: string;
}

export const DocumentRejectedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  rejectedDate = new Date().toLocaleDateString(),
  rejectionReason = 'Document quality is insufficient for verification',
  dashboardUrl = 'https://yourapp.com/dashboard',
}: DocumentRejectedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Action required: Your {documentType} document needs revision</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>⚠️ Document Requires Revision</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {employeeName},</Text>
            
            <Text style={paragraph}>
              After reviewing your <strong>{documentType}</strong> document, our compliance team has identified some issues that need to be addressed.
            </Text>

            <Section style={statusCard}>
              <Text style={statusTitle}>Review Details</Text>
              <Hr style={hr} />
              <Text style={detailText}>
                <strong>Document Type:</strong> {documentType}
              </Text>
              <Text style={detailText}>
                <strong>Status:</strong> <span style={rejectedBadge}>Requires Revision</span>
              </Text>
              <Text style={detailText}>
                <strong>Reviewed On:</strong> {rejectedDate}
              </Text>
            </Section>

            {rejectionReason && (
              <Section style={reasonBox}>
                <Text style={reasonTitle}>Reviewer Notes:</Text>
                <Text style={reasonText}>{rejectionReason}</Text>
              </Section>
            )}

            <Text style={paragraph}>
              <strong>Next Steps:</strong>
            </Text>
            <ul style={list}>
              <li style={listItem}>Review the feedback provided above</li>
              <li style={listItem}>Prepare a new document that addresses the issues</li>
              <li style={listItem}>Upload the revised document through your dashboard</li>
            </ul>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                Upload New Document
              </Button>
            </Section>

            <Text style={footerText}>
              If you need assistance or have questions, please contact our support team.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Your Company. All rights reserved.
            </Text>
            <Text style={footerText}>
              This is an automated message, please do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

interface DocumentSubmittedEmailProps {
  employeeName: string;
  documentType: string;
  submittedDate: string;
  documentNumber?: string;
  dashboardUrl?: string;
}

export const DocumentSubmittedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  submittedDate = new Date().toLocaleDateString(),
  documentNumber,
  dashboardUrl = 'https://yourapp.com/dashboard',
}: DocumentSubmittedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>We&apos;ve received your {documentType} document</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>📄 Document Received</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>Hi {employeeName},</Text>
            
            <Text style={paragraph}>
              Thank you for submitting your <strong>{documentType}</strong> document. We&apos;ve received it successfully and our compliance team will review it shortly.
            </Text>

            <Section style={statusCard}>
              <Text style={statusTitle}>Submission Details</Text>
              <Hr style={hr} />
              <Text style={detailText}>
                <strong>Document Type:</strong> {documentType}
              </Text>
              <Text style={detailText}>
                <strong>Status:</strong> <span style={pendingBadge}>Pending Review</span>
              </Text>
              <Text style={detailText}>
                <strong>Submitted On:</strong> {submittedDate}
              </Text>
              {documentNumber && (
                <Text style={detailText}>
                  <strong>Document Number:</strong> {documentNumber}
                </Text>
              )}
            </Section>

            <Text style={paragraph}>
              <strong>What happens next?</strong>
            </Text>
            <ul style={list}>
              <li style={listItem}>Our team will review your document within 1-2 business days</li>
              <li style={listItem}>You&apos;ll receive an email notification once the review is complete</li>
              <li style={listItem}>You can track the status in your dashboard at any time</li>
            </ul>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                Track Status
              </Button>
            </Section>

            <Text style={footerText}>
              Thank you for your patience during the verification process.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Your Company. All rights reserved.
            </Text>
            <Text style={footerText}>
              This is an automated message, please do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// ============================================================================
// STYLES
// ============================================================================

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

const header = {
  backgroundColor: '#7c3aed',
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const content = {
  padding: '40px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#374151',
  margin: '16px 0',
};

const statusCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const statusTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 12px 0',
};

const detailText = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#6b7280',
  margin: '8px 0',
};

const approvedBadge = {
  display: 'inline-block',
  backgroundColor: '#d1fae5',
  color: '#065f46',
  padding: '4px 12px',
  borderRadius: '16px',
  fontSize: '12px',
  fontWeight: 'bold',
};

const rejectedBadge = {
  display: 'inline-block',
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  padding: '4px 12px',
  borderRadius: '16px',
  fontSize: '12px',
  fontWeight: 'bold',
};

const pendingBadge = {
  display: 'inline-block',
  backgroundColor: '#fef3c7',
  color: '#92400e',
  padding: '4px 12px',
  borderRadius: '16px',
  fontSize: '12px',
  fontWeight: 'bold',
};

const reasonBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const reasonTitle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#991b1b',
  margin: '0 0 8px 0',
};

const reasonText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#7f1d1d',
  margin: '0',
  fontStyle: 'italic',
};

const list = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#6b7280',
  paddingLeft: '20px',
  margin: '16px 0',
};

const listItem = {
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const footer = {
  padding: '0 40px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  lineHeight: '16px',
  color: '#9ca3af',
  margin: '8px 0',
};

export default DocumentApprovedEmail;
