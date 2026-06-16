'use client';

import React, { useEffect, useState } from 'react';

type TopUpRequest = {
  id: string;
  wallet_id: string;
  amount: number;
  type: string;
  status: string;
  reference?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export default function TopUpRequestsPage() {
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wallet/topup-requests');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setRequests(json.requests || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const approve = async (id: string) => {
    if (!confirm('Approve this top-up request?')) return;
    setApproving(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/wallet/topup-requests/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Approve failed');
      // remove from list
      setRequests(prev => prev.filter(r => r.id !== id));
      alert('Top-up approved and funded.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Pending Top-up Requests</h1>
      <button onClick={fetchRequests} disabled={loading} style={{ marginBottom: 12 }}>Refresh</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : requests.length === 0 ? (
        <div>No pending top-up requests.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>ID</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Employer ID</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Amount</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Requested At</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Reference</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Description</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '8px 4px' }}>{r.id}</td>
                <td style={{ padding: '8px 4px' }}>{(r.metadata as any)?.employer_id ?? 'N/A'}</td>
                <td style={{ padding: '8px 4px' }}>{r.amount}</td>
                <td style={{ padding: '8px 4px' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ((r.metadata as any)?.requested_at ? new Date((r.metadata as any).requested_at as string).toLocaleString() : '')}</td>
                <td style={{ padding: '8px 4px' }}>{r.reference ?? '-'}</td>
                <td style={{ padding: '8px 4px' }}>{r.description ?? '-'}</td>
                <td style={{ padding: '8px 4px' }}>
                  <button onClick={() => approve(r.id)} disabled={!!approving[r.id]}>
                    {approving[r.id] ? 'Approving…' : 'Approve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
