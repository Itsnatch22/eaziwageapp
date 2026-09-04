import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout, { AlertBanner, InfoBox, MetaRow, StatusPill, styles } from './EmailLayout';
import type { BetaDisbursementAnswers } from '@/lib/validations/beta-disbursement';

interface BetaDisbursementFeedbackProps {
  userId?: string;
  userName: string;
  userEmail?: string;
  reviewedPages?: string[];
  answers: BetaDisbursementAnswers;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
  dashboardUrl?: string;
}

const labels: Record<string, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  neutral: 'Neutral',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
  very_clear: 'Very clear',
  clear: 'Clear',
  unclear: 'Unclear',
  very_unclear: 'Very unclear',
  completely: 'Completely',
  mostly: 'Mostly',
  somewhat: 'Somewhat',
  not_really: 'Not really',
  no: 'No',
  very_confident: 'Very confident',
  confident: 'Confident',
  not_confident: 'Not confident',
  not_at_all_confident: 'Not at all confident',
  very_fast: 'Very fast',
  fast: 'Fast',
  about_right: 'About right',
  slow: 'Slow',
  very_slow: 'Very slow',
  very_comfortable: 'Very comfortable',
  comfortable: 'Comfortable',
  uncomfortable: 'Uncomfortable',
  very_uncomfortable: 'Very uncomfortable',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  very_poor: 'Very poor',
};

const formatAnswer = (answer: string) => labels[answer] ?? answer.replace(/_/g, ' ');

export function BetaDisbursementFeedback({
  userId,
  userName,
  userEmail,
  reviewedPages = [],
  answers,
  submittedAt,
  ipAddress = 'unknown',
  userAgent = 'unknown',
  dashboardUrl = 'https://app.eaziwage.com/admin',
}: BetaDisbursementFeedbackProps) {
  const hasIssue = answers.q8.value;

  return (
    <EmailLayout previewText={`New beta disbursement feedback from ${userName}`} portalLabel="Admin Portal">
      <AlertBanner variant="info" icon="BETA" label="Beta Disbursement Feedback" />
      <Heading style={styles.heading}>New beta disbursement feedback</Heading>
      <Text style={styles.text}>
        A beta tester completed the employee disbursement flow survey. Review the experience
        scores and any reported issues below.
      </Text>

      <InfoBox title="Submission Details">
        <MetaRow label="Name" value={userName} />
        {userEmail && <MetaRow label="Email" value={userEmail} />}
        {userId && <MetaRow label="User ID" value={userId} />}
        {reviewedPages.length > 0 && <MetaRow label="Reviewed Pages" value={reviewedPages.join(', ')} />}
        <MetaRow label="Submitted At" value={submittedAt} />
        <MetaRow label="IP Address" value={ipAddress} />
        <MetaRow
          label="Issue"
          value={<StatusPill label={hasIssue ? 'Needs Review' : 'No Issue Reported'} variant={hasIssue ? 'yellow' : 'green'} />}
        />
      </InfoBox>

      <InfoBox title="Flow Experience">
        <MetaRow label="Starting the Flow" value={formatAnswer(answers.q1)} />
        <MetaRow label="Instructions" value={formatAnswer(answers.q2)} />
        <MetaRow label="Task Completion" value={formatAnswer(answers.q3)} />
        <MetaRow label="Payment Method Confidence" value={formatAnswer(answers.q4)} />
        <MetaRow label="Amount and Fees" value={formatAnswer(answers.q5)} />
        <MetaRow label="Status Updates" value={formatAnswer(answers.q6)} />
        <MetaRow label="Perceived Speed" value={formatAnswer(answers.q7)} />
        <MetaRow label="Data Comfort" value={formatAnswer(answers.q9)} />
        <MetaRow label="Overall Experience" value={formatAnswer(answers.q10)} />
      </InfoBox>

      <InfoBox title="Reported Issue" variant={hasIssue ? 'warn' : 'default'}>
        <MetaRow label="Issue Encountered" value={hasIssue ? answers.q8.details?.trim() || 'Yes, no details provided' : 'No'} />
      </InfoBox>

      {(answers.q11?.trim() || answers.q12?.trim()) && (
        <InfoBox title="Open Feedback">
          {answers.q11?.trim() && <MetaRow label="Most Helpful" value={answers.q11.trim()} />}
          {answers.q12?.trim() && <MetaRow label="Suggested Improvement" value={answers.q12.trim()} />}
        </InfoBox>
      )}

      <InfoBox title="Technical Context">
        <MetaRow label="User Agent" value={userAgent} />
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>Open Admin Dashboard</Button>
      </Section>
    </EmailLayout>
  );
}

export default BetaDisbursementFeedback;
