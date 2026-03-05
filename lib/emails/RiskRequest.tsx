import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout, { styles as layoutStyles } from './EmailLayout';

interface RiskRequestProps {
  companyName: string;
  contactEmail: string;
  contactPerson: string;
  currentRating: string;
  currentScore: number;
}

const RATING_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

export default function RiskRequest({
  companyName,
  contactEmail,
  contactPerson,
  currentRating,
  currentScore,
}: RiskRequestProps) {
  const ratingColor = RATING_COLORS[currentRating] ?? '#94a3b8';

  return (
    <EmailLayout 
      previewText={`Your risk score review request for ${companyName} has been received.`}
      recipientEmail={contactEmail}
    >
      <Section>
        <div style={layoutStyles.badge}>
          <span style={layoutStyles.badgeText}>📋 Risk Review Request</span>
        </div>
        <Heading style={layoutStyles.heading}>Review Request Received</Heading>
        
        <Text style={layoutStyles.text}>Hi <strong>{contactPerson}</strong>,</Text>
        
        <Text style={layoutStyles.text}>
          We&apos;ve received your request for a manual risk score review for{' '}
          <strong>{companyName}</strong>. Our risk team will assess your company&apos;s profile and
          update your score if warranted.
        </Text>

        {/* Current score summary */}
        <Section style={layoutStyles.box}>
          <Text style={{ fontWeight: '600', color: '#0f172a', margin: '0 0 12px' }}>Current Risk Profile</Text>
          <Hr style={{ ...layoutStyles.divider, margin: '12px 0' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#64748b', fontSize: '14px' }}>
                  Composite Score
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                  {currentScore.toFixed(1)} / 5.0
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#64748b', fontSize: '14px' }}>
                  Current Rating
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: ratingColor,
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '13px',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      lineHeight: '28px',
                      textAlign: 'center',
                    }}
                  >
                    {currentRating}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Timeline */}
        <Section style={{ ...layoutStyles.box, backgroundColor: '#f0fdf4' }}>
          <Text style={{ fontWeight: '600', color: '#166534', margin: '0 0 12px' }}>What happens next?</Text>
          <ul style={{ color: '#166534', fontSize: '14px', lineHeight: '24px', margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>① Our risk team reviews your full company profile <strong>(3–5 business days)</strong></li>
            <li style={{ marginBottom: '8px' }}>② We may reach out for additional documentation</li>
            <li>③ You&apos;ll be notified by email once the review is complete</li>
          </ul>
        </Section>

        <Text style={layoutStyles.text}>
          Questions? Reach us at{' '}
          <Link href="mailto:risk@eaziwage.com" style={{ color: '#16a34a', fontWeight: '500' }}>
            risk@eaziwage.com
          </Link>
        </Text>

        <Hr style={layoutStyles.divider} />

        <Text style={{ fontSize: '12px', color: '#64748b', margin: '24px 0 0' }}>
          This email was sent to {contactEmail}. Reference company: {companyName}.
        </Text>
      </Section>
    </EmailLayout>
  );
}

RiskRequest.PreviewProps = {
  companyName: 'Acme Corp',
  contactEmail: 'jane@acmecorp.com',
  contactPerson: 'Jane Smith',
  currentRating: 'B',
  currentScore: 3.5,
} as RiskRequestProps;
