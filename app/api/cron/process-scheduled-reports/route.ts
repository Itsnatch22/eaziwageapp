import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEnv } from '@/env';
import { generateReportCsv, formatFileSize, type ReportType } from '@/lib/services/report-generation';

export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function run(): Promise<NextResponse> {
  const nowIso = new Date().toISOString();

  const { data: dueReports, error: fetchError } = await supabaseAdmin
    .from('admin_reports')
    .select('id, name, description, type, period, scheduled_for')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso);

  if (fetchError) {
    console.error('[cron/process-scheduled-reports] Fetch failed:', fetchError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!dueReports?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const report of dueReports) {
    try {
      const startedAt = Date.now();
      const { csv, recordCount } = await generateReportCsv(
        supabaseAdmin,
        report.type as ReportType,
        report.period,
        { name: report.name, description: report.description },
      );
      const processingTimeSeconds = (Date.now() - startedAt) / 1000;

      const { error: updateError } = await supabaseAdmin
        .from('admin_reports')
        .update({
          status: 'ready',
          generated_at: new Date().toISOString(),
          download_url: `/api/admin/reports/${report.id}/download`,
          report_data: csv,
          file_size: formatFileSize(Buffer.byteLength(csv, 'utf8')),
          metrics: {
            totalRecords: recordCount,
            processingTime: Number(processingTimeSeconds.toFixed(2)),
            accuracy: 100,
          },
        })
        .eq('id', report.id);

      if (updateError) throw updateError;
      processed++;
    } catch (err) {
      console.error(`[cron/process-scheduled-reports] Failed to generate report ${report.id}:`, err);
      await supabaseAdmin.from('admin_reports').update({ status: 'failed' }).eq('id', report.id);
      failed++;
    }
  }

  if (processed > 0) {
    try {
      const env = getEnv();
      const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
      const keys = await redis.keys('admin:reports:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch (cacheError) {
      console.warn('[cron/process-scheduled-reports] Failed to clear cache:', cacheError);
    }
  }

  console.log(`[cron/process-scheduled-reports] Processed ${processed}, failed ${failed}`);
  return NextResponse.json({ processed, failed });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
