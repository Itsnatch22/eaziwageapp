import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';

export const COLORS = {
  primary:      '#16a34a', // Emerald-600
  primaryLight: '#dcfce7', // Emerald-100
  primaryDark:  '#15803d', // Emerald-700
  slate900:     '#0f172a',
  slate700:     '#334155',
  slate500:     '#64748b',
  slate200:     '#e2e8f0',
  slate100:     '#f1f5f9',
  white:        '#ffffff',
  black:        '#000000',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  recipientEmail?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmailLayout({
  previewText,
  children,
  footerContent,
  recipientEmail,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Header ── */}
          <Section style={styles.header}>
            <Link href={BASE_URL}>
              <Img
                src={`${BASE_URL}/logo.png`}
                width="140"
                height="auto"
                alt="EaziWage"
                style={styles.logo}
              />
            </Link>
          </Section>

          {/* ── Main Content ── */}
          <Section style={styles.content}>
            {children}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Footer ── */}
          <Section style={styles.footer}>
            {footerContent}
            
            <Text style={styles.footerText}>
              Need help?{' '}
              <Link href={`${BASE_URL}/support`} style={styles.footerLink}>Visit our Help Centre</Link>
              {' '}or email us at{' '}
              <Link href="mailto:support@eaziwage.com" style={styles.footerLink}>
                support@eaziwage.com
              </Link>
            </Text>

            <Text style={styles.footerMuted}>
              © {new Date().getFullYear()} EaziWage. All rights reserved.
              <br />
              Highwood Building, Riverside Drive, Nairobi, Kenya.
            </Text>

            <Text style={styles.footerMuted}>
              {recipientEmail && (
                <>
                  This email was sent to {recipientEmail}.
                  <br />
                </>
              )}
              <Link href={`${BASE_URL}/privacy`} style={styles.footerLink}>Privacy Policy</Link>
              {' · '}
              <Link href={`${BASE_URL}/terms`} style={styles.footerLink}>Terms of Service</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

export const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: COLORS.slate100,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: '40px 0',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  header: {
    padding: '40px 40px 32px',
    textAlign: 'center' as const,
  },
  logo: {
    margin: '0 auto',
  },
  content: {
    padding: '0 40px 40px',
  },
  divider: {
    borderColor: COLORS.slate200,
    margin: '0 40px',
  },
  footer: {
    padding: '32px 40px',
    backgroundColor: COLORS.slate900,
    textAlign: 'center' as const,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: '14px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  footerLink: {
    color: COLORS.primary,
    textDecoration: 'none',
    fontWeight: '500',
  },
  footerMuted: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '20px',
    margin: '0 0 12px',
  },

  // Common shared styles for components using the layout
  heading: {
    color: COLORS.slate900,
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.2',
    margin: '0 0 16px',
    letterSpacing: '-0.5px',
  },
  text: {
    color: COLORS.slate700,
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: '8px',
    color: COLORS.white,
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 32px',
    lineHeight: '1',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: COLORS.primaryLight,
    borderRadius: '100px',
    padding: '6px 16px',
    marginBottom: '20px',
  },
  badgeText: {
    color: COLORS.primaryDark,
    fontSize: '14px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  box: {
    backgroundColor: COLORS.slate100,
    borderRadius: '8px',
    padding: '24px',
    margin: '24px 0',
  },
};
