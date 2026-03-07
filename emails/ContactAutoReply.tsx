import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Img,
} from "@react-email/components";

interface ContactAutoReplyProps {
  name: string;
  subject: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eaziwage.com";

export default function ContactAutoReply({
  name,
  subject,
}: ContactAutoReplyProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your message - EaziWage</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="140"
              height="auto"
              alt="EaziWage"
              style={logo}
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Hi {name},</Heading>

            <Text style={text}>
              Thank you for reaching out to us. We've received your message and
              our team will get back to you within 24 hours.
            </Text>

            <Section style={highlightBox}>
              <Text style={highlightText}>
                <strong>Your Message Subject:</strong> {subject}
              </Text>
            </Section>

            <Text style={text}>
              In the meantime, feel free to explore more about how EaziWage is
              transforming financial wellbeing for Africa's workforce.
            </Text>

            <Text style={text}>
              Best regards,
              <br />
              <strong>The EaziWage Team</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Nairobi, Kenya | +254 723 154900 | support@eaziwage.com
            </Text>
            <Text style={footerText}>
              © 2026 EaziWage. Empowering Africa's workforce.
            </Text>
            <Text style={footerText}>
              <Link href={baseUrl} style={footerLink}>
                Website
              </Link>{" "}
              •{" "}
              <Link href={`${baseUrl}/data.pdf`} style={footerLink}>
                Privacy Policy
              </Link>{" "}
              •{" "}
              <Link href={`${baseUrl}/terms.pdf`} style={footerLink}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ----------------------------- styles ----------------------------- */

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const header = {
  padding: "32px 48px",
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #f3f4f6",
};

const logo = {
  margin: "0 auto",
};

const content = {
  padding: "32px 48px",
};

const h1 = {
  color: "#111827",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 24px",
  lineHeight: "1.3",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "16px 0",
};

const highlightBox = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #d1fae5",
  borderRadius: "12px",
  padding: "20px",
  margin: "24px 0",
};

const highlightText = {
  color: "#065f46",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "8px 0",
};

const footer = {
  borderTop: "1px solid #f3f4f6",
  padding: "32px 48px",
  textAlign: "center" as const,
  backgroundColor: "#f9fafb",
};

const footerText = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "4px 0",
};

const footerLink = {
  color: "#16a34a",
  textDecoration: "none",
  fontWeight: "600",
};
