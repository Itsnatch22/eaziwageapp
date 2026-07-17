import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const ReasonField = z.string().max(1000).optional();
const PasswordField = z.string().min(8).max(128);
const KycStatusEnum = z.enum(['approved', 'rejected', 'pending']);
const EmployeeStatusEnum = z.enum(['active', 'approved', 'pending', 'rejected', 'suspended']);

// ---------------------------------------------------------------------------
// Admin — employee mutations
// ---------------------------------------------------------------------------

export const EmployeeKycPatchSchema = z.object({
  kyc_status: KycStatusEnum,
  reason: ReasonField,
});

export const EmployeeRiskScorePatchSchema = z.object({
  risk_score: z.number().min(0).max(5),
  reason: ReasonField,
});

export const EmployeeStatusPatchSchema = z.object({
  status: EmployeeStatusEnum,
  reason: ReasonField,
});

// ---------------------------------------------------------------------------
// Admin — employer mutations
// ---------------------------------------------------------------------------

export const EmployerBankPatchSchema = z.object({
  bank_name: z.string().min(1).max(200),
  bank_account_number: z.string().min(1).max(50),
  reason: ReasonField,
});

export const EmployerStatusPatchSchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', 'suspended', 'risk_review_in_progress']),
  employer_code: z.string().max(20).optional(),
  min_advance_amount: z.number().positive().optional(),
  initial_credit_limit: z.number().positive().optional(),
  reason: ReasonField,
});

export const EmployerAdminUpdateSchema = z.object({
  risk_score: z.number().min(0).max(5).optional(),
  risk_rating: z.enum(['A', 'B', 'C', 'D']).optional(),
  status: z.string().optional(),
  risk_factors: z.record(z.string(), z.unknown()).optional(),
  override_reason: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Admin — financial mutations
// ---------------------------------------------------------------------------

export const FundEmployerSchema = z.object({
  employerId: z.string().min(1).max(200),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
});

export const StanbicDepositSchema = z.object({
  amount: z.number().positive(),
  reference: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

export const TopupRejectSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required when rejecting a top-up request.').max(1000),
});

// ---------------------------------------------------------------------------
// Admin — fraud / review
// ---------------------------------------------------------------------------

export const FraudReviewBodySchema = z.object({
  flagId: z.string().min(1),
  advanceId: z.string().min(1),
  action: z.enum(['clear', 'confirm_fraud']),
  notes: z.string().min(5).max(2000),
});

export const ReviewRequestPatchSchema = z.object({
  status: z.string().min(1).max(50),
  response: z.string().max(2000).optional(),
  internal_notes: z.string().max(2000).optional(),
  type: z.enum(['risk_score', 'kyc_review', 'bank_change']),
});

// ---------------------------------------------------------------------------
// Admin — KYC document review (query params)
// ---------------------------------------------------------------------------

export const KycDocQuerySchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional(),
}).refine(
  (d) => d.status !== 'rejected' || (d.notes && d.notes.trim().length > 0),
  { message: 'A reason is required when rejecting a document.', path: ['notes'] },
);

// ---------------------------------------------------------------------------
// Admin — notifications
// ---------------------------------------------------------------------------

export const AdminNotificationsMarkReadSchema = z.object({
  notification_ids: z.array(z.string().min(1)).min(1),
});

// ---------------------------------------------------------------------------
// Password change (shared across admin / employer / employee)
// ---------------------------------------------------------------------------

export const PasswordChangeSchema = z.object({
  newPassword: PasswordField,
});

// ---------------------------------------------------------------------------
// Employer profile / settings (same field set used in both routes)
// ---------------------------------------------------------------------------

export const EmployerProfileUpdateSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  contactPerson: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
  payrollCycle: z.string().max(50).optional(),
  physicalAddress: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  countyRegion: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  emailNotifications: z.boolean().optional(),
  advanceAlerts: z.boolean().optional(),
  payrollReminders: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  maxAdvancePercentage: z.number().min(1).max(100).optional(),
  minAdvanceAmount: z.number().positive().optional(),
  maxAdvanceAmount: z.number().positive().optional(),
  advanceAccessDays: z.array(z.number().int().min(1).max(31)).optional(),
  cooldownPeriod: z.number().int().min(0).max(90).optional(),
  pushNotifications: z.boolean().optional(),
  paydayDayOfMonth: z.number().int().min(1).max(31).optional(),
  mobileMoneyProvider: z.string().max(50).optional(),
  mobileMoneyNumber: z.string().max(30).optional(),
});

// ---------------------------------------------------------------------------
// Employer notification preferences
// ---------------------------------------------------------------------------

export const EmployerNotificationPrefsSchema = z.object({
  emailNotifications: z.boolean(),
  advanceAlerts: z.boolean(),
  pushNotifications: z.boolean(),
});

// ---------------------------------------------------------------------------
// Employee notification preferences
// ---------------------------------------------------------------------------

export const EmployeeNotificationPrefsSchema = z.object({
  emailAlerts: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Employer termination feedback
// ---------------------------------------------------------------------------

export const TerminationFeedbackSchema = z.object({
  reason: z.string().min(1).max(500),
  other_reason: z.string().max(500).optional(),
  additional_comments: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Employer wallet top-up request
// ---------------------------------------------------------------------------

export const WalletTopupRequestSchema = z.object({
  amount: z.number().positive().max(10_000_000),
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

export const PushSubscribeSchema = z.object({
  subscription: z
    .object({ endpoint: z.string().url(), keys: z.record(z.string(), z.string()) })
    .passthrough(),
});

export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
  clearAll: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export const SupportTicketCreateSchema = z.object({
  subject: z.string().min(1).max(300),
  message: z.string().min(1).max(10_000),
  category: z.string().max(100).optional(),
});

export const SupportReplySchema = z.object({
  message: z.string().min(1).max(10_000),
});

// ---------------------------------------------------------------------------
// Satisfaction / CSAT prompts
// ---------------------------------------------------------------------------

export const SatisfactionMomentEnum = z.enum([
  'employee_third_withdrawal',
  'employee_kyc_verified_3d',
  'employer_first_bulk_sync',
  'employer_topup_completed',
]);

export const SatisfactionPromptShownSchema = z.object({
  moment: SatisfactionMomentEnum,
});

export const SatisfactionFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  advance_id: z.string().uuid().optional(),
  moment: SatisfactionMomentEnum,
});

export const SatisfactionFeedbackCommentSchema = z.object({
  comment: z.string().min(1).max(2000),
});

export const SatisfactionDismissSchema = z.object({
  type: z.enum(['hard', 'passive']),
  moment: SatisfactionMomentEnum.optional(),
});
