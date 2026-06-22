
import { supabaseAdmin } from '../lib/supabaseAdmin';
import crypto from 'crypto';

async function run() {
  const keyHex = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!keyHex) {
    console.error('WEBHOOK_SECRET_ENCRYPTION_KEY env var is required (32 bytes hex)');
    process.exit(1);
  }

  if (keyHex.length !== 64) {
    console.error('Encryption key must be 64 hex characters (32 bytes)');
    process.exit(1);
  }

  const key = Buffer.from(keyHex, 'hex');

  const { data: rows, error } = await supabaseAdmin
    .from('payroll_integrations')
    .select('id, webhook_secret')
    .not('webhook_secret', 'is', null);

  if (error) {
    console.error('Failed to load integrations', error);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No rows to migrate.');
    process.exit(0);
  }

  for (const r of rows) {
    const id = r.id as string;
    const secret = r.webhook_secret as string;
    if (!secret) continue;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;

    const { error: upErr } = await supabaseAdmin
      .from('payroll_integrations')
      .update({ webhook_secret_encrypted: payload })
      .eq('id', id);

    if (upErr) {
      console.error('Failed to update integration', id, upErr);
    } else {
      console.log('Migrated integration', id);
      const { error: nullErr } = await supabaseAdmin
        .from('payroll_integrations')
        .update({ webhook_secret: null })
        .eq('id', id);
      if (nullErr) console.error('Failed to null plaintext secret for', id, nullErr);
    }
  }

  console.log('Migration complete. Verify and then rotate secrets if needed.');
}

run().catch(err => { console.error('migration failed', err); process.exit(1); });
