'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Activity, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import EmployerDetailNav from '../EmployerDetailNav';

interface EmployerConfig {
  advance_limit_percent: number | null;
  cooldown_days: number | null;
  processing_fee: number | null;
  credit_limit: number | null;
  max_monthly_advances: number | null;
  ewa_enabled: boolean | null;
  instant_enabled: boolean | null;
  auto_approve: boolean | null;
  weekend_access: boolean | null;
}

export default function EmployerSettingsClient({ employerId }: { employerId: string }) {
  const [companyName, setCompanyName] = useState<string | undefined>();
  const [liveEmployerId, setLiveEmployerId] = useState<string | null>(null);
  const [config, setConfig] = useState<EmployerConfig | null>(null);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [walletRes, employerRes] = await Promise.all([
          fetch(`/api/admin/employers/${employerId}/wallet`),
          fetch(`/api/admin/employers/${employerId}`),
        ]);

        if (!walletRes.ok) {
          setError('Failed to resolve employer.');
          return;
        }
        const walletJson = await walletRes.json();
        setLiveEmployerId(walletJson.live_employer_id);
        setCompanyName(walletJson.company_name);

        if (employerRes.ok) {
          const employerJson = await employerRes.json();
          setBankName(employerJson.bank_name || '');
          setBankAccountNumber(employerJson.bank_account_number && employerJson.bank_account_number !== '[Encrypted]' ? '' : '');
        }

        const settingsRes = await fetch(`/api/admin/settings/employers/${walletJson.live_employer_id}`);
        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          setConfig(settingsJson.settings);
        }
      } catch {
        setError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [employerId]);

  const handleSaveConfig = async () => {
    if (!liveEmployerId || !config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/employers/${liveEmployerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Employer settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBank = async () => {
    if (!bankName.trim() || !bankAccountNumber.trim()) {
      toast.error('Bank name and account number are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employers/${employerId}/bank`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_name: bankName.trim(), bank_account_number: bankAccountNumber.trim(), reason: 'Updated via employer settings page' }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Bank details updated');
        setBankAccountNumber('');
      } else {
        toast.error(json.error || 'Failed to update bank details');
      }
    } catch {
      toast.error('Failed to update bank details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Activity className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="space-y-6">
        <EmployerDetailNav employerId={employerId} />
        <div className="text-center py-12 text-slate-500">{error || 'Settings unavailable for this employer.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <EmployerDetailNav employerId={employerId} companyName={companyName} />

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">EWA Configuration</h3>
          <Button size="sm" onClick={handleSaveConfig} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Advance Limit (%)</Label>
            <Input
              type="number"
              value={config.advance_limit_percent ?? ''}
              onChange={(e) => setConfig({ ...config, advance_limit_percent: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cooldown (days)</Label>
            <Input
              type="number"
              value={config.cooldown_days ?? ''}
              onChange={(e) => setConfig({ ...config, cooldown_days: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Processing Fee (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.processing_fee ?? ''}
              onChange={(e) => setConfig({ ...config, processing_fee: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Credit Limit</Label>
            <Input
              type="number"
              value={config.credit_limit ?? ''}
              onChange={(e) => setConfig({ ...config, credit_limit: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Monthly Advances</Label>
            <Input
              type="number"
              value={config.max_monthly_advances ?? ''}
              onChange={(e) => setConfig({ ...config, max_monthly_advances: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
          {([
            ['ewa_enabled', 'EWA Enabled'],
            ['instant_enabled', 'Instant Disbursement'],
            ['auto_approve', 'Auto-Approve Requests'],
            ['weekend_access', 'Weekend Access'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
              <Switch
                checked={Boolean(config[key])}
                onCheckedChange={(checked) => setConfig({ ...config, [key]: checked })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bank Details</h3>
          <Button size="sm" variant="outline" onClick={handleSaveBank} disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> Update Bank
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Stanbic Bank" />
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Enter new account number to update"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">Account numbers are encrypted at rest and never shown again after saving — leave blank to keep unchanged.</p>
      </div>
    </div>
  );
}
