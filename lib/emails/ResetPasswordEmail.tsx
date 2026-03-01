import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResetPasswordEmailProps {
  fullName:  string;
  ip:        string;
  userAgent: string;
  resetUrl:  string; // Link to request another reset if this wasn't them
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResetPasswordEmail({
  fullName  = 'there',
  ip        = 'Unknown',
  userAgent = 'Unknown device',
  resetUrl  = 'https://eaziwageapp.vercel.app/forgot-password',
}: ResetPasswordEmailProps) {
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <Html lang="en">
      <Head />
      <Preview>Your EaziWage password was successfully changed</Preview>

      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto my-10 max-w-150 rounded-2xl bg-white shadow-sm">

            {/* Header */}
            <Section className="rounded-t-2xl bg-linear-to-r from-slate-900 to-slate-800 px-10 py-8">
              <Text className="m-0 text-2xl font-bold tracking-tight text-white">
                EaziWage
              </Text>
              <Text className="m-0 mt-1 text-sm text-slate-400">
                Security Notification
              </Text>
            </Section>

            {/* Body */}
            <Section className="px-10 py-8">
              <Text className="m-0 text-xl font-semibold text-slate-900">
                Password Changed
              </Text>

              <Text className="mt-4 text-sm leading-6 text-slate-600">
                Hi {fullName},
              </Text>

              <Text className="mt-2 text-sm leading-6 text-slate-600">
                Your EaziWage account password was successfully updated. All active
                sessions have been signed out as a security measure.
              </Text>

              {/* Detail card */}
              <Section className="my-6 rounded-xl border border-slate-100 bg-slate-50 px-6 py-5">
                <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Change Details
                </Text>
                <Hr className="my-3 border-slate-200" />

                <Text className="m-0 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Time: </span>
                  {timestamp}
                </Text>
                <Text className="mt-2 m-0 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">IP Address: </span>
                  {ip}
                </Text>
                <Text className="mt-2 m-0 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Device: </span>
                  {userAgent}
                </Text>
              </Section>

              {/* Security notice */}
              <Section className="rounded-xl border border-green-100 bg-green-50 px-6 py-5">
                <Text className="m-0 text-sm font-semibold text-green-800">
                  Wasn&apos;t you?
                </Text>
                <Text className="mt-2 m-0 text-sm leading-6 text-green-700">
                  If you did not make this change, your account may be compromised.
                  Reset your password immediately and contact our security team at{' '}
                  <a
                    href="mailto:security@eaziwage.com"
                    className="font-medium text-green-800 underline"
                  >
                    security@eaziwage.com
                  </a>
                  .
                </Text>
              </Section>

              <Section className="mt-8 text-center">
                <Button
                  href={resetUrl}
                  className="rounded-xl bg-green-600 px-8 py-3 text-sm font-semibold text-white no-underline"
                >
                  Reset Password Again
                </Button>
              </Section>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-2xl bg-slate-50 px-10 py-6">
              <Hr className="mb-5 border-slate-200" />
              <Text className="m-0 text-center text-xs text-slate-400">
                © {new Date().getFullYear()} EaziWage · This is an automated security notification.
              </Text>
              <Text className="mt-1 m-0 text-center text-xs text-slate-400">
                You&apos;re receiving this because a password change was made on your account.
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default ResetPasswordEmail;
