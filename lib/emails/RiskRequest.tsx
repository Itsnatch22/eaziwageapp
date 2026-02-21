import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

interface Props {
  companyName: string;
  contactEmail: string;
  contactPerson: string;
  currentRating: string;
  currentScore: number;
}

export default function RiskRequest({
  companyName,
  contactEmail,
  contactPerson,
  currentRating,
  currentScore,
}: Props) {
  const ratingColor: Record<string, string> = {
    A: '#10b981',
    B: '#3b82f6',
    C: '#f59e0b',
    D: '#ef4444',
  };

  return (
    <Html>
      <Head />
      <Preview>
        Your risk score review request for {companyName} has been received.
      </Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto max-w-xl py-10 px-4">
            {/* Header */}
            <Section className="text-center mb-8">
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>E</span>
              </div>
              <Heading className="text-2xl font-bold text-slate-900 m-0">EaziWage</Heading>
            </Section>

            {/* Card */}
            <Section className="bg-white rounded-2xl shadow-sm px-8 py-8">
              <Heading className="text-xl font-bold text-slate-900 mt-0 mb-2">
                Risk Review Request Received 📋
              </Heading>
              <Text className="text-slate-600 mt-0">
                Hi <strong>{contactPerson}</strong>,
              </Text>
              <Text className="text-slate-600">
                We've received your request for a manual risk score review for{' '}
                <strong>{companyName}</strong>. Our risk team will assess your company's profile and
                update your score if warranted.
              </Text>

              {/* Current score summary */}
              <Section className="bg-slate-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-slate-800 m-0 mb-3">Current Risk Profile</Text>
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
                        Current Rating
                      </td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            background: ratingColor[currentRating] ?? '#94a3b8',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
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
              <Section className="bg-emerald-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-emerald-800 m-0 mb-2">What happens next?</Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ① Our risk team reviews your full company profile <strong>(3–5 business days)</strong>
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ② We may reach out for additional documentation
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ③ You'll be notified by email once the review is complete
                </Text>
              </Section>

              <Text className="text-slate-600">
                Questions? Reach us at{' '}
                <Link href="mailto:risk@eaziwage.com" className="text-emerald-600">
                  risk@eaziwage.com
                </Link>
              </Text>

              <Hr className="border-slate-200 my-6" />

              <Text className="text-xs text-slate-400 m-0">
                This email was sent to {contactEmail}. Reference company: {companyName}.
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