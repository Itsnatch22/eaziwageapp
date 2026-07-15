'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/shared/CopyButton';

export type RepaymentSchedule = {
  id: string;
  advance_id: string;
  employer_id: string;
  employee_id: string;
  repayment_amount: number;
  currency: string;
  due_date: string;
  payroll_cycle: string;
  repayment_reference: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial' | 'waived' | 'disputed';
  paid_amount: number;
  paid_at: string | null;
  payment_reference: string | null;
  overdue_notified_at: string | null;
  created_at: string;
  employer_name: string;
  employee_name: string;
};

const STATUS_BADGE: Record<RepaymentSchedule['status'], string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  paid:      'bg-green-100 text-green-800',
  overdue:   'bg-red-100 text-red-800',
  partial:   'bg-blue-100 text-blue-800',
  waived:    'bg-gray-100 text-gray-600',
  disputed:  'bg-orange-100 text-orange-800',
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Action = 'mark_paid' | 'mark_waived' | 'send_reminder';

export default function RepaymentsClient({ schedules }: { schedules: RepaymentSchedule[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, RepaymentSchedule['status']>>({});

  // Re-render from server when any active schedule changes (new, overdue flip, payment received)
  useRealtimeRefresh(
    [{ table: 'repayment_schedules', event: '*', filter: 'status=in.(pending,overdue,partial)' }],
    () => router.refresh(),
  );

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      const effectiveStatus = localStatuses[s.id] ?? s.status;
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.repayment_reference.toLowerCase().includes(q) ||
          s.employer_name.toLowerCase().includes(q) ||
          s.employee_name.toLowerCase().includes(q) ||
          s.advance_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [schedules, statusFilter, search, localStatuses]);

  // Summary stats computed from all schedules (unfiltered)
  const pending  = schedules.filter((s) => (localStatuses[s.id] ?? s.status) === 'pending');
  const overdue  = schedules.filter((s) => (localStatuses[s.id] ?? s.status) === 'overdue');
  const paidThisMonth = schedules.filter((s) => {
    if ((localStatuses[s.id] ?? s.status) !== 'paid') return false;
    if (!s.paid_at) return false;
    const now = new Date();
    const paidDate = new Date(s.paid_at);
    return paidDate.getFullYear() === now.getFullYear() && paidDate.getMonth() === now.getMonth();
  });

  const sumAmount = (arr: RepaymentSchedule[]) =>
    arr.reduce((acc, s) => acc + s.repayment_amount, 0);

  async function doAction(id: string, action: Action, paidAmount?: number) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/repayments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, paid_amount: paidAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Action failed');
        return;
      }
      if (action === 'mark_paid') {
        setLocalStatuses((prev) => ({ ...prev, [id]: 'paid' }));
      } else if (action === 'mark_waived') {
        setLocalStatuses((prev) => ({ ...prev, [id]: 'waived' }));
      } else {
        alert('Reminder sent');
      }
    } catch {
      alert('Network error — please try again');
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Repayment Schedules</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
            <div className="text-xs text-muted-foreground">
              {pending[0] ? fmt(sumAmount(pending), pending[0].currency) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdue.length}</div>
            <div className="text-xs text-muted-foreground">
              {overdue[0] ? fmt(sumAmount(overdue), overdue[0].currency) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Paid This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidThisMonth.length}</div>
            <div className="text-xs text-muted-foreground">
              {paidThisMonth[0] ? fmt(sumAmount(paidThisMonth), paidThisMonth[0].currency) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search reference, employer, employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="waived">Waived</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Employer</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No repayment schedules found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const effectiveStatus = localStatuses[s.id] ?? s.status;
                const isLoading = loading[s.id];
                const canAct = effectiveStatus !== 'paid' && effectiveStatus !== 'waived';
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-1.5">
                        {s.repayment_reference}
                        <CopyButton value={s.repayment_reference} label="Copy reference" variant="ghost" size="sm" />
                      </span>
                    </TableCell>
                    <TableCell>{s.employer_name}</TableCell>
                    <TableCell>{s.employee_name}</TableCell>
                    <TableCell className="font-medium">{fmt(s.repayment_amount, s.currency)}</TableCell>
                    <TableCell>{s.due_date}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[effectiveStatus]}>
                        {effectiveStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.paid_at
                        ? new Date(s.paid_at).toLocaleDateString('en-KE')
                        : s.paid_amount > 0
                        ? fmt(s.paid_amount, s.currency)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canAct && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => doAction(s.id, 'mark_paid')}
                            >
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isLoading}
                              onClick={() => doAction(s.id, 'mark_waived')}
                            >
                              Waive
                            </Button>
                          </>
                        )}
                        {effectiveStatus !== 'paid' && effectiveStatus !== 'waived' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isLoading}
                            onClick={() => doAction(s.id, 'send_reminder')}
                          >
                            Remind
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
