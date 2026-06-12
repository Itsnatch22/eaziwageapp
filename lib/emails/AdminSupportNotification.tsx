import React from 'react';

interface AdminSupportNotificationProps {
  submitterEmail: string;
  subject: string;
  message: string;
  ticketId: string;
  dashboardUrl?: string;
}

export function AdminSupportNotification({ submitterEmail, subject, message, ticketId, dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com' }: AdminSupportNotificationProps) {
  const ticketUrl = `${dashboardUrl}/admin/support/tickets/${ticketId}`;
  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24, background: '#ffffff' }}>
        <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>New Support Ticket</h2>
        <p style={{ margin: '0 0 12px', color: '#475569' }}>A new support ticket has been submitted by <strong>{submitterEmail}</strong>.</p>
        <div style={{ border: '1px solid #e6e9ef', padding: 12, borderRadius: 8, background: '#f8fafc' }}>
          <p style={{ margin: 0 }}><strong>Subject:</strong> {subject}</p>
          <p style={{ marginTop: 8 }}>{message.length > 800 ? `${message.slice(0, 800)}...` : message}</p>
        </div>

        <p style={{ marginTop: 16 }}>
          <a href={ticketUrl} style={{ backgroundColor: '#16a34a', color: '#ffffff', textDecoration: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600 }}>View ticket in Admin</a>
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ef', margin: '18px 0' }} />

        <p style={{ color: '#94a3b8', fontSize: 12 }}>This is an automated notification from EaziWage. Replying to this email will not open a support thread.</p>
      </div>
    </div>
  );
}

export default AdminSupportNotification;
