import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout, {
  AlertBanner,
  InfoBox,
  MetaRow,
  StatusPill,
  styles,
} from './EmailLayout';

export interface BetaOnboardingAnswers {
  q1: 'very_easy' | 'easy' | 'neutral' | 'difficult' | 'very_difficult';
  q2: 'very_clear' | 'clear' | 'neutral' | 'unclear' | 'very_unclear';
  q3: 'completely' | 'mostly' | 'somewhat' | 'not_really' | 'no';
  q4: {
    encountered: boolean;
    step?: string;
  };
  q5: 'too_few' | 'just_right' | 'slightly_too_many' | 'far_too_many';
  q6: {
    confusing: boolean;
    details?: string;
  };
  q7: 'very_comfortable' | 'comfortable' | 'neutral' | 'uncomfortable' | 'very_uncomfortable';
  q8: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
  q9: 'very_easy' | 'easy' | 'neutral' | 'difficult' | 'very_difficult';
  q10: {
    issue: boolean;
    details?: string;
  };
  q11?: 'too_slow' | 'slightly_slow' | 'about_right' | 'slightly_fast' | 'too_fast';
  q12?: {
    encountered: boolean;
    details?: string;
  };
  q13?: 'very_confident' | 'confident' | 'neutral' | 'not_very_confident' | 'not_at_all_confident';
  q14?: string;
  q15?: string;
}

interface BetaOnboardingFeedbackProps {
  userId?: string;
  userName: string;
  userEmail?: string;
  reviewedPages?: string[];
  answers: BetaOnboardingAnswers;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
  dashboardUrl?: string;
}

const answerLabels: Record<string, string> = {
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
  too_few: 'Too few',
  just_right: 'Just right',
  slightly_too_many: 'Slightly too many',
  far_too_many: 'Far too many',
  very_comfortable: 'Very comfortable',
  comfortable: 'Comfortable',
  uncomfortable: 'Uncomfortable',
  very_uncomfortable: 'Very uncomfortable',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  very_poor: 'Very poor',
  too_slow: 'Too slow',
  slightly_slow: 'Slightly slow',
  about_right: 'About right',
  slightly_fast: 'Slightly fast',
  too_fast: 'Too fast',
  very_confident: 'Very confident',
  confident: 'Confident',
  not_very_confident: 'Not very confident',
  not_at_all_confident: 'Not at all confident',
};

const booleanLabel = (value: boolean) => (value ? 'Yes' : 'No');

const formatAnswer = (value: string) => answerLabels[value] ?? value.replace(/_/g, ' ');

export default function BetaOnboardingFeedback({
  userId,
  userName,
  userEmail,
  reviewedPages = [],
  answers,
  submittedAt,
  ipAddress = 'unknown',
  userAgent = 'unknown',
  dashboardUrl = 'https://app.eaziwage.com/admin',
}: BetaOnboardingFeedbackProps) {
  const hasBlockingFriction = answers.q4.encountered || answers.q6.confusing || answers.q10.issue || Boolean(answers.q12?.encountered);
  const sentimentVariant = hasBlockingFriction ? 'yellow' : 'green';

  return (
    <EmailLayout
      previewText={`New beta onboarding feedback from ${userName}`}
      accentColor="#16a34a"
      portalLabel="Admin Portal"
    >
      <AlertBanner variant="info" icon="BETA" label="Beta Onboarding Feedback" />

      <Heading style={styles.heading}>New beta onboarding feedback</Heading>

      <Text style={styles.text}>
        A beta tester completed the onboarding feedback survey. Review the summary below and
        follow up where friction was reported.
      </Text>

      <InfoBox title="Submission Details">
        <MetaRow label="Name" value={userName} />
        {userEmail && <MetaRow label="Email" value={userEmail} />}
        {userId && <MetaRow label="User ID" value={userId} />}
        {reviewedPages.length > 0 && <MetaRow label="Reviewed Pages" value={reviewedPages.join(', ')} />}
        <MetaRow label="Submitted At" value={submittedAt} />
        <MetaRow label="IP Address" value={ipAddress} />
        <MetaRow
          label="Friction"
          value={<StatusPill label={hasBlockingFriction ? 'Needs Review' : 'No Major Issues'} variant={sentimentVariant} />}
        />
      </InfoBox>

      <InfoBox title="Experience Scores">
        <MetaRow label="Setup Ease" value={formatAnswer(answers.q1)} />
        <MetaRow label="Instructions" value={formatAnswer(answers.q2)} />
        <MetaRow label="Completed Tasks" value={formatAnswer(answers.q3)} />
        <MetaRow label="Number of Steps" value={formatAnswer(answers.q5)} />
        <MetaRow label="Data Comfort" value={formatAnswer(answers.q7)} />
        <MetaRow label="Overall Experience" value={formatAnswer(answers.q8)} />
        <MetaRow label="Navigation" value={formatAnswer(answers.q9)} />
        {answers.q11 && <MetaRow label="Pace" value={formatAnswer(answers.q11)} />}
        {answers.q13 && <MetaRow label="Confidence" value={formatAnswer(answers.q13)} />}
      </InfoBox>

      <InfoBox title="Reported Friction" variant={hasBlockingFriction ? 'warn' : 'default'}>
        <MetaRow
          label="Blocked Step"
          value={answers.q4.encountered ? answers.q4.step?.trim() || 'Yes, no step specified' : 'No'}
        />
        <MetaRow
          label="Confusing Area"
          value={answers.q6.confusing ? answers.q6.details?.trim() || 'Yes, no details provided' : 'No'}
        />
        <MetaRow
          label="Technical Issue"
          value={answers.q10.issue ? answers.q10.details?.trim() || 'Yes, no details provided' : 'No'}
        />
        <MetaRow
          label="Other Issue"
          value={answers.q12?.encountered ? answers.q12.details?.trim() || 'Yes, no details provided' : 'No'}
        />
      </InfoBox>

      {(answers.q14?.trim() || answers.q15?.trim()) && (
        <InfoBox title="Open Feedback">
          {answers.q14?.trim() && <MetaRow label="Most Helpful" value={answers.q14.trim()} />}
          {answers.q15?.trim() && <MetaRow label="Suggested Improvement" value={answers.q15.trim()} />}
        </InfoBox>
      )}

      <InfoBox title="Technical Context">
        <MetaRow label="User Agent" value={userAgent} />
        <MetaRow label="Encountered Blocker" value={booleanLabel(hasBlockingFriction)} />
      </InfoBox>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={dashboardUrl}>
          Open Admin Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}

BetaOnboardingFeedback.PreviewProps = {
  userId: '00000000-0000-0000-0000-000000000000',
  userName: 'Beta Tester',
  userEmail: 'tester@example.com',
  reviewedPages: ['Register', 'Login', 'Employee onboarding', 'Employer onboarding'],
  submittedAt: new Date().toLocaleString(),
  ipAddress: '127.0.0.1',
  userAgent: 'Preview',
  answers: {
    q1: 'easy',
    q2: 'clear',
    q3: 'mostly',
    q4: { encountered: false },
    q5: 'just_right',
    q6: { confusing: true, details: 'The payroll setup wording was unclear.' },
    q7: 'comfortable',
    q8: 'good',
    q9: 'easy',
    q10: { issue: false },
    q11: 'about_right',
    q12: { encountered: false },
    q13: 'confident',
    q14: 'The guided steps were helpful.',
    q15: 'Add clearer progress messaging.',
  },
} as BetaOnboardingFeedbackProps;
