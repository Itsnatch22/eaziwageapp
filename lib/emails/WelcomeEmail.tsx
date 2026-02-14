import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  fullName: string;
  email: string;
  role: "employer" | "employee";
  companyName?: string;
  verificationUrl: string;
}

const WelcomeEmail = ({
  fullName = "User",
  email = "user@example.com",
  role = "employee",
  companyName,
  verificationUrl = "https://eaziwage.com/verify",
}: WelcomeEmailProps) => {
  const isEmployer = role === "employer";

  return (
    <Html>
      <Head />
      <Preview>
        Welcome to EaziWage - {isEmployer ? "Start managing your team's wages" : "Get instant access to your earned wages"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo/Header */}
          <Section style={header}>
            <Heading style={heading}>
              🌟 Welcome to <span style={brandName}>EaziWage</span>
            </Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {fullName},</Text>
            
            <Text style={paragraph}>
              {isEmployer ? (
                <>
                  Welcome to EaziWage! We're excited to have <strong>{companyName}</strong> on board.
                  You're now part of a modern platform that empowers your team with instant wage access.
                </>
              ) : (
                <>
                  Welcome to EaziWage! You're now part of a platform that gives you instant access
                  to your earned wages, whenever you need them.
                </>
              )}
            </Text>

            {/* Verification Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={verificationUrl}>
                Verify Your Email Address
              </Button>
            </Section>

            <Text style={smallText}>
              This verification link will expire in 24 hours. If you didn't create this account,
              you can safely ignore this email.
            </Text>

            <Hr style={divider} />

            {/* What's Next Section */}
            <Heading as="h2" style={subHeading}>
              What's next?
            </Heading>

            {isEmployer ? (
              <>
                <Text style={listItem}>✅ Verify your email address (click the button above)</Text>
                <Text style={listItem}>✅ Complete your company profile</Text>
                <Text style={listItem}>✅ Invite your employees to join</Text>
                <Text style={listItem}>✅ Set up payroll integration</Text>
                <Text style={listItem}>✅ Start empowering your team!</Text>
              </>
            ) : (
              <>
                <Text style={listItem}>✅ Verify your email address (click the button above)</Text>
                <Text style={listItem}>✅ Complete your profile setup</Text>
                <Text style={listItem}>✅ Link your bank account</Text>
                <Text style={listItem}>✅ Start accessing your earned wages instantly!</Text>
              </>
            )}

            <Hr style={divider} />

            {/* Help Section */}
            <Heading as="h2" style={subHeading}>
              Need help?
            </Heading>
            
            <Text style={paragraph}>
              Our support team is here for you. If you have any questions or need assistance,
              don't hesitate to reach out:
            </Text>

            <Text style={listItem}>
              📧 Email: <Link href="mailto:support@eaziwage.com" style={link}>support@eaziwage.com</Link>
            </Text>
            <Text style={listItem}>
              📚 Help Center: <Link href="https://help.eaziwage.com" style={link}>help.eaziwage.com</Link>
            </Text>
            
            {isEmployer && (
              <Text style={listItem}>
                👥 Schedule a demo: <Link href="https://eaziwage.com/demo" style={link}>Book a time</Link>
              </Text>
            )}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              EaziWage - Instant Wage Access for Modern Teams
            </Text>
            <Text style={footerText}>
              <Link href="https://eaziwage.com/privacy.pdf" style={footerLink}>Privacy Policy</Link>
              {" · "}
              <Link href="https://eaziwage.com/terms.pdf" style={footerLink}>Terms of Service</Link>
              {" · "}
              <Link href="https://eaziwage.com/unsubscribe" style={footerLink}>Unsubscribe</Link>
            </Text>
            <Text style={footerText}>
              © 2026 EaziWage. All rights reserved.
            </Text>
            <Text style={addressText}>
              You're receiving this email because you created an account at eaziwage.com
              with the email address {email}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "600px",
};

const header = {
  backgroundColor: "#16a34a",
  padding: "32px 24px",
  borderRadius: "12px 12px 0 0",
};

const heading = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#ffffff",
  margin: "0",
  textAlign: "center" as const,
};

const brandName = {
  color: "#dcfce7",
};

const content = {
  backgroundColor: "#ffffff",
  padding: "32px 24px",
  borderRadius: "0 0 12px 12px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "16px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#16a34a",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const smallText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "8px 0",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "32px 0",
};

const subHeading = {
  fontSize: "20px",
  fontWeight: "600",
  color: "#111827",
  margin: "24px 0 16px",
};

const listItem = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#374151",
  margin: "8px 0",
};

const link = {
  color: "#16a34a",
  textDecoration: "underline",
};

const footer = {
  marginTop: "32px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#6b7280",
  margin: "8px 0",
};

const footerLink = {
  color: "#6b7280",
  textDecoration: "underline",
};

const addressText = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#9ca3af",
  margin: "16px 0 0",
};