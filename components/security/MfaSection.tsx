'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Shield, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { downloadBackupCodesCsv } from '@/lib/utils';
import { CopyButton } from '@/components/shared/CopyButton';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  created_at: string;
}

interface MfaSectionProps {
  /** e.g. '/api/admin/security/mfa', '/api/employee-dashboard/security/mfa' */
  apiBase: string;
  /** Friendly name sent to Supabase on enrollment. */
  friendlyName?: string;
}

/**
 * Shared TOTP enrollment + management UI, used by every surface that offers
 * MFA (employee, employer, admin). All three hit the same lib/mfa-handler.ts
 * contract, so this renders once instead of being hand-copied per surface —
 * previously the admin and employee copies had diverged (alert() vs an
 * inline copyable grid for backup codes, next/image vs raw SVG for the QR,
 * where only the raw-SVG approach actually renders Supabase's qr_code field
 * correctly).
 */
export function MfaSection({ apiBase, friendlyName = 'EaziWage Authenticator' }: MfaSectionProps) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);

  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [showManage, setShowManage] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const refreshStatus = async () => {
    try {
      const res = await fetch(apiBase);
      if (res.ok) {
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
        setFactors(Array.isArray(data.factors) ? data.factors : []);
      }
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => void refreshStatus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', friendlyName }),
      });
      const data = await res.json();
      if (res.ok && (data.success ?? true)) {
        setQrCode(data.qrCode || '');
        setSecret(data.secret || '');
        setFactorId(data.factorId || '');
      } else {
        toast.error(data.error || 'Failed to start MFA enrollment');
        setEnrolling(false);
      }
    } catch (err) {
      console.error('MFA enroll failed:', err);
      toast.error('Failed to start MFA enrollment');
      setEnrolling(false);
    }
  };

  const cancelEnroll = () => {
    setEnrolling(false);
    setQrCode('');
    setSecret('');
    setFactorId('');
    setCode('');
  };

  const verifyEnroll = async () => {
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', factorId, code }),
      });
      const data = await res.json();
      if (res.ok && (data.success ?? true)) {
        toast.success('MFA enabled successfully');
        cancelEnroll();
        await refreshStatus();
      } else {
        toast.error(data.error || 'Invalid verification code');
      }
    } catch (err) {
      console.error('MFA verify failed:', err);
      toast.error('An error occurred during verification');
    } finally {
      setVerifying(false);
    }
  };

  const disableFactor = async (id: string) => {
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', factorId: id }),
      });
      const data = await res.json();
      if (res.ok && (data.success ?? true)) {
        toast.success('MFA factor removed');
        await refreshStatus();
      } else {
        toast.error(data.error || 'Failed to remove factor');
      }
    } catch (err) {
      console.error('Disable MFA failed:', err);
      toast.error('An error occurred while removing the factor');
    }
  };

  const generateBackupCodes = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_backup_codes' }),
      });
      const data = await res.json();
      if (res.ok && (data.success ?? true)) {
        setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
        toast.success('Backup codes generated — save them securely');
      } else {
        toast.error(data.error || 'Failed to generate backup codes');
      }
    } catch (err) {
      console.error('Backup code generation failed:', err);
      toast.error('An error occurred while generating backup codes');
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 py-2">Checking MFA status…</div>;
  }

  if (enrolling) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          {qrCode && (
            <div className="w-48 h-48 mx-auto bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`}
                alt="MFA QR code"
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
              />
            </div>
          )}
          {secret && (
            <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1.5">
              Or enter this key manually: <code className="font-mono">{secret}</code>
              <CopyButton value={secret} label="Copy setup key" variant="ghost" size="sm" />
            </p>
          )}
        </div>
        <div className="space-y-2 max-w-xs mx-auto">
          <Label>Verification Code</Label>
          <Input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
          />
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={verifyEnroll} disabled={verifying || code.length !== 6} className="bg-primary text-white">
            {verifying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
              </span>
            ) : (
              'Enable MFA'
            )}
          </Button>
          <Button variant="outline" onClick={cancelEnroll}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-slate-400" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Authenticator App (TOTP)</p>
            <p className="text-sm text-slate-500">{enabled ? 'Enabled' : 'Add an extra layer of security'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!enabled && (
            <Button size="sm" onClick={startEnroll}>Enable</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowManage(true)}>Manage</Button>
        </div>
      </div>

      {showManage && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Manage MFA & Backup Codes</h3>
                  <p className="text-sm text-slate-500">View and remove registered authenticators. Generate one-time backup codes.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowManage(false); setBackupCodes(null); }}
                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Registered Authenticators</h4>
              {factors.length === 0 ? (
                <p className="text-sm text-slate-500">No authenticators found.</p>
              ) : (
                <div className="space-y-2">
                  {factors.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{f.friendly_name || f.factor_type}</p>
                        <p className="text-[10px] text-slate-400">{f.created_at ? new Date(f.created_at).toLocaleString() : ''}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => disableFactor(f.id)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Backup Codes</h4>
                {backupCodes ? (
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      Save these codes somewhere safe — each code can be used once to sign in if you lose access to your authenticator.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((c, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-md text-xs font-mono flex items-center justify-between">
                          <span>{c}</span>
                          <CopyButton value={c} label="Copy backup code" variant="ghost" size="sm" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" onClick={() => downloadBackupCodesCsv(backupCodes)}>Download CSV</Button>
                      <Button onClick={() => { setBackupCodes(null); setShowManage(false); }} className="bg-primary text-white">Done</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button onClick={generateBackupCodes} disabled={backupLoading} className="bg-primary text-white">
                      {backupLoading ? 'Generating...' : 'Generate Backup Codes'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowManage(false)}>Close</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
