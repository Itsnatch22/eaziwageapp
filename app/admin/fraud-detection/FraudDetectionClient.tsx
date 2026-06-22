'use client';
import React, { useMemo, useState } from 'react';

export type FraudSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FraudFlagType =
  | 'velocity'
  | 'risk_score_threshold'
  | 'kyc_mismatch'
  | 'employer_not_linked'
  | 'unverified_payment_method'
  | 'pattern_anomaly'
  | 'manual_report';

export interface FraudFlagMetadata {
  all_flags: Array<{ flagType: FraudFlagType; severity: FraudSeverity; description: string; metadata?: Record<string, unknown> }>;
}

export interface FraudCase {
  flagId: string;
  flagType: FraudFlagType;
  severity: FraudSeverity;
  description: string;
  triggeredBy: string;
  flagStatus: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  metadata: FraudFlagMetadata | null;
  flagCreatedAt: string;

  advanceId: string;
  advanceAmount: number;
  advanceNetAmount: number;
  advanceCurrency: string;
  disbursementMethod: string | null;
  requestedAt: string | null;

  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  employeeCode: string | null;
  kycStatus: string | null;
  riskScore: number | null;
  country: string | null;

  employerId: string | null;
  companyName: string | null;
  companyCode: string | null;
  employerFrozen: boolean;
}

export default function FraudDetectionClient({ initialCases }: { initialCases: FraudCase[] }) {
  const [cases, setCases] = useState<FraudCase[]>(initialCases ?? []);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'reviewed' | 'cleared' | 'confirmed_fraud'>('open');
  const [severityFilter, setSeverityFilter] = useState<'all' | FraudSeverity>('all');
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (filterStatus !== 'all' && filterStatus !== 'open' && c.flagStatus !== filterStatus) return false;
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
      return true;
    });
  }, [cases, filterStatus, severityFilter]);

  const formatAmount = (amt: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amt);
    } catch {
      return `${currency} ${amt}`;
    }
  };

  async function performReview(action: 'clear' | 'confirm_fraud', fc: FraudCase, notes: string) {
    if (!notes || notes.trim().length === 0) return alert('Notes are required');
    setInFlight((s) => ({ ...s, [fc.flagId]: true }));
    try {
      const res = await fetch('/api/admin/fraud/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: fc.flagId, advanceId: fc.advanceId, action, notes }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Review failed');

      setCases((prev) => prev.filter((p) => p.flagId !== fc.flagId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed';
      alert(message);
    } finally {
      setInFlight((s) => ({ ...s, [fc.flagId]: false }));
    }
  }

  if (cases.length === 0) return <div className="p-6">✅ No open fraud flags. All advances are processing normally.</div>;

  return (
    <div className="space-y-4 mt-6">
      
      <div className="flex items-center gap-4">
        <div className="px-3 py-2 bg-red-100 text-red-700 rounded">🚨 {cases.length} Open Flags</div>
        <div className="px-3 py-2 bg-orange-100 text-orange-700 rounded">⚠️ {cases.filter(c => c.severity === 'critical').length} Critical</div>
        <div className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded">✅ Cleared Today: 0</div>
      </div>

      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded ${filterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>All</button>
          <button onClick={() => setFilterStatus('open')} className={`px-3 py-1 rounded ${filterStatus === 'open' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Open</button>
          <button onClick={() => setFilterStatus('reviewed')} className={`px-3 py-1 rounded ${filterStatus === 'reviewed' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Reviewed</button>
          <button onClick={() => setFilterStatus('cleared')} className={`px-3 py-1 rounded ${filterStatus === 'cleared' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Cleared</button>
          <button onClick={() => setFilterStatus('confirmed_fraud')} className={`px-3 py-1 rounded ${filterStatus === 'confirmed_fraud' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>Confirmed Fraud</button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select value={severityFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSeverityFilter(e.target.value as 'all' | FraudSeverity)} className="px-3 py-1 border rounded">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      
      <div className="grid gap-4">
        {filtered.map((c) => (
          <div key={c.flagId} className={`p-4 rounded-lg border ${c.severity === 'critical' ? 'border-red-400' : c.severity === 'high' ? 'border-orange-400' : c.severity === 'medium' ? 'border-amber-400' : 'border-blue-300'}` }>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-semibold">{c.severity.toUpperCase()} · {c.flagType}</div>
                  <div className="text-sm text-slate-500">[{c.flagStatus}] · {new Date(c.flagCreatedAt).toLocaleString()}</div>
                </div>

                <div className="mt-2 text-sm text-slate-700">
                  <div>Employee: <strong>{c.employeeName}</strong> ({c.employeeCode}) · {c.country}</div>
                  <div>Employer: <strong>{c.companyName}</strong> {c.employerFrozen ? '⚠️ Employer Frozen' : ''}</div>
                  <div className="mt-1">Advance: {formatAmount(c.advanceAmount, c.advanceCurrency)} → {formatAmount(c.advanceNetAmount, c.advanceCurrency)} net · {c.disbursementMethod}</div>
                  <div>Risk Score: <strong style={{ color: c.riskScore && c.riskScore > 7.5 ? 'red' : c.riskScore && c.riskScore >= 5 ? 'orange' : 'green' }}>{c.riskScore?.toFixed(1) ?? 'N/A'}/10</strong></div>
                </div>

                <div className="mt-3 text-sm bg-slate-50 p-3 rounded">
                  <div className="font-semibold mb-1">Flag Reason</div>
                  <div>{c.description}</div>
                  {c.metadata?.all_flags && Array.isArray(c.metadata.all_flags) && (
                    <div className="mt-2 text-xs text-slate-600">
                      {c.metadata.all_flags.map((f, i) => (
                        <div key={i}>• {f.description} ({f.flagType})</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <textarea placeholder="Review notes (required)" rows={3} className="w-full border rounded p-2" id={`notes-${c.flagId}`} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    disabled={inFlight[c.flagId]}
                    onClick={async () => {
                      const notesEl = document.getElementById(`notes-${c.flagId}`) as HTMLTextAreaElement | null;
                      const notes = notesEl?.value ?? '';
                      if (!notes.trim()) return alert('Notes required');
                      if (c.employerFrozen) {
                        alert('Employer is frozen — clearing will not disburse until employer is unfrozen.');
                      }
                      await performReview('clear', c, notes);
                    }}
                    className="bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    {inFlight[c.flagId] ? 'Processing...' : '✅ Clear & Disburse'}
                  </button>

                  <button
                    disabled={inFlight[c.flagId]}
                    onClick={async () => {
                      const notesEl = document.getElementById(`notes-${c.flagId}`) as HTMLTextAreaElement | null;
                      const notes = notesEl?.value ?? '';
                      if (!notes.trim()) return alert('Notes required');

                      const ok = confirm('Confirm Fraud\nThis will permanently reject the advance and mark it as confirmed fraud.');
                      if (!ok) return;
                      await performReview('confirm_fraud', c, notes);
                    }}
                    className="bg-rose-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    {inFlight[c.flagId] ? 'Processing...' : '❌ Confirm Fraud'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
