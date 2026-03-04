// ============================================================================
// Fraud Detection Component - Type Definitions
// ============================================================================

import { ComponentType } from 'react';

// ============================================================================
// Enums and Literal Types
// ============================================================================

export type RuleType = 'amount_threshold' | 'frequency' | 'velocity' | 'pattern';

export type RuleSeverity = 'low' | 'medium' | 'high';

export type RuleAction = 'flag' | 'block' | 'notify';

export type FlagType = 'fraud' | 'suspicious' | 'other';

export type ReviewDecision = 'approve' | 'block' | 'escalate';

export type IconSize = 'sm' | 'md' | 'lg';

export type GradientVariant = 'purple' | 'red' | 'amber' | 'green' | 'blue';

export type TabType = 'rules' | 'flagged';

// ============================================================================
// Core Domain Models
// ============================================================================

export interface FraudRule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  threshold: number;
  threshold_display: string;
  severity: RuleSeverity;
  enabled: boolean;
  action: RuleAction;
  trigger_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FlaggedTransaction {
  id: string;
  amount: number;
  employee_name?: string;
  employer_name?: string;
  flag_type: FlagType;
  flag_reason?: string;
  flagged_at: string;
  employee_id?: string;
  employer_id?: string;
  status?: 'pending' | 'reviewed' | 'approved' | 'blocked';
}

export interface TransactionReview {
  transaction_id: string;
  decision: ReviewDecision;
  notes: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

export interface GradientIconBoxProps {
  icon: ComponentType<{ className?: string }>;
  size?: IconSize;
  variant?: GradientVariant;
}

export interface MetricCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  variant?: GradientVariant;
}

export interface RuleCardProps {
  rule: FraudRule;
  onToggle: (id: string) => void;
  onEdit: (rule: FraudRule) => void;
  onDelete: (id: string) => void;
}

export interface FlaggedCardProps {
  transaction: FlaggedTransaction;
  onReview: (transaction: FlaggedTransaction) => void;
}

export interface RuleModalProps {
  rule?: FraudRule | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<FraudRule, 'id' | 'trigger_count' | 'threshold_display' | 'created_at' | 'updated_at'>) => void;
}

export interface ReviewModalProps {
  transaction: FlaggedTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (transactionId: string, decision: ReviewDecision, notes: string) => void;
}

// ============================================================================
// Form Data Interfaces
// ============================================================================

export interface RuleFormData {
  name: string;
  type: RuleType;
  description: string;
  threshold: number;
  severity: RuleSeverity;
  enabled: boolean;
  action: RuleAction;
}

export interface ReviewFormData {
  decision: ReviewDecision | '';
  notes: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface FraudRulesResponse {
  rules: FraudRule[];
  total: number;
}

export interface FlaggedTransactionsResponse {
  transactions: FlaggedTransaction[];
  total: number;
  pending: number;
}

export interface RuleToggleResponse {
  id: string;
  enabled: boolean;
}

export type RuleCreateResponse = FraudRule;

export type RuleUpdateResponse = FraudRule;

export interface ReviewSubmitResponse {
  success: boolean;
  transaction_id: string;
  decision: ReviewDecision;
}

// ============================================================================
// Statistics and Metrics
// ============================================================================

export interface FraudStats {
  total_rules: number;
  active_rules: number;
  flagged_count: number;
  high_risk: number;
  reviewed_today?: number;
  blocked_today?: number;
  approved_today?: number;
}

// ============================================================================
// Component State Types
// ============================================================================

export interface FraudDetectionState {
  activeTab: TabType;
  rules: FraudRule[];
  flaggedTransactions: FlaggedTransaction[];
  loading: boolean;
  showRuleModal: boolean;
  editingRule: FraudRule | null;
  reviewTransaction: FlaggedTransaction | null;
}

// ============================================================================
// Utility Types
// ============================================================================

export type RuleTypeIcon = Record<RuleType, ComponentType<{ className?: string }>>;

export type SizeClasses = Record<IconSize, string>;

export type VariantClasses = Record<GradientVariant, string>;

// ============================================================================
// API Error Types
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ValidationError extends ApiError {
  field: string;
  constraint: string;
}

// ============================================================================
// Filter and Search Types
// ============================================================================

export interface RuleFilters {
  type?: RuleType;
  severity?: RuleSeverity;
  enabled?: boolean;
  search?: string;
}

export interface TransactionFilters {
  flag_type?: FlagType;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
}

// ============================================================================
// Event Handler Types
// ============================================================================

export type RuleToggleHandler = (ruleId: string) => void | Promise<void>;

export type RuleEditHandler = (rule: FraudRule) => void;

export type RuleDeleteHandler = (ruleId: string) => void | Promise<void>;

export type RuleSaveHandler = (data: RuleFormData) => void | Promise<void>;

export type TransactionReviewHandler = (transaction: FlaggedTransaction) => void;

export type ReviewActionHandler = (
  transactionId: string,
  decision: ReviewDecision,
  notes: string
) => void | Promise<void>;

export type TabChangeHandler = (tab: TabType) => void;

export type RefreshHandler = () => void | Promise<void>;
