import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WelcomeEmailProps {
  fullName: string;
  email: string;
  role: 'employee' | 'employer' | 'admin';
  verificationUrl: string;
  companyName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

const COLORS = {
  green:       '#16a34a',
  greenLight:  '#dcfce7',
  greenDark:   '#15803d',
  slate900:    '#0f172a',
  slate700:    '#334155',
  slate500:    '#64748b',
  slate200:    '#e2e8f0',
  slate100:    '#f1f5f9',
  white:       '#ffffff',
  black:       '#000000',
} as const;

// ─── Email Component ──────────────────────────────────────────────────────────

export default function WelcomeEmail({
  fullName,
  email,
  role,
  verificationUrl,
  companyName,
}: WelcomeEmailProps) {
  const isEmployer    = role === 'employer';
  const firstName     = fullName.split(' ')[0];
  const previewText   = `Welcome to EaziWage, ${firstName}! Verify your email to get started.`;

  const roleLabel     = isEmployer ? 'Employer' : 'Employee';
  const roleTagline   = isEmployer
    ? 'You can now onboard your team and manage earned wage access.'
    : 'You now have access to your earned wages — instantly, with no interest.';

  const featureItems = isEmployer
    ? [
        { icon: '🏢', text: 'Onboard your employees in minutes' },
        { icon: '📊', text: 'Real-time payroll dashboard' },
        { icon: '🔒', text: 'Compliance-ready wage access controls' },
      ]
    : [
        { icon: '💸', text: 'Withdraw earned wages anytime' },
        { icon: '🚫', text: 'No loans, no interest — ever' },
        { icon: '📱', text: 'M-Pesa & mobile money integrations' },
      ];

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Logo bar ── */}
          <Section style={styles.logoSection}>
            <div style={styles.logoWrapper}>
              <div style={styles.logoIcon}>
                <span style={styles.logoLetter}>E</span>
              </div>
              <span style={styles.logoText}>EaziWage</span>
            </div>
          </Section>

          {/* ── Hero ── */}
          <Section style={styles.hero}>
            <div style={styles.roleBadge}>
              <span style={styles.roleBadgeText}>✅ {roleLabel} Account Created</span>
            </div>
            <Heading style={styles.heading}>
              Welcome aboard,{' '}
              <span style={styles.headingAccent}>{firstName}!</span>
            </Heading>
            <Text style={styles.subheading}>{roleTagline}</Text>
          </Section>

          {/* ── Verify CTA ── */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaLabel}>
              First things first — confirm your email address:
            </Text>
            <Button href={verificationUrl} style={styles.ctaButton}>
              Verify My Email Address →
            </Button>
            <Text style={styles.ctaExpiry}>
              This link expires in <strong>24 hours</strong>.
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* ── Features ── */}
          <Section style={styles.featuresSection}>
            <Heading as="h2" style={styles.featuresHeading}>
              What's waiting for you
            </Heading>
            {featureItems.map((item, i) => (
              <div key={i} style={styles.featureRow}>
                <span style={styles.featureIcon}>{item.icon}</span>
                <Text style={styles.featureText}>{item.text}</Text>
              </div>
            ))}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Account summary ── */}
          <Section style={styles.summarySection}>
            <Heading as="h2" style={styles.featuresHeading}>Your Account</Heading>
            <div style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Name</Text>
              <Text style={styles.summaryValue}>{fullName}</Text>
            </div>
            <div style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Email</Text>
              <Text style={styles.summaryValue}>{email}</Text>
            </div>
            <div style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Role</Text>
              <Text style={styles.summaryValue}>{roleLabel}</Text>
            </div>
            {isEmployer && companyName && (
              <div style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Company</Text>
                <Text style={styles.summaryValue}>{companyName}</Text>
              </div>
            )}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Fallback link ── */}
          <Section style={styles.fallbackSection}>
            <Text style={styles.fallbackText}>
              Button not working? Copy and paste this URL into your browser:
            </Text>
            <Link href={verificationUrl} style={styles.fallbackLink}>
              {verificationUrl}
            </Link>
          </Section>

          {/* ── Footer ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Need help?{' '}
              <Link href={`${BASE_URL}/contact`} style={styles.footerLink}>Visit our support centre</Link>
              {' '}or email us at{' '}
              <Link href="mailto:support@eaziwage.com" style={styles.footerLink}>
                support@eaziwage.com
              </Link>
            </Text>
            <Text style={styles.footerMuted}>
              © 2026 EaziWage. All rights reserved.
              <br />
              You received this email because you registered at with us.
            </Text>
            <Text style={styles.footerMuted}>
              <Link href={`${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`} style={styles.footerLink}>
                Unsubscribe
              </Link>
              {' · '}
              <Link href={`${BASE_URL}/privacy.pdf`} style={styles.footerLink}>Privacy Policy</Link>
              {' · '}
              <Link href={`${BASE_URL}/terms.pdf`} style={styles.footerLink}>Terms</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: COLORS.slate100,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: '20px 0',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },

  // Logo bar
  logoSection: {
    backgroundColor: COLORS.slate900,
    padding: '24px 40px',
  },
  logoWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    backgroundColor: COLORS.green,
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: '20px',
    lineHeight: '40px',
  },
  logoText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: '20px',
    letterSpacing: '-0.5px',
  },

  // Hero
  hero: {
    padding: '40px 40px 32px',
    backgroundColor: COLORS.white,
  },
  roleBadge: {
    display: 'inline-block',
    backgroundColor: COLORS.greenLight,
    borderRadius: '100px',
    padding: '6px 14px',
    marginBottom: '16px',
  },
  roleBadgeText: {
    color: COLORS.greenDark,
    fontSize: '13px',
    fontWeight: '600',
  },
  heading: {
    color: COLORS.slate900,
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.3',
    margin: '0 0 12px',
    letterSpacing: '-0.5px',
  },
  headingAccent: {
    color: COLORS.green,
  },
  subheading: {
    color: COLORS.slate700,
    fontSize: '16px',
    lineHeight: '1.6',
    margin: 0,
  },

  // CTA
  ctaSection: {
    padding: '0 40px 32px',
    textAlign: 'center' as const,
  },
  ctaLabel: {
    color: COLORS.slate700,
    fontSize: '15px',
    marginBottom: '20px',
  },
  ctaButton: {
    backgroundColor: COLORS.green,
    color: COLORS.white,
    padding: '14px 32px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '15px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  ctaExpiry: {
    color: COLORS.slate500,
    fontSize: '13px',
    marginTop: '14px',
  },

  divider: {
    borderColor: COLORS.slate200,
    margin: '0 40px',
  },

  // Features
  featuresSection: {
    padding: '32px 40px',
  },
  featuresHeading: {
    color: COLORS.slate900,
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 20px',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  featureIcon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  featureText: {
    color: COLORS.slate700,
    fontSize: '14px',
    margin: 0,
  },

  // Summary
  summarySection: {
    padding: '32px 40px',
    backgroundColor: COLORS.slate100,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  summaryLabel: {
    color: COLORS.slate500,
    fontSize: '13px',
    margin: 0,
    minWidth: '80px',
  },
  summaryValue: {
    color: COLORS.slate900,
    fontSize: '13px',
    fontWeight: '500',
    margin: 0,
    textAlign: 'right' as const,
  },

  // Fallback link
  fallbackSection: {
    padding: '24px 40px',
  },
  fallbackText: {
    color: COLORS.slate500,
    fontSize: '13px',
    margin: '0 0 6px',
  },
  fallbackLink: {
    color: COLORS.green,
    fontSize: '12px',
    wordBreak: 'break-all' as const,
  },

  // Footer
  footer: {
    padding: '24px 40px',
    backgroundColor: COLORS.slate900,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 12px',
  },
  footerLink: {
    color: COLORS.green,
    textDecoration: 'underline',
  },
  footerMuted: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '1.6',
    margin: '0 0 8px',
  },
};

// ─── Preview props (for @react-email/preview) ─────────────────────────────────

WelcomeEmail.PreviewProps = {
  fullName:        'Jane Wanjiku',
  email:           'jane@acmecorp.co.ke',
  role:            'employee' as const,
  verificationUrl: 'https://app.eaziwage.com/verify-email?token=abc123',
  companyName:     'Acme Corporation',
} satisfies WelcomeEmailProps;