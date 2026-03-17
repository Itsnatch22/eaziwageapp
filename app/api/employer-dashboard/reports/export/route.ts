import { NextRequest, NextResponse } from 'next/server';
import { buildCsv, buildSimplePdf } from '@/lib/server/export-utils';
import { ReportsQuerySchema } from '@/lib/validations/employer-reports';

export const runtime = 'nodejs';

type ExportType = 'advances' | 'employees' | 'financial' | 'payroll' | 'all';
type ExportFormat = 'csv' | 'pdf';

interface ReportData {
  period: { label: string; from: string; to: string };
  advances: {
    total: number;
    disbursed: number;
    pending: number;
    denied: number;
    total_amount: number;
    total_fees: number;
    avg_amount: number;
    by_method: { mobile_money: number; bank_transfer: number };
  };
  employees: {
    total: number;
    active: number;
    with_advances: number;
    utilization_rate: number;
  };
  previous_period: { total_amount: number; total_fees: number };
  monthly_trend: Array<{ label: string; amount: number; count: number }>;
  risk_score: number | null;
  risk_rating: string | null;
}

function toCsvRows(type: ExportType, data: ReportData): Array<Array<string | number>> {
  if (type === 'advances') {
    return [
      ['Report', 'Advances Summary'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Value'],
      ['Total Requests', data.advances.total],
      ['Disbursed', data.advances.disbursed],
      ['Pending', data.advances.pending],
      ['Denied', data.advances.denied],
      ['Total Amount Disbursed', data.advances.total_amount],
      ['Total Fees Collected', data.advances.total_fees],
      ['Average Advance Amount', data.advances.avg_amount.toFixed(2)],
      ['Mobile Money', data.advances.by_method.mobile_money],
      ['Bank Transfer', data.advances.by_method.bank_transfer],
    ];
  }

  if (type === 'employees') {
    return [
      ['Report', 'Employee Summary'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Value'],
      ['Total Employees', data.employees.total],
      ['Active Employees', data.employees.active],
      ['Employees with Advances', data.employees.with_advances],
      ['Utilization Rate (%)', data.employees.utilization_rate],
    ];
  }

  if (type === 'financial') {
    return [
      ['Report', 'Financial Report'],
      ['Period', data.period.label],
      [''],
      ['Metric', 'Current Period', 'Previous Period'],
      ['Total Disbursed', data.advances.total_amount, data.previous_period.total_amount],
      ['Total Fees', data.advances.total_fees, data.previous_period.total_fees],
      ['Average Advance', data.advances.avg_amount.toFixed(2), ''],
      ['Risk Score', data.risk_score ?? 'N/A', ''],
      ['Risk Rating', data.risk_rating ?? 'N/A', ''],
    ];
  }

  if (type === 'payroll') {
    const rows: Array<Array<string | number>> = [
      ['Report', 'Payroll Reconciliation'],
      ['Period', data.period.label],
      [''],
      ['Month', 'Total Disbursed', 'Advance Count'],
    ];
    for (const item of data.monthly_trend) {
      rows.push([item.label, item.amount, item.count]);
    }
    return rows;
  }

  return [
    ['Report', 'Comprehensive Employer Report'],
    ['Period', data.period.label],
    ['Generated At', new Date().toISOString()],
    [''],
    ['Section', 'Metric', 'Value'],
    ['Advances', 'Total Requests', data.advances.total],
    ['Advances', 'Disbursed', data.advances.disbursed],
    ['Advances', 'Pending', data.advances.pending],
    ['Advances', 'Denied', data.advances.denied],
    ['Advances', 'Total Amount', data.advances.total_amount],
    ['Advances', 'Total Fees', data.advances.total_fees],
    ['Employees', 'Total', data.employees.total],
    ['Employees', 'Active', data.employees.active],
    ['Employees', 'With Advances', data.employees.with_advances],
    ['Employees', 'Utilization Rate (%)', data.employees.utilization_rate],
    ['Financial', 'Previous Amount', data.previous_period.total_amount],
    ['Financial', 'Previous Fees', data.previous_period.total_fees],
  ];
}

function toPdfLines(type: ExportType, data: ReportData): string[] {
  const rows = toCsvRows(type, data);
  return rows
    .filter((row) => row.length > 0)
    .map((row) => row.map((cell) => String(cell)).join(' | '));
}

function buildFilename(type: ExportType, periodLabel: string, format: ExportFormat): string {
  const clean = periodLabel.replace(/\s+/g, '-').toLowerCase();
  const prefix = type === 'all' ? 'comprehensive-report' : `${type}-report`;
  return `${prefix}-${clean}.${format}`;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const type = (params.get('type') ?? 'all') as ExportType;
  const format = (params.get('format') ?? 'csv') as ExportFormat;

  if (!['advances', 'employees', 'financial', 'payroll', 'all'].includes(type)) {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 422 });
  }
  if (!['csv', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid export format' }, { status: 422 });
  }

  const parsed = ReportsQuerySchema.safeParse({
    period: params.get('period') ?? 'this_month',
    month: params.get('month') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', detail: parsed.error.issues }, { status: 422 });
  }

  const reportParams = new URLSearchParams({
    period: parsed.data.period,
    ...(parsed.data.month ? { month: parsed.data.month } : {}),
  });
  const reportUrl = new URL(`/api/employer-dashboard/reports?${reportParams}`, req.url);
  const reportRes = await fetch(reportUrl, {
    method: 'GET',
    headers: { cookie: req.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });

  if (!reportRes.ok) {
    const errorPayload = await reportRes.text();
    return NextResponse.json({ error: `Failed to fetch report data: ${errorPayload}` }, { status: reportRes.status });
  }

  const json = await reportRes.json();
  const data = json.data as ReportData | undefined;
  if (!data) {
    return NextResponse.json({ error: 'No report data available' }, { status: 404 });
  }

  const filename = buildFilename(type, data.period.label, format);

  if (format === 'pdf') {
    const pdf = buildSimplePdf(toPdfLines(type, data));
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = buildCsv(toCsvRows(type, data));
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
