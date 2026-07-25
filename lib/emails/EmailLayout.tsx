import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components';
import { Facebook, Twitter, Instagram, Linkedin, Mail } from 'lucide-react';
import * as React from 'react';

interface EmailLayoutProps {
  previewText: string;
  recipientEmail?: string;
  children: React.ReactNode;
  accentColor?: string;
  portalLabel?: 'Admin Portal' | 'Employee Portal' | 'Employer Portal' | 'EaziWage Security';
}

const BRAND_GREEN = '#16a34a';
const BRAND_DARK = '#0f172a';
const BRAND_LIGHT = '#f0fdf4';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.eaziwage.com';

export default function EmailLayout({
  previewText,
  recipientEmail,
  children,
  accentColor = BRAND_GREEN,
  portalLabel = 'Admin Portal',
}: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <div style={{ ...styles.accentBar, backgroundColor: accentColor }} />
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Row>
              <Column>
                <div style={styles.logoContainer}>
                  <Img
                    src={`${APP_URL}/logo.png`}
                    alt="EaziWage"
                    width={36}
                    height={36}
                    style={{ borderRadius: '8px', display: 'block' }}
                  />
                  <span style={styles.logoText}>EaziWage</span>
                </div>
              </Column>
              <Column align="right">
                <span style={styles.adminBadge}>{portalLabel}</span>
              </Column>
            </Row>
          </Section>
          <Hr style={styles.headerDivider} />

          <Section style={styles.content}>{children}</Section>

          <Hr style={styles.footerDivider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This is an automated notification from EaziWage. Please do not reply to this email.
            </Text>
            {recipientEmail && (
              <Text style={styles.footerText}>
                Sent to <span style={{ color: BRAND_GREEN }}>{recipientEmail}</span>
              </Text>
            )}
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} EaziWage · Earned Wage Access Platform
            </Text>
            <Text style={{ ...styles.footerText, marginTop: '8px' }}>
              <a href="https://app.eaziwage.com" style={styles.footerLink}>
                EaziWage App
              </a>
              {' · '}
              <a href="https://app.eaziwage.com/data.pdf" style={styles.footerLink}>
                Privacy Policy
              </a>
              {' · '}
              <a href="https://app.eaziwage.com/terms.pdf" style={styles.footerLink}>
                Terms of Service
              </a>
            </Text>

            {/* Social icons – no background, muted color, clean alignment */}
            <div style={styles.socialLinksContainer}>
              <a
                href="https://www.facebook.com/share/1CwgkthTRT/"
                style={styles.socialLink}
                title="EaziWage on Facebook"
              >
                <Facebook size={18} color="#64748b" />
              </a>
              <a
                href="https://www.instagram.com/eaziwagelimited/"
                style={styles.socialLink}
                title="EaziWage on Instagram"
              >
                <Instagram size={18} color="#64748b" />
              </a>
              <a
                href="https://x.com/eaziwagelimited?t=m-WyH8sFtbLOAiRjVKFVPw&s=08"
                style={styles.socialLink}
                title="EaziWage on X (Twitter)"
              >
                <Twitter size={18} color="#64748b" />
              </a>
              <a
                href="https://www.linkedin.com/company/eaziwage/?viewAsMember=true"
                style={styles.socialLink}
                title="EaziWage on LinkedIn"
              >
                <Linkedin size={18} color="#64748b" />
              </a>
              <a
                href="mailto:support@eaziwage.com"
                style={styles.socialLink}
                title="Email support@eaziwage.com"
              >
                <Mail size={18} color="#64748b" />
              </a>
            </div>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

interface AlertBannerProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon: string;
  label: string;
}

