import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email().optional().or(z.literal('')),
  employee_number: z.string().max(50).optional(),
  department: z.string().min(1, 'Department is required').max(100),
  salary: z.number().positive('Salary must be positive'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  employee_number: z.string().max(50).optional(),
  department: z.string().min(1).max(100).optional(),
  salary: z.number().positive().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const employeeQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: z.enum(['Active', 'Inactive']).optional(),
});

export const updatePolicySchema = z.object({
  withdrawal_limit_percent: z.number().min(0).max(100).optional(),
  frequency_cap: z.number().int().positive().nullable().optional(),
  frequency_period: z.enum(['week', 'month']).optional(),
  auto_approval_enabled: z.boolean().optional(),
  auto_approval_threshold: z.number().positive().optional(),
  access_days: z.array(z.number().int().min(0).max(6)).optional(),
  access_start_hour: z.number().int().min(0).max(23).optional(),
  access_end_hour: z.number().int().min(0).max(23).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
