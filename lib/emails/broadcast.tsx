import { Html, Head, Body, Container, Section, Heading, Text, Hr } from '@react-email/components';

interface BroadcastEmailProps {
  title: string;
  content: string;
  recipientName: string;
}

export const BroadcastEmail = ({ title, content, recipientName }: BroadcastEmailProps) => (
  <Html>
    <Head />
    <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
        <Section style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <Heading style={{ color: '#166534', marginBottom: '24px' }}>{title}</Heading>
          
          <Text style={{ fontSize: '16px', lineHeight: '1.7', color: '#334155' }}>
            Dear {recipientName},
          </Text>
          
          <Text style={{ fontSize: '16px', lineHeight: '1.7', color: '#334155', whiteSpace: 'pre-wrap' }}>
            {content}
          </Text>

          <Hr style={{ margin: '32px 0', borderColor: '#e2e8f0' }} />

          <Text style={{ fontSize: '14px', color: '#64748b' }}>
            Best regards,<br />
            The EaziWage Team
          </Text>
        </Section>

        <Text style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '24px' }}>
          This is an official communication from EaziWage.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default BroadcastEmail;