import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components';
import * as React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasswordResetEmailProps {
  fullName:  string;
  email:     string;
  resetUrl:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';

const C = {
  green:      '#16a34a',
  greenLight: '#dcfce7',
  greenDark:  '#15803d',
  slate900:   '#0f172a',
  slate700:   '#334155',
  slate500:   '#64748b',
  slate200:   '#e2e8f0',
  slate100:   '#f1f5f9',
  white:      '#ffffff',
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PasswordResetEmail({ fullName, email, resetUrl }: PasswordResetEmailProps) {
  const firstName = fullName.split(' ')[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your EaziWage password — link valid for 1 hour</Preview>
      <Body style={s.body}>
        <Container style={s.container}>

          {/* Logo bar */}
          <Section style={s.logoBar}>
            <div style={s.logoRow}>
              <div style={s.logoIcon}><span style={s.logoLetter}>E</span></div>
              <span style={s.logoText}>EaziWage</span>
            </div>
          </Section>

          {/* Hero */}
          <Section style={s.hero}>
            <div style={s.badge}><span style={s.badgeText}>🔑 Password Reset Request</span></div>
            <Heading style={s.heading}>Reset your password, {firstName}</Heading>
            <Text style={s.body2}>
              We received a request to reset the password for your EaziWage account.
              Click the button below to choose a new password.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={s.ctaSection}>
            <Button href={resetUrl} style={s.ctaButton}>
              Reset My Password →
            </Button>
            <Text style={s.expiry}>
              This link expires in <strong>1 hour</strong> and can only be used once.
            </Text>
          </Section>

          <Hr style={s.divider} />

          {/* Security info */}
          <Section style={s.infoSection}>
            <Text style={s.infoLabel}>⚠️ Didn't request this?</Text>
            <Text style={s.infoText}>
              If you didn't request a password reset, you can safely ignore this email — your password
              will remain unchanged. If you're concerned about unauthorised access, contact us immediately at{' '}
              <Link href="mailto:security@eaziwage.com" style={s.link}>security@eaziwage.com</Link>.
            </Text>
          </Section>

          <Hr style={s.divider} />

          {/* Fallback */}
          <Section style={s.fallback}>
            <Text style={s.fallbackLabel}>Button not working? Copy this URL into your browser:</Text>
            <Link href={resetUrl} style={s.fallbackLink}>{resetUrl}</Link>
          </Section>

          {/* Footer */}
          <Section style={s.footer}>
            <Text style={s.footerText}>
              © 2026 EaziWage · {' '}
              <Link href={`${BASE_URL}/data.pdf`} style={s.footerLink}>Privacy Policy</Link>
              {' · '}
              <Link href={`${BASE_URL}/terms.pdf`} style={s.footerLink}>Terms</Link>
            </Text>
            <Text style={s.footerMuted}>
              This email was sent to {email} because a password reset was requested for this account.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

PasswordResetEmail.PreviewProps = {
  fullName: 'Jane Wanjiku',
  email:    'jane@acme.co.ke',
  resetUrl: 'https://app.eaziwage.com/reset-password?token=abc123',
} satisfies PasswordResetEmailProps;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  body:        { backgroundColor: C.slate100, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: 0, padding: '20px 0' },
  container:   { maxWidth: '560px', margin: '0 auto', backgroundColor: C.white, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
  logoBar:     { backgroundColor: C.slate900, padding: '24px 40px' },
  logoRow:     { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon:    { width: '40px', height: '40px', backgroundColor: C.green, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoLetter:  { color: C.white, fontWeight: '700', fontSize: '20px', lineHeight: '40px' },
  logoText:    { color: C.white, fontWeight: '700', fontSize: '20px', letterSpacing: '-0.5px' },
  hero:        { padding: '40px 40px 0' },
  badge:       { display: 'inline-block', backgroundColor: C.greenLight, borderRadius: '100px', padding: '6px 14px', marginBottom: '16px' },
  badgeText:   { color: C.greenDark, fontSize: '13px', fontWeight: '600' },
  heading:     { color: C.slate900, fontSize: '26px', fontWeight: '700', lineHeight: '1.3', margin: '0 0 12px', letterSpacing: '-0.5px' },
  body2:       { color: C.slate700, fontSize: '15px', lineHeight: '1.6', margin: '0' },
  ctaSection:  { padding: '28px 40px', textAlign: 'center' as const },
  ctaButton:   { backgroundColor: C.green, color: C.white, padding: '14px 32px', borderRadius: '10px', fontWeight: '600', fontSize: '15px', textDecoration: 'none', display: 'inline-block' },
  expiry:      { color: C.slate500, fontSize: '13px', marginTop: '14px' },
  divider:     { borderColor: C.slate200, margin: '0 40px' },
  infoSection: { padding: '28px 40px' },
  infoLabel:   { color: C.slate900, fontSize: '14px', fontWeight: '600', margin: '0 0 8px' },
  infoText:    { color: C.slate500, fontSize: '13px', lineHeight: '1.6', margin: 0 },
  link:        { color: C.green },
  fallback:    { padding: '24px 40px' },
  fallbackLabel: { color: C.slate500, fontSize: '13px', margin: '0 0 6px' },
  fallbackLink:  { color: C.green, fontSize: '12px', wordBreak: 'break-all' as const },
  footer:      { padding: '24px 40px', backgroundColor: C.slate900 },
  footerText:  { color: '#94a3b8', fontSize: '12px', margin: '0 0 8px' },
  footerLink:  { color: C.green, textDecoration: 'underline' },
  footerMuted: { color: '#64748b', fontSize: '11px', margin: 0 },
};