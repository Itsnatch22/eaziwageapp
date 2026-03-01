// emails/employee-kyc-confirmation.tsx
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
  employeeName: string;
  employeeEmail: string;
  companyName: string;
}

export default function EmployeeKycConfirmation({
  employeeName,
  employeeEmail,
  companyName,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>
        Your EaziWage KYC application has been submitted — verification in progress.
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
                KYC Application Submitted ✅
              </Heading>
              <Text className="text-slate-600 mt-0">
                Hi <strong>{employeeName}</strong>,
              </Text>
              <Text className="text-slate-600">
                Your identity verification application for{' '}
                <strong>EaziWage</strong> (via <strong>{companyName}</strong>) has been received.
                Our compliance team will review your documents within 2-3 business days.
              </Text>

              {/* What's next */}
              <Section className="bg-emerald-50 rounded-xl px-6 py-4 my-6">
                <Text className="font-semibold text-emerald-800 m-0 mb-2">What happens next?</Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ① Our team verifies your submitted documents <strong>(2-3 business days)</strong>
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ② We may contact you if additional information is needed
                </Text>
                <Text className="text-emerald-700 text-sm m-0">
                  ③ Once approved, you can start requesting wage advances instantly
                </Text>
              </Section>

              <Text className="text-slate-600">
                Questions? Contact us at{' '}
                <Link href="mailto:support@eaziwage.com" className="text-emerald-600">
                  support@eaziwage.com
                </Link>
              </Text>

              <Hr className="border-slate-200 my-6" />

              <Text className="text-xs text-slate-400 m-0">
                This email was sent to {employeeEmail}. If this wasn&apos;t you, please ignore this
                email or contact us immediately.
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
