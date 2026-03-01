// emails/employer-onboarding-confirmation.tsx
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
  contactPerson: string;
  contactEmail: string;
}

export default function EmployerOnboardingConfirmation({
  companyName,
  contactPerson,
  contactEmail,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>
        Your EaziWage employer application has been received — we&apos;ll be in touch within 2–3 business
        days.
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
                Application Received 🎉
              </Heading>
              <Text className="text-slate-600 mt-0">
                Hi <strong>{contactPerson}</strong>,
              </Text>
              <Text className="text-slate-600">
                Thank you for submitting your employer onboarding application for{' '}
                <strong>{companyName}</strong>. We&apos;ve received all your details and our compliance
                team will review your application.
              </Text>

              {/* Timeline */}
              <Section className="bg-emerald-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-emerald-800 m-0 mb-2">What happens next?</Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ① Our team reviews your application <strong>(1–2 business days)</strong>
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ② We may reach out for additional documents if needed
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ③ Upon approval you&apos;ll receive access to your employer dashboard
                </Text>
              </Section>

              <Text className="text-slate-600">
                If you have questions in the meantime, reply to this email or reach us at{' '}
                <Link href="mailto:support@eaziwage.com" className="text-emerald-600">
                  support@eaziwage.com
                </Link>
                .
              </Text>

              <Hr className="border-slate-200 my-6" />

              <Text className="text-xs text-slate-400 m-0">
                This email was sent to {contactEmail} because you submitted an employer onboarding
                application on EaziWage. If this wasn&apos;t you, please ignore this email.
              </Text>
            </Section>

            {/* Footer */}
            <Text className="text-center text-xs text-slate-400 mt-6">
              © {new Date().getFullYear()} EaziWage Ltd. All rights reserved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
