// lib/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, text, numeric, varchar, json } from 'drizzle-orm/pg-core';
import * as schema from './db/schema';

// 1️⃣ Initialize Drizzle ORM with Supabase PostgreSQL connection
const databaseUrl = process.env.DATABASE_URL!;
export const db = drizzle(databaseUrl, {schema});

// 3️⃣ Define Employee table
export const employeeTable = pgTable('employee', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  salary: numeric('salary').notNull(),
  withdrawnThisMonth: numeric('withdrawn_this_month').default('0'),
  status: text('status').default('Active'),
  meta: json('meta') // optional extra info from files
});

// 4️⃣ Export db + tables for queries
export const tables = { employee: employeeTable };
