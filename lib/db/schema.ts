import { pgTable, uuid, text, numeric, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const employeeStatusEnum = pgEnum('employee_status', ['Active', 'Inactive']);

// Organizations table (referenced by employees)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  country: text('country').notNull(), // 'Kenya' | 'Uganda' | 'Tanzania' | 'Rwanda'
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Employees table
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Employee details
  name: text('name').notNull(),
  email: text('email'),
  employee_number: text('employee_number'), // e.g., "EW-1000"
  department: text('department').notNull(),
  
  // Financial
  salary: numeric('salary', { precision: 12, scale: 2 }).notNull(),
  withdrawn_this_month: numeric('withdrawn_this_month', { precision: 12, scale: 2 })
    .default('0')
    .notNull(),
  
  // Status
  status: employeeStatusEnum('status').default('Active').notNull(),
  
  // Metadata (for extensibility)
  metadata: jsonb('metadata').$type<{
    hire_date?: string;
    phone?: string;
    address?: string;
    custom_fields?: Record<string, unknown>;
  }>(),
  
  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'), // Soft delete support
}, (table) => ({
  // Indexes for performance
  organization_idx: index('employees_organization_idx').on(table.organization_id),
  name_idx: index('employees_name_idx').on(table.name),
  status_idx: index('employees_status_idx').on(table.status),
  deleted_at_idx: index('employees_deleted_at_idx').on(table.deleted_at),
  
  // Composite index for common queries
  org_status_idx: index('employees_org_status_idx').on(
    table.organization_id,
    table.status,
    table.deleted_at
  ),
}));

// Policies table (for reference with employees)
export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .unique(),
  
  withdrawal_limit_percent: numeric('withdrawal_limit_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('50'),
  frequency_cap: numeric('frequency_cap', { precision: 5, scale: 0 }),
  frequency_period: text('frequency_period').$type<'week' | 'month'>().default('month').notNull(),
  auto_approval_enabled: numeric('auto_approval_enabled', { precision: 1, scale: 0 })
    .default('0')
    .notNull(), // 0 or 1 (boolean)
  auto_approval_threshold: numeric('auto_approval_threshold', { precision: 12, scale: 2 })
    .default('500')
    .notNull(),
  access_days: jsonb('access_days').$type<number[]>().default(sql`'[0,1,2,3,4,5,6]'::jsonb`).notNull(),
  access_start_hour: numeric('access_start_hour', { precision: 2, scale: 0 }).default('0').notNull(),
  access_end_hour: numeric('access_end_hour', { precision: 2, scale: 0 }).default('23').notNull(),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Payroll integrations table
export const payrollIntegrations = pgTable('payroll_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .unique(),
  
  provider: text('provider').notNull(), // 'ADP Workforce Now', 'Gusto', etc.
  status: text('status').$type<'active' | 'inactive'>().default('inactive').notNull(),
  last_synced_at: timestamp('last_synced_at'),
  
  credentials: jsonb('credentials').$type<Record<string, unknown>>(), // Encrypted in production
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Advances table (Wage requests)
export const advances = pgTable('advances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employee_id: uuid('employee_id').notNull(), // References profiles/employees
  employer_id: uuid('employer_id'),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  fee_amount: numeric('fee_amount', { precision: 12, scale: 2 }).default('0'),
  reason: text('reason'),
  
  status: text('status').default('pending').notNull(),
  reference: text('reference').unique(), // Merchant Reference (EWA-XXX)
  internal_reference: text('internal_reference'), // Dusupay Reference
  
  requested_at: timestamp('requested_at').defaultNow(),
  approved_at: timestamp('approved_at'),
  approved_by: uuid('approved_by'),
  disbursed_at: timestamp('disbursed_at'),
  repaid_at: timestamp('repaid_at'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  reference_idx: index('advances_reference_idx').on(table.reference),
  employee_idx: index('advances_employee_idx').on(table.employee_id),
  status_idx: index('advances_status_idx').on(table.status),
}));

// Dusupay Transactions Audit Table
export const dusupayTransactions = pgTable('dusupay_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_reference: text('merchant_reference').notNull().unique(),
  internal_reference: text('internal_reference'),
  event_type: text('event_type').notNull(),
  status: text('status').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  currency: text('currency'),
  raw_payload: jsonb('raw_payload').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  merchant_ref_idx: index('dusupay_tx_merchant_ref_idx').on(table.merchant_reference),
}));

// Employer Wallets
export const employerWallets = pgTable('employer_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  employer_id: uuid('employer_id').notNull().unique(), // References employer_onboarding
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  arrears_balance: numeric('arrears_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  currency: text('currency').default('KES').notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Wallet Transactions (Funding/Payouts)
export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet_id: uuid('wallet_id').notNull().references(() => employerWallets.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), // Positive for deposits, negative for payouts
  type: text('type').$type<'deposit' | 'withdrawal' | 'payout' | 'refund' | 'arrears_payment'>().notNull(),
  status: text('status').default('pending').notNull(), // pending, completed, failed
  reference: text('reference').unique(),
  internal_reference: text('internal_reference'),
  description: text('description'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  wallet_idx: index('wallet_tx_wallet_idx').on(table.wallet_id),
  reference_idx: index('wallet_tx_reference_idx').on(table.reference),
}));

// Type exports
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type PayrollIntegration = typeof payrollIntegrations.$inferSelect;
export type Advance = typeof advances.$inferSelect;
export type NewAdvance = typeof advances.$inferInsert;
export type DusupayTransaction = typeof dusupayTransactions.$inferSelect;
export type EmployerWallet = typeof employerWallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;