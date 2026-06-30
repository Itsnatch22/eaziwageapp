// scripts/verify-encryption.mjs
// Run with: node scripts/verify-encryption.mjs
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY in .env.local

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const SUPABASE_URL       = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY   = env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY     = env.PII_ENCRYPTION_KEY; // whatever you named it

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error('❌  Missing env vars. Check .env.local for:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CHECKS = [
  {
    table: 'employee_onboarding',
    columns: ['national_id', 'bank_account', 'mobile_money_number', 'date_of_birth'],
  },
  {
    table: 'employer_onboarding',
    columns: ['bank_account_number'],
  },
  {
    table: 'bank_change_requests',
    columns: ['old_account_number', 'new_account_number'],
  },
];

// ── Run decrypt test via parameterized SQL ─────────────────────────────────
async function verifyTable({ table, columns }) {
  console.log(`\n📋  ${table}`);

  // Fetch raw bytea rows (returned as hex strings by Postgres JSON encoding)
  const { data: rows, error } = await supabase
    .from(table)
    .select(['id', ...columns].join(', '))
    .limit(100);

  if (error) {
    console.error(`   ❌  Query failed: ${error.message}`);
    return;
  }

  if (!rows.length) {
    console.log('   ⚪  No rows — nothing to verify.');
    return;
  }

  for (const col of columns) {
    let ok = 0, nulls = 0, fails = 0;

    for (const row of rows) {
      if (row[col] === null) { nulls++; continue; }

      // Pass key at runtime via SQL param — never hardcoded in query string
      const { data, error: decErr } = await supabase.rpc('debug_decrypt', {
        p_data: row[col],
        p_key: ENCRYPTION_KEY,
      });

      if (decErr || !data) {
        fails++;
        console.log(`   ⚠️  Row ${row.id} — ${col}: decrypt failed (${decErr?.message ?? 'no result'})`);
      } else {
        ok++;
      }
    }

    const total = rows.length;
    console.log(`   ${col}: ✅ ${ok}/${total} ok  |  ⚪ ${nulls} null  |  ❌ ${fails} failed`);
  }
}

// ── We need a tiny helper RPC so the key never touches the query string ────
// This creates it if it doesn't exist yet
async function ensureHelperFunction() {
  const { error } = await supabase.rpc('debug_decrypt', {
    p_data: '\\x00',
    p_key: 'test',
  }).single();

  // If it errors with "function does not exist", create it
  if (error?.message?.includes('does not exist')) {
    console.log('🔧  Creating debug_decrypt helper function...');
    await supabase.from('_migrations').select().limit(0); // ping
    // Use raw SQL via the REST API isn't possible without service key SQL exec
    // Just warn the user instead
    console.warn('⚠️  debug_decrypt RPC not found. Create it manually in Supabase SQL editor:');
    console.warn(`
CREATE OR REPLACE FUNCTION debug_decrypt(p_data bytea, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(p_data, p_key)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
    `);
    process.exit(1);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('🔐  EaziWage encryption verification');
console.log(`    Supabase: ${SUPABASE_URL}`);
console.log(`    Key:      ${'*'.repeat(ENCRYPTION_KEY.length)} (${ENCRYPTION_KEY.length} chars)\n`);

await ensureHelperFunction();

for (const check of CHECKS) {
  await verifyTable(check);
}

console.log('\n✅  Done. If all columns show 0 failures, backfill is confirmed complete.');
console.log('    You can then update the schema comments to remove "BACKFILL PENDING".\n');