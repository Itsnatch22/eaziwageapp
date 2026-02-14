'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/constants';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface PayrollIntegration {
  id: string;
  provider: string;
  status: 'active' | 'inactive';
  last_synced_at: string | null;
}

interface Policy {
  id: string;
  organization_id: string;
  withdrawal_limit_percent: number;
  frequency_cap: number | null;
  frequency_period: 'week' | 'month';
  auto_approval_enabled: boolean;
  auto_approval_threshold: number;
  access_days: number[];
  access_start_hour: number;
  access_end_hour: number;
  updated_at: string;
}

interface CountryCap {
  country: string;
  cap_percent: number;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchPolicies(): Promise<Policy> {
  const res = await fetch('/api/policies');
  if (!res.ok) throw new Error('Failed to fetch policies');
  return res.json();
}

async function updatePolicies(data: Partial<Policy>): Promise<Policy> {
  const res = await fetch('/api/policies', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update policies');
  return res.json();
}

async function fetchIntegration(): Promise<PayrollIntegration | null> {
  const res = await fetch('/api/integrations');
  if (!res.ok) throw new Error('Failed to fetch integration');
  return res.json();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SettingsTab = () => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [integration, setIntegration] = useState<PayrollIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [countryCaps] = useState<CountryCap[]>([
    { country: 'Kenya', cap_percent: 60 },
    { country: 'Uganda', cap_percent: 60 },
    { country: 'Tanzania', cap_percent: 30 },
    { country: 'Rwanda', cap_percent: 45 },
  ]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [policyData, integrationData] = await Promise.all([
          fetchPolicies(),
          fetchIntegration(),
        ]);
        setPolicy(policyData);
        setIntegration(integrationData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!policy) return;

    const supabase = createClient();
    const channel = supabase
      .channel('policy-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'policies',
          filter: `id=eq.${policy.id}`,
        },
        (payload) => {
          setPolicy(payload.new as Policy);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [policy]);

  // Realtime integration updates
  useEffect(() => {
    if (!integration) return;

    const supabase = createClient();
    const channel = supabase
      .channel('integration-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_integrations',
          filter: `id=eq.${integration.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setIntegration(payload.new as PayrollIntegration);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [integration]);

  const handleSave = async () => {
    if (!policy) return;

    setSaving(true);
    setSaved(false);

    try {
      const updated = await updatePolicies({
        withdrawal_limit_percent: policy.withdrawal_limit_percent,
        frequency_cap: policy.frequency_cap,
        frequency_period: policy.frequency_period,
        auto_approval_enabled: policy.auto_approval_enabled,
        auto_approval_threshold: policy.auto_approval_threshold,
        access_days: policy.access_days,
        access_start_hour: policy.access_start_hour,
        access_end_hour: policy.access_end_hour,
      });

      setPolicy(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="max-w-2xl bg-white rounded-3xl border border-slate-200 p-10 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-white rounded-3xl border border-slate-200 p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
      <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">
        Organization Controls
      </h3>

      <div className="space-y-10">
        {/* Payroll Integration */}
        <section>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
            Payroll Integration
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {integration ? (
              <div className="p-5 border-2 border-blue-100 bg-blue-50/30 rounded-2xl flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-green-600 shadow-sm">
                    {integration.provider.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {integration.provider}
                    </div>
                    <div
                      className={`text-[10px] font-bold flex items-center ${
                        integration.status === 'active'
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {integration.status === 'active' ? (
                        <>
                          <Icons.CheckCircle2 size={10} className="mr-1" /> ACTIVE & SYNCED
                        </>
                      ) : (
                        'NOT CONNECTED'
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-xs font-bold text-green-600 px-4 py-2 hover:bg-white rounded-lg transition-all">
                  Configure
                </button>
              </div>
            ) : (
              <div className="p-5 border-2 border-slate-100 bg-slate-50 rounded-2xl flex justify-between items-center">
                <div className="text-sm font-bold text-slate-500">No integration connected</div>
              </div>
            )}
          </div>
        </section>

        {/* Disbursement Policies */}
        <section>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
            Disbursement Policies
          </h4>
          <div className="space-y-4">
            {/* Withdrawal Limit */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
              <div className="mb-4">
                <div className="text-sm font-black text-slate-900 tracking-tight">
                  Withdrawal Limit
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Max % of earned wage accessible
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={policy.withdrawal_limit_percent}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      withdrawal_limit_percent: parseInt(e.target.value),
                    })
                  }
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <span className="text-xs font-black text-slate-900 w-12 text-right">
                  {policy.withdrawal_limit_percent}%
                </span>
              </div>
            </div>

            {/* Frequency Cap */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
              <div className="mb-4">
                <div className="text-sm font-black text-slate-900 tracking-tight">
                  Frequency Cap
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Max number of requests per period
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  value={policy.frequency_cap ?? ''}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      frequency_cap: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Unlimited"
                  className="w-24 px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <select
                  value={policy.frequency_period}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      frequency_period: e.target.value as 'week' | 'month',
                    })
                  }
                  className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="week">per week</option>
                  <option value="month">per month</option>
                </select>
              </div>
            </div>

            {/* Auto Approval */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-black text-slate-900 tracking-tight">
                    Auto-Approval
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">
                    Instantly approve requests under threshold
                  </div>
                </div>
                <Toggle
                  enabled={policy.auto_approval_enabled}
                  onChange={(enabled) =>
                    setPolicy({ ...policy, auto_approval_enabled: enabled })
                  }
                />
              </div>
              {policy.auto_approval_enabled && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-500">Threshold:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={policy.auto_approval_threshold}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        auto_approval_threshold: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-32 px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <span className="text-xs font-bold text-slate-500">USD</span>
                </div>
              )}
            </div>

            {/* Access Window */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
              <div className="mb-4">
                <div className="text-sm font-black text-slate-900 tracking-tight">
                  Access Window
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  When employees can request transfers
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = policy.access_days.includes(idx)
                          ? policy.access_days.filter((d) => d !== idx)
                          : [...policy.access_days, idx].sort();
                        setPolicy({ ...policy, access_days: days });
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        policy.access_days.includes(idx)
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-slate-500 border border-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">From:</span>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={policy.access_start_hour}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          access_start_hour: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16 px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                    <span className="text-xs font-bold text-slate-500">:00</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">To:</span>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={policy.access_end_hour}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          access_end_hour: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16 px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                    <span className="text-xs font-bold text-slate-500">:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Country Access Caps */}
        <section>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
            Regional Access Caps
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {countryCaps.map((cap) => (
              <div
                key={cap.country}
                className="p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="text-xs font-black text-slate-900">{cap.country}</div>
                <div className="text-lg font-black text-green-600 mt-1">
                  {cap.cap_percent}%
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  Max Cap
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-5 bg-green-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {saving ? (
            <>
              <Spinner />
              <span>Saving...</span>
            </>
          ) : saved ? (
            <>
              <Icons.CheckCircle2 size={20} />
              <span>Saved ✓</span>
            </>
          ) : (
            <span>Update Global Policies</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

const Toggle = ({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) => (
  <div
    onClick={() => onChange(!enabled)}
    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
      enabled ? 'bg-green-600' : 'bg-slate-200'
    }`}
  >
    <div
      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
        enabled ? 'right-1' : 'left-1'
      }`}
    ></div>
  </div>
);

const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

export default SettingsTab;