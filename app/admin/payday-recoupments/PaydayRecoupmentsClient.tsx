'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type PaydayRecoupment = {
  id: string;
  employer_id: string;
  payday_date: string;
  amount_due: number;
  currency: string;
  status: 'failed';
  failure_reason: string | null;
  merchant_reference: string | null;
  created_at: string;
  updated_at: string;
  company_name: string;
  bank_name: string | null;
  bank_account_number: string | null;
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaydayRecoupmentsClient({ recoupments }: { recoupments: PaydayRecoupment[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState<Record<string, boolean>>({});

  useRealtimeRefresh(
    [{ table: 'payday_recoupments', event: '*', filter: 'status=eq.failed' }],
    () => router.refresh(),
  );

  const active = recoupments.filter((r) => !collected[r.id]);
  const totalDue = active.reduce((sum, r) => sum + r.amount_due, 0);

  async function markCollected(r: PaydayRecoupment) {
    if (!confirm(`Confirm ${fmt(r.amount_due, r.currency)} was received via bank transfer from ${r.company_name}? This will apply it to their outstanding balance.`)) {
      return;
    }
    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const res = await fetch(`/api/admin/payday-recoupments/${r.id}/manual-collect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to mark as collected');
        return;
      }
      setCollected((prev) => ({ ...prev, [r.id]: true }));
      toast.success(`Marked ${r.company_name}'s recoupment as collected`);
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payday Recoupments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Employers whose automated mobile money collection failed. Confirm a bank transfer manually to settle these.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Needs Manual Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{active.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {active[0] ? fmt(totalDue, active[0].currency) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employer</TableHead>
              <TableHead>Payday</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Failure Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No recoupments need manual collection
                </TableCell>
              </TableRow>
            ) : (
              active.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.company_name}</TableCell>
                  <TableCell>{r.payday_date}</TableCell>
                  <TableCell className="font-medium">{fmt(r.amount_due, r.currency)}</TableCell>
                  <TableCell>{r.bank_name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.bank_account_number ?? 'Not on file'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs">{r.failure_reason ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className="bg-red-100 text-red-800">failed</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading[r.id] || !r.bank_account_number}
                      onClick={() => markCollected(r)}
                    >
                      Mark Collected (Bank Transfer)
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