export function AlertBanner({ variant, icon, label }: AlertBannerProps) {
  const variantStyles: Record<AlertBannerProps['variant'], React.CSSProperties> = {
    success: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#86efac' },
    warning: { backgroundColor: '#fef9c3', color: '#854d0e', borderColor: '#fde047' },
    danger: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
    info: { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
    neutral: { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
  };
  const s = variantStyles[variant];
  return (
    <div
      style={{
        ...styles.alertBanner,
        backgroundColor: s.backgroundColor,
        borderColor: s.borderColor,
      }}
    >
      <span style={{ marginRight: '8px', fontSize: '16px' }}>{icon}</span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: s.color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </span>
    </div>
  );
}

interface MetaRowProps {
  label: string;
  value: string | React.ReactNode;
}

export function MetaRow({ label, value }: MetaRowProps) {
  return (
    <Row style={styles.metaRow}>
      <Column style={styles.metaLabel}>
        <Text style={styles.metaLabelText}>{label}</Text>
      </Column>
      <Column style={styles.metaValue}>
        <Text style={styles.metaValueText}>{value}</Text>
      </Column>
    </Row>
  );
}

interface StatusPillProps {
  label: string;
  variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

export function StatusPill({ label, variant }: StatusPillProps) {
  const map: Record<StatusPillProps['variant'], React.CSSProperties> = {
    green: { backgroundColor: '#dcfce7', color: '#15803d' },
    yellow: { backgroundColor: '#fef9c3', color: '#854d0e' },
    red: { backgroundColor: '#fee2e2', color: '#991b1b' },
    blue: { backgroundColor: '#dbeafe', color: '#1e40af' },
    gray: { backgroundColor: '#f1f5f9', color: '#475569' },
  };
  return <span style={{ ...styles.pill, ...map[variant] }}>{label}</span>;
}

interface InfoBoxProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'warn' | 'danger';
}

export function InfoBox({ title, children, variant = 'default' }: InfoBoxProps) {
  const variantMap = {
    default: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    warn: { borderColor: '#fde047', backgroundColor: '#fefce8' },
    danger: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  };
  const s = variantMap[variant];
  return (
    <Section
      style={{
        ...styles.infoBox,
        borderColor: s.borderColor,
        backgroundColor: s.backgroundColor,
      }}
    >
      {title && <Text style={styles.infoBoxTitle}>{title}</Text>}
      {children}
    </Section>
  );
}

export const styles = {
  body: {
    backgroundColor: '#f1f5f9',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: '0',
    padding: '0',
  } as React.CSSProperties,
  accentBar: {
    height: '4px',
    width: '100%',
  } as React.CSSProperties,
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    maxWidth: '600px',
    borderRadius: '0 0 12px 12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '24px 32px 20px',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  } as React.CSSProperties,
  logoMark: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  logoMarkText: {
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '14px',
    letterSpacing: '-0.5px',
  } as React.CSSProperties,
  logoText: {
    fontSize: '20px',
    fontWeight: 800,
    color: BRAND_DARK,
    letterSpacing: '-0.5px',
    verticalAlign: 'middle',
    marginLeft: '10px',
  } as React.CSSProperties,
  adminBadge: {
    display: 'inline-block',
    backgroundColor: BRAND_LIGHT,
    color: BRAND_GREEN,
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    border: `1px solid ${BRAND_GREEN}33`,
  } as React.CSSProperties,
  headerDivider: {
    borderColor: '#f1f5f9',
    margin: '0',
  } as React.CSSProperties,
  content: {
    padding: '32px 32px 24px',
  } as React.CSSProperties,
  footerDivider: {
    borderColor: '#f1f5f9',
    margin: '0 32px',
  } as React.CSSProperties,
  footer: {
    padding: '20px 32px 28px',
    backgroundColor: '#fafafa',
  } as React.CSSProperties,
  footerText: {
    fontSize: '12px',
    lineHeight: '20px',
    color: '#94a3b8',
    margin: '2px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  footerLink: {
    color: '#94a3b8',
    textDecoration: 'underline',
  } as React.CSSProperties,
  heading: {
    fontSize: '22px',
    fontWeight: 800,
    color: BRAND_DARK,
    margin: '16px 0 8px',
    lineHeight: '1.3',
  } as React.CSSProperties,
  subheading: {
    fontSize: '16px',
    fontWeight: 700,
    color: BRAND_DARK,
    margin: '20px 0 8px',
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    lineHeight: '26px',
    color: '#334155',
    margin: '8px 0',
  } as React.CSSProperties,
  mutedText: {
    fontSize: '13px',
    lineHeight: '22px',
    color: '#64748b',
    margin: '6px 0',
  } as React.CSSProperties,
  button: {
    backgroundColor: BRAND_GREEN,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  buttonDanger: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  buttonSecondary: {
    backgroundColor: 'transparent',
    color: BRAND_GREEN,
    fontSize: '14px',
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: '8px',
    textDecoration: 'none',
    display: 'inline-block',
    border: `2px solid ${BRAND_GREEN}`,
  } as React.CSSProperties,
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '28px 0 20px',
  } as React.CSSProperties,
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid',
    marginBottom: '20px',
  } as React.CSSProperties,
  infoBox: {
    border: '1px solid',
    borderRadius: '10px',
    padding: '20px 24px',
    margin: '20px 0',
  } as React.CSSProperties,
  infoBoxTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: '0 0 12px',
  } as React.CSSProperties,
  metaRow: {
    borderBottom: '1px solid #f1f5f9',
    padding: '0',
  } as React.CSSProperties,
  metaLabel: {
    width: '40%',
    paddingRight: '12px',
    verticalAlign: 'top',
  } as React.CSSProperties,
  metaLabelText: {
    fontSize: '13px',
    color: '#94a3b8',
    fontWeight: 600,
    margin: '8px 0',
  } as React.CSSProperties,
  metaValue: {
    width: '60%',
    verticalAlign: 'top',
  } as React.CSSProperties,
  metaValueText: {
    fontSize: '13px',
    color: '#1e293b',
    fontWeight: 500,
    margin: '8px 0',
  } as React.CSSProperties,
  pill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    backgroundColor: '#f0fdf4',
    borderRadius: '20px',
    padding: '6px 14px',
    marginBottom: '8px',
  } as React.CSSProperties,
  badgeText: {
    color: '#15803d',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  box: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '20px 24px',
    margin: '20px 0',
  } as React.CSSProperties,
  divider: {
    borderColor: '#e2e8f0',
    margin: '16px 0',
  } as React.CSSProperties,
  socialLinksContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    margin: '18px 0 0 0',
  } as React.CSSProperties,
  socialLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    lineHeight: 0,
  } as React.CSSProperties,
} as const;