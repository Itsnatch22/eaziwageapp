'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type TrustedDevice = {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_used_at: string | null;
};

interface SessionsSectionProps {
  apiBase: string;
}

export function SessionsSection({ apiBase }: SessionsSectionProps) {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const response = await fetch(apiBase);
      const data = await response.json().catch(() => null) as { sessions?: TrustedDevice[]; error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error || 'Failed to load trusted devices');
        return;
      }
      setDevices(data?.sessions ?? []);
    } catch {
      toast.error('Failed to load trusted devices');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    Promise.resolve().then(() => void loadDevices());
  }, [loadDevices]);

  const removeDevice = async (id: string) => {
    setBusyId(id);
    try {
      const response = await fetch(`${apiBase}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error || 'Failed to remove trusted device');
        return;
      }
      setDevices((current) => current.filter((device) => device.id !== id));
      toast.success('Device removed. Its next login will trigger a new-device alert.');
    } catch {
      toast.error('Failed to remove trusted device');
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async () => {
    setSigningOut(true);
    try {
      const response = await fetch(apiBase, { method: 'POST' });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error || 'Failed to sign out other sessions');
        return;
      }
      toast.success('All other sessions have been signed out.');
    } catch {
      toast.error('Failed to sign out other sessions');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Trusted devices and sessions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Trusted devices</h3>
          <p className="text-sm text-muted-foreground">
            Removing a device means its next login will be treated as a new device.
          </p>
        </div>
        <Button disabled={signingOut} onClick={signOutOthers} variant="outline">
          {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sign out all other sessions
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : devices.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No trusted devices are recorded.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {devices.map((device) => {
            const Icon = device.device_name?.toLowerCase().includes('mobile') ? Smartphone : Monitor;
            return (
              <li className="flex items-center justify-between gap-4 py-3" key={device.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{device.device_name || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.last_used_at ? `Last used ${new Date(device.last_used_at).toLocaleString()}` : 'Last use unknown'}
                      {device.ip_address ? ` · ${device.ip_address}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  disabled={busyId === device.id}
                  onClick={() => void removeDevice(device.id)}
                  size="sm"
                  variant="outline"
                >
                  {busyId === device.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
