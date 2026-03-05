import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface DocumentApprovedEmailProps {
  employeeName: string;
  documentType: string;
  approvedDate: string;
  dashboardUrl?: string;
  recipientEmail?: string;
}

export const DocumentApprovedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  approvedDate = new Date().toLocaleDateString(),
  dashboardUrl = 'https://app.eaziwage.com/dashboard',
  recipientEmail,
}: DocumentApprovedEmailProps) => {
  return (
    <EmailLayout 
      previewText={`Your ${documentType} document has been approved`}
      recipientEmail={recipientEmail}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>✅ Document Approved</span>
        </div>
        <Heading style={layoutStyles.heading}>Great news, {employeeName}!</Heading>
        
        <Text style={layoutStyles.text}>
          Your <strong>{documentType}</strong> document has been reviewed and approved by our compliance team.
        </Text>

        <Section style={layoutStyles.box}>
          <Heading as="h3" style={{ ...layoutStyles.heading, fontSize: '18px', marginBottom: '12px' }}>
            Document Status
          </Heading>
          <Hr style={{ ...layoutStyles.divider, margin: '12px 0' }} />
          <Text style={styles.detailText}>
            <strong>Document Type:</strong> {documentType}
          </Text>
          <div style={{ margin: '8px 0' }}>
            <span style={styles.approvedBadge}>Approved ✓</span>
          </div>
          <Text style={styles.detailText}>
            <strong>Approved On:</strong> {approvedDate}
          </Text>
        </Section>

        <Text style={layoutStyles.text}>
          You can now proceed with the onboarding process. If you have more documents to submit, please upload them through your dashboard.
        </Text>

        <Section style={layoutStyles.buttonContainer}>
          <Button style={layoutStyles.button} href={dashboardUrl}>
            View Dashboard
          </Button>
        </Section>

        <Text style={{ ...layoutStyles.text, fontSize: '14px', color: '#64748b' }}>
          If you have any questions, please don&apos;t hesitate to contact our support team.
        </Text>
      </Section>
    </EmailLayout>
  );
};

interface DocumentRejectedEmailProps {
  employeeName: string;
  documentType: string;
  rejectedDate: string;
  rejectionReason?: string;
  dashboardUrl?: string;
  recipientEmail?: string;
}

export const DocumentRejectedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  rejectedDate = new Date().toLocaleDateString(),
  rejectionReason = 'Document quality is insufficient for verification',
  dashboardUrl = 'https://app.eaziwage.com/dashboard',
  recipientEmail,
}: DocumentRejectedEmailProps) => {
  return (
    <EmailLayout 
      previewText={`Action required: Your ${documentType} document needs revision`}
      recipientEmail={recipientEmail}
    >
      <Section>
        <div style={{ ...layoutStyles.badge, backgroundColor: '#fee2e2' }}>
          <span style={{ ...layoutStyles.badgeText, color: '#991b1b' }}>⚠️ Action Required</span>
        </div>
        <Heading style={layoutStyles.heading}>Document Needs Revision</Heading>
        
        <Text style={layoutStyles.text}>Hi {employeeName},</Text>
        
        <Text style={layoutStyles.text}>
          After reviewing your <strong>{documentType}</strong> document, our compliance team has identified some issues that need to be addressed.
        </Text>

        <Section style={layoutStyles.box}>
          <Heading as="h3" style={{ ...layoutStyles.heading, fontSize: '18px', marginBottom: '12px' }}>
            Review Details
          </Heading>
          <Hr style={{ ...layoutStyles.divider, margin: '12px 0' }} />
          <Text style={styles.detailText}>
            <strong>Document Type:</strong> {documentType}
          </Text>
          <div style={{ margin: '8px 0' }}>
            <span style={styles.rejectedBadge}>Requires Revision</span>
          </div>
          <Text style={styles.detailText}>
            <strong>Reviewed On:</strong> {rejectedDate}
          </Text>
        </Section>

        {rejectionReason && (
          <Section style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>Reviewer Notes:</Text>
            <Text style={styles.reasonText}>{rejectionReason}</Text>
          </Section>
        )}

        <Text style={{ ...layoutStyles.text, fontWeight: '600' }}>
          Next Steps:
        </Text>
        <ul style={styles.list}>
          <li style={styles.listItem}>Review the feedback provided above</li>
          <li style={styles.listItem}>Prepare a new document that addresses the issues</li>
          <li style={styles.listItem}>Upload the revised document through your dashboard</li>
        </ul>

        <Section style={layoutStyles.buttonContainer}>
          <Button style={layoutStyles.button} href={dashboardUrl}>
            Upload New Document
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

interface DocumentSubmittedEmailProps {
  employeeName: string;
  documentType: string;
  submittedDate: string;
  documentNumber?: string;
  dashboardUrl?: string;
  recipientEmail?: string;
}

export const DocumentSubmittedEmail = ({
  employeeName = 'John Doe',
  documentType = 'National ID',
  submittedDate = new Date().toLocaleDateString(),
  documentNumber,
  dashboardUrl = 'https://app.eaziwage.com/dashboard',
  recipientEmail,
}: DocumentSubmittedEmailProps) => {
  return (
    <EmailLayout 
      previewText={`We've received your ${documentType} document`}
      recipientEmail={recipientEmail}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>📄 Document Received</span>
        </div>
        <Heading style={layoutStyles.heading}>Submission Received</Heading>
        
        <Text style={layoutStyles.text}>Hi {employeeName},</Text>
        
        <Text style={layoutStyles.text}>
          Thank you for submitting your <strong>{documentType}</strong> document. We&apos;ve received it successfully and our compliance team will review it shortly.
        </Text>

        <Section style={layoutStyles.box}>
          <Heading as="h3" style={{ ...layoutStyles.heading, fontSize: '18px', marginBottom: '12px' }}>
            Submission Details
          </Heading>
          <Hr style={{ ...layoutStyles.divider, margin: '12px 0' }} />
          <Text style={styles.detailText}>
            <strong>Document Type:</strong> {documentType}
          </Text>
          <div style={{ margin: '8px 0' }}>
            <span style={styles.pendingBadge}>Pending Review</span>
          </div>
          <Text style={styles.detailText}>
            <strong>Submitted On:</strong> {submittedDate}
          </Text>
          {documentNumber && (
            <Text style={styles.detailText}>
              <strong>Document Number:</strong> {documentNumber}
            </Text>
          )}
        </Section>

        <Text style={{ ...layoutStyles.text, fontWeight: '600' }}>
          What happens next?
        </Text>
        <ul style={styles.list}>
          <li style={styles.listItem}>Our team will review your document within 1-2 business days</li>
          <li style={styles.listItem}>You&apos;ll receive an email notification once the review is complete</li>
          <li style={styles.listItem}>You can track the status in your dashboard at any time</li>
        </ul>

        <Section style={layoutStyles.buttonContainer}>
          <Button style={layoutStyles.button} href={dashboardUrl}>
            Track Status
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  detailText: {
    fontSize: '14px',
    lineHeight: '24px',
    color: '#64748b',
    margin: '4px 0',
  },
  approvedBadge: {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  rejectedBadge: {
    display: 'inline-block',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  pendingBadge: {
    display: 'inline-block',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  reasonBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0',
  },
  reasonTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#991b1b',
    margin: '0 0 8px 0',
  },
  reasonText: {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#7f1d1d',
    margin: '0',
    fontStyle: 'italic',
  },
  list: {
    fontSize: '14px',
    lineHeight: '24px',
    color: '#64748b',
    paddingLeft: '20px',
    margin: '16px 0',
  },
  listItem: {
    margin: '8px 0',
  },
};

export default DocumentApprovedEmail;
