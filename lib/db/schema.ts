import { pgTable, uuid, text, numeric, timestamp, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const employeeStatusEnum = pgEnum('employee_status', ['Active', 'Inactive']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  email: text('email'),
  employee_number: text('employee_number'),
  department: text('department').notNull(),
  
  salary: numeric('salary', { precision: 12, scale: 2 }).notNull(),
  withdrawn_this_month: numeric('withdrawn_this_month', { precision: 12, scale: 2 })
    .default('0')
    .notNull(),
  
  status: employeeStatusEnum('status').default('Active').notNull(),
  
  metadata: jsonb('metadata').$type<{
    hire_date?: string;
    phone?: string;
    address?: string;
    custom_fields?: Record<string, unknown>;
  }>(),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (table) => ({
  organization_idx: index('employees_organization_idx').on(table.organization_id),
  name_idx: index('employees_name_idx').on(table.name),
  status_idx: index('employees_status_idx').on(table.status),
  deleted_at_idx: index('employees_deleted_at_idx').on(table.deleted_at),
  
  org_status_idx: index('employees_org_status_idx').on(
    table.organization_id,
    table.status,
    table.deleted_at
  ),
}));

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
    .notNull(), 
  auto_approval_threshold: numeric('auto_approval_threshold', { precision: 12, scale: 2 })
    .default('500')
    .notNull(),
  access_days: jsonb('access_days').$type<number[]>().default(sql`'[0,1,2,3,4,5,6]'::jsonb`).notNull(),
  access_start_hour: numeric('access_start_hour', { precision: 2, scale: 0 }).default('0').notNull(),
  access_end_hour: numeric('access_end_hour', { precision: 2, scale: 0 }).default('23').notNull(),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const payrollIntegrations = pgTable('payroll_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .unique(),
  
  provider: text('provider').notNull(), 
  status: text('status').$type<'active' | 'inactive'>().default('inactive').notNull(),
  last_synced_at: timestamp('last_synced_at'),
  
  credentials: jsonb('credentials').$type<Record<string, unknown>>(), 
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const advances = pgTable('advances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employee_id: uuid('employee_id').notNull(), 
  employer_id: uuid('employer_id'),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  fee_amount: numeric('fee_amount', { precision: 12, scale: 2 }).default('0'),
  reason: text('reason'),
  
  status: text('status').default('pending').notNull(),
  reference: text('reference').unique(), 
  internal_reference: text('internal_reference'),
  
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

export const dusupayTransactions = pgTable('dusupay_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_reference: text('merchant_reference').notNull(),
  internal_reference: text('internal_reference'),
  event_type: text('event_type').notNull(),
  status: text('status').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  currency: text('currency'),
  raw_payload: jsonb('raw_payload').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  merchant_ref_idx: index('dusupay_tx_merchant_ref_idx').on(table.merchant_reference),
  merchant_ref_event_unique: uniqueIndex('dusupay_transactions_merchant_ref_event_unique').on(table.merchant_reference, table.event_type),
}));

export const employerWallets = pgTable('employer_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  employer_id: uuid('employer_id').notNull().unique(), 
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  arrears_balance: numeric('arrears_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  currency: text('currency').default('KES').notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet_id: uuid('wallet_id').notNull().references(() => employerWallets.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), 
  type: text('type').$type<'deposit' | 'withdrawal' | 'payout' | 'refund' | 'arrears_payment' | 'reservation'>().notNull(),
  status: text('status').default('pending').notNull(),
  reference: text('reference').unique(),
  internal_reference: text('internal_reference'),
  description: text('description'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  wallet_idx: index('wallet_tx_wallet_idx').on(table.wallet_id),
  reference_idx: index('wallet_tx_reference_idx').on(table.reference),
}));

export const globalSettings = pgTable('global_settings', {
  id: text('id').primaryKey().default('default'),
  platform_settings: jsonb('platform_settings').notNull().default({}),
  risk_settings: jsonb('risk_settings').notNull().default({}),
  notification_settings: jsonb('notification_settings').notNull().default({}),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const blackoutPeriods = pgTable('blackout_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  start_date: timestamp('start_date').notNull(),
  end_date: timestamp('end_date').notNull(),
  applies_to: text('applies_to').default('all').notNull(), 
  reason: text('reason'),
  is_active: numeric('is_active', { precision: 1, scale: 0 }).default('1').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const legalDocuments = pgTable('legal_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_type: text('document_type').notNull(), 
  title: text('title').notNull(),
  content: text('content').notNull(),
  version: text('version').notNull(),
  effective_date: timestamp('effective_date').notNull(),
  is_active: numeric('is_active', { precision: 1, scale: 0 }).default('1').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  type_idx: index('legal_docs_type_idx').on(table.document_type),
}));

export const systemAuditLogs = pgTable('system_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  admin_id: uuid('admin_id').notNull(),
  admin_name: text('admin_name'),
  target_id: text('target_id'),
  target_type: text('target_type'),
  action: text('action').notNull(),
  old_value: jsonb('old_value'),
  new_value: jsonb('new_value'),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  admin_idx: index('audit_admin_idx').on(table.admin_id),
  target_idx: index('audit_target_idx').on(table.target_id, table.target_type),
  action_idx: index('audit_action_idx').on(table.action),
}));

export const accountDeletionEvents = pgTable('account_deletion_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  user_email: text('user_email').notNull(),
  user_full_name: text('user_full_name').notNull(),
  user_role: text('user_role').notNull(),
  deletion_reason: text('deletion_reason').notNull(),
  deletion_reason_category: text('deletion_reason_category').notNull(),
  additional_feedback: text('additional_feedback'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  user_id_idx: index('account_deletion_events_user_id_idx').on(table.user_id),
  created_at_idx: index('account_deletion_events_created_at_idx').on(table.created_at),
  reason_category_idx: index('account_deletion_events_reason_category_idx').on(table.deletion_reason_category),
}));

export const adminReports = pgTable('admin_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type').$type<'financial' | 'operational' | 'compliance' | 'performance'>().notNull(),
  period: text('period').$type<'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>().notNull(),
  status: text('status').$type<'generating' | 'ready' | 'failed' | 'scheduled'>().default('generating').notNull(),
  generated_at: timestamp('generated_at'),
  file_size: text('file_size'),
  download_url: text('download_url'),
  scheduled_for: timestamp('scheduled_for'),
  metrics: jsonb('metrics').$type<{
    totalRecords?: number;
    processingTime?: number;
    accuracy?: number;
  }>().default(sql`'{}'`),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  type_idx: index('admin_reports_type_idx').on(table.type),
  status_idx: index('admin_reports_status_idx').on(table.status),
  period_idx: index('admin_reports_period_idx').on(table.period),
  created_by_idx: index('admin_reports_created_by_idx').on(table.created_by),
  created_at_idx: index('admin_reports_created_at_idx').on(table.created_at),
  generated_at_idx: index('admin_reports_generated_at_idx').on(table.generated_at),
  status_type_idx: index('admin_reports_status_type_idx').on(table.status, table.type),
}));

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
export type GlobalSettings = typeof globalSettings.$inferSelect;
export type BlackoutPeriod = typeof blackoutPeriods.$inferSelect;
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type AccountDeletionEvent = typeof accountDeletionEvents.$inferSelect;
export type AdminReport = typeof adminReports.$inferSelect;
export type NewAdminReport = typeof adminReports.$inferInsert;