import {
  Body, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text, Tailwind,
} from '@react-email/components';

interface Props {
  companyName:   string;
  contactEmail:  string;
  contactPerson: string;
  currentRating: string;
  currentScore:  number;
}

const RATING_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

export default function RiskReviewRequestEmail({
  companyName,
  contactEmail,
  contactPerson,
  currentRating,
  currentScore,
}: Props) {
  const ratingColor = RATING_COLORS[currentRating] ?? '#94a3b8';

  return (
    <Html>
      <Head />
      <Preview>
        Risk review request received for {companyName} — we&apos;ll be in touch within 3–5 business days.
      </Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto max-w-xl py-10 px-4">

            {/* Logo */}
            <Section className="text-center mb-8">
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                marginBottom: 10,
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>E</span>
              </div>
              <Heading className="text-2xl font-bold text-slate-900 m-0">EaziWage</Heading>
            </Section>

            {/* Card */}
            <Section className="bg-white rounded-2xl shadow-sm px-8 py-8">
              <Heading className="text-xl font-bold text-slate-900 mt-0 mb-1">
                Risk Score Review Requested 📋
              </Heading>

              <Text className="text-slate-600 mt-0">
                Hi <strong>{contactPerson}</strong>,
              </Text>
              <Text className="text-slate-600">
                We&apos;ve received your request for a manual risk score review for{' '}
                <strong>{companyName}</strong>. Our risk team will assess your full company
                profile and update your score if the new information warrants it.
              </Text>

              {/* Current profile summary */}
              <Section className="bg-slate-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-slate-800 m-0 mb-3">Your current risk profile</Text>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 0', color: '#64748b', fontSize: 14 }}>
                        Composite Score
                      </td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                        {currentScore.toFixed(1)} / 5.0
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', color: '#64748b', fontSize: 14 }}>
                        Rating
                      </td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block',
                          background: ratingColor, color: '#fff',
                          fontWeight: 700, fontSize: 13,
                          borderRadius: '50%',
                          width: 28, height: 28, lineHeight: '28px', textAlign: 'center',
                        }}>
                          {currentRating}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>

              {/* What happens next */}
              <Section className="bg-emerald-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-emerald-800 m-0 mb-2">What happens next?</Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ① Our risk team reviews your full company profile — <strong>3–5 business days</strong>
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ② We may reach out for additional documentation or clarification
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ③ You&apos;ll receive an email once the review is complete and your score is updated
                </Text>
              </Section>

              <Text className="text-slate-600">
                Questions? Reach our risk team at{' '}
                <Link href="mailto:risk@eaziwage.com" className="text-emerald-600">
                  risk@eaziwage.com
                </Link>
              </Text>

              <Hr className="border-slate-200 my-6" />

              <Text className="text-xs text-slate-400 m-0">
                This email was sent to {contactEmail} because a risk review was
                requested for {companyName} on the EaziWage platform.
              </Text>
            </Section>

            <Text className="text-center text-xs text-slate-400 mt-6">
              © {new Date().getFullYear()} EaziWage Ltd. All rights reserved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
