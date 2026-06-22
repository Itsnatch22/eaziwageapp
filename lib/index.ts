import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}


const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});


export const db = drizzle(queryClient, { schema });


export const migrationClient = postgres(process.env.DATABASE_URL, {
  max: 1,
});
