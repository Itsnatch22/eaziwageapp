"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, Shield, Plus, Eye, X, Trash2,
  CheckCircle2, Clock, Edit, AlertCircle,
  DollarSign, RefreshCw, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Type Definitions
// ============================================================================

type IconSize = 'sm' | 'md' | 'lg';
type GradientVariant = 'purple' | 'red' | 'amber' | 'green' | 'blue';
type RuleType = 'amount_threshold' | 'frequency' | 'velocity' | 'pattern';
type RuleSeverity = 'low' | 'medium' | 'high';
type RuleAction = 'flag' | 'block' | 'notify';
type FlagType = 'fraud' | 'suspicious' | 'other';
type ReviewDecision = 'approve' | 'block' | 'escalate';
type TabType = 'rules' | 'flagged';

interface FraudRule {
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

interface FlaggedTransaction {
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

interface RuleFormData {
  name: string;
  type: RuleType;
  description: string;
  threshold: number;
  severity: RuleSeverity;
  enabled: boolean;
  action: RuleAction;
}

interface FraudStats {
  total_rules: number;
  active_rules: number;
  flagged_count: number;
  high_risk: number;
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

interface GradientIconBoxProps {
  icon: React.ComponentType<{ className?: string }>;
  size?: IconSize;
  variant?: GradientVariant;
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  variant?: GradientVariant;
}

interface RuleCardProps {
  rule: FraudRule;
  onToggle: (id: string) => void;
  onEdit: (rule: FraudRule) => void;
  onDelete: (id: string) => void;
}

interface FlaggedCardProps {
  transaction: FlaggedTransaction;
  onReview: (transaction: FlaggedTransaction) => void;
}

interface RuleModalProps {
  rule?: FraudRule | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RuleFormData) => void;
}

interface ReviewModalProps {
  transaction: FlaggedTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (transactionId: string, decision: ReviewDecision, notes: string) => void;
}

// ============================================================================
// Components
// ============================================================================

// Gradient Icon Box
const GradientIconBox: React.FC<GradientIconBoxProps> = ({ 
  icon: Icon, 
  size = 'md', 
  variant = 'red' 
}) => {
  const sizes: Record<IconSize, string> = { 
    sm: 'w-10 h-10', 
    md: 'w-12 h-12', 
    lg: 'w-14 h-14' 
  };
  const iconSizes: Record<IconSize, string> = { 
    sm: 'w-5 h-5', 
    md: 'w-6 h-6', 
    lg: 'w-7 h-7' 
  };
  const variants: Record<GradientVariant, string> = {
    purple: 'from-purple-600 to-indigo-600',
    red: 'from-red-500 to-rose-600',
    amber: 'from-amber-500 to-orange-500',
    green: 'from-emerald-500 to-green-600',
    blue: 'from-blue-500 to-cyan-500'
  };
  
  return (
    <div className={cn(
      "rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg",
      sizes[size], variants[variant]
    )}>
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
};

// Metric Card
const MetricCard: React.FC<MetricCardProps> = ({ 
  icon, 
  label, 
  value, 
  subtext, 
  variant = 'red' 
}) => (
  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
    <div className="flex items-start justify-between">
      <GradientIconBox icon={icon} size="md" variant={variant} />
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  </div>
);

// Rule Card
const RuleCard: React.FC<RuleCardProps> = ({ rule, onToggle, onEdit, onDelete }) => {
  const typeIcons: Record<RuleType, React.ComponentType<{ className?: string }>> = {
    amount_threshold: DollarSign,
    frequency: Clock,
    velocity: AlertTriangle,
    pattern: Shield,
  };
  const Icon = typeIcons[rule.type] || AlertTriangle;

  return (
    <div className={cn(
      "bg-white/60 dark:bg-slate-800/40 rounded-xl p-4 border transition-all",
      rule.enabled 
        ? "border-emerald-200 dark:border-emerald-700/30" 
        : "border-slate-200 dark:border-slate-700/30 opacity-60"
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          rule.enabled ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-slate-100 dark:bg-slate-700/50"
        )}>
          <Icon className={cn("w-5 h-5", rule.enabled ? "text-emerald-600" : "text-slate-400")} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-white">{rule.name}</p>
            {rule.severity === 'high' && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-xs rounded-full font-medium">High Risk</span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rule.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span>Threshold: <strong className="text-slate-700 dark:text-slate-300">{rule.threshold_display}</strong></span>
            <span>Triggered: <strong className="text-slate-700 dark:text-slate-300">{rule.trigger_count || 0}x</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch 
            checked={rule.enabled}
            onCheckedChange={() => onToggle(rule.id)}
          />
          <button onClick={() => onEdit(rule)} className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Flagged Transaction Card
const FlaggedCard: React.FC<FlaggedCardProps> = ({ transaction, onReview }) => (
  <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-4 border border-red-200 dark:border-red-700/30">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-red-600" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(transaction.amount)}</p>
          <span className={cn(
            "px-2 py-0.5 text-xs rounded-full font-medium",
            transaction.flag_type === 'fraud' ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300" :
            transaction.flag_type === 'suspicious' ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
            "bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300"
          )}>
            {transaction.flag_type}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {transaction.employee_name || 'Unknown Employee'} • {transaction.employer_name || 'Unknown Employer'}
        </p>
        <p className="text-xs text-slate-400 mt-1">{formatDateTime(transaction.flagged_at)}</p>
        {transaction.flag_reason && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2 italic">&quot;{transaction.flag_reason}&quot;</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onReview(transaction)} className="border-purple-300 text-purple-700">
          <Eye className="w-4 h-4 mr-1" /> Review
        </Button>
      </div>
    </div>
  </div>
);

// Create/Edit Rule Modal
const RuleModal: React.FC<RuleModalProps> = ({ rule, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    type: 'amount_threshold',
    description: '',
    threshold: 50000,
    severity: 'medium',
    enabled: true,
    action: 'flag'
  });

  useEffect(() => {
    Promise.resolve().then(() => {
      if (rule) {
        setFormData({
          name: rule.name,
          type: rule.type,
          description: rule.description,
          threshold: rule.threshold,
          severity: rule.severity,
          enabled: rule.enabled,
          action: rule.action
        });
      } else {
        setFormData({
          name: '',
          type: 'amount_threshold',
          description: '',
          threshold: 50000,
          severity: 'medium',
          enabled: true,
          action: 'flag'
        });
      }
    });
  }, [rule, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {rule ? 'Edit Fraud Rule' : 'Create Fraud Rule'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure automatic fraud detection</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Rule Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., High Amount Alert"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as RuleType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount_threshold">Amount Threshold</SelectItem>
                  <SelectItem value="frequency">Frequency Limit</SelectItem>
                  <SelectItem value="velocity">Velocity Check</SelectItem>
                  <SelectItem value="pattern">Pattern Detection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData(prev => ({ ...prev, severity: v as RuleSeverity }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {formData.type === 'amount_threshold' ? 'Amount Threshold (KES)' :
               formData.type === 'frequency' ? 'Max Requests per Day' :
               formData.type === 'velocity' ? 'Max Amount per Hour (KES)' :
               'Threshold Value'}
            </Label>
            <Input
              type="number"
              value={formData.threshold}
              onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this rule detects..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Action When Triggered</Label>
              <Select value={formData.action} onValueChange={(v) => setFormData(prev => ({ ...prev, action: v as RuleAction }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag">Flag for Review</SelectItem>
                  <SelectItem value="block">Block Transaction</SelectItem>
                  <SelectItem value="notify">Notify Admin Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch 
                  checked={formData.enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, enabled: v }))}
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {formData.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => onSave(formData)}>
            <Save className="w-4 h-4 mr-2" /> {rule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Review Modal
const ReviewModal: React.FC<ReviewModalProps> = ({ transaction, isOpen, onClose, onAction }) => {
  const [decision, setDecision] = useState<ReviewDecision | ''>('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="bg-linear-to-r from-red-500 to-rose-600 p-6 rounded-t-2xl">
          <h3 className="text-lg font-bold text-white">Review Flagged Transaction</h3>
          <p className="text-white/80 text-sm mt-1">Transaction ID: {transaction.id?.substring(0, 8)}...</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(transaction.amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Flag Type</p>
                <p className="font-semibold text-red-600 capitalize">{transaction.flag_type}</p>
              </div>
              <div>
                <p className="text-slate-500">Employee</p>
                <p className="font-medium text-slate-900 dark:text-white">{transaction.employee_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Employer</p>
                <p className="font-medium text-slate-900 dark:text-white">{transaction.employer_name || '-'}</p>
              </div>
            </div>
            {transaction.flag_reason && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 text-sm">Flag Reason</p>
                <p className="text-red-600 dark:text-red-400 italic mt-1">&quot;{transaction.flag_reason}&quot;</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Decision</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as ReviewDecision)}>
              <SelectTrigger>
                <SelectValue placeholder="Select decision..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve - Clear Flag</SelectItem>
                <SelectItem value="block">Block - Confirm Fraud</SelectItem>
                <SelectItem value="escalate">Escalate - Needs Investigation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Review Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about your decision..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button 
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" 
            onClick={() => { 
              if (decision) {
                onAction(transaction.id, decision as ReviewDecision, notes); 
                onClose(); 
              }
            }}
            disabled={!decision}
          >
            Submit Decision
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function FraudDetection() {
  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [flaggedTransactions, setFlaggedTransactions] = useState<FlaggedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null);
  const [reviewTransaction, setReviewTransaction] = useState<FlaggedTransaction | null>(null);

  // Fetch fraud rules from backend
  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/fraud-rules`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (err) {
      console.error('Failed to fetch fraud rules:', err);
    }
  }, []);

  const fetchFlaggedTransactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/advances/flagged`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setFlaggedTransactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch flagged transactions:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchFlaggedTransactions()]);
    setLoading(false);
  }, [fetchRules, fetchFlaggedTransactions]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, [fetchData]);

  const handleToggleRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/admin/fraud-rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        setRules(prev => prev.map(r => 
          r.id === ruleId ? { ...r, enabled: result.enabled } : r
        ));
        toast.success('Rule updated');
      }
    } catch (err) {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/admin/fraud-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
        toast.success('Rule deleted');
      }
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  const handleSaveRule = async (ruleData: RuleFormData) => {
    try {
      
      if (editingRule) {
        // Update existing rule
        const response = await fetch(`/api/admin/fraud-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ruleData)
        });
        if (response.ok) {
          const updatedRule = await response.json();
          setRules(prev => prev.map(r => r.id === editingRule.id ? updatedRule : r));
          toast.success('Rule updated');
        }
      } else {
        // Create new rule
        const response = await fetch(`/api/admin/fraud-rules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ruleData)
        });
        if (response.ok) {
          const newRule = await response.json();
          setRules(prev => [...prev, newRule]);
          toast.success('Rule created');
        }
      }
    } catch (err) {
      toast.error('Failed to save rule');
    }
    
    setShowRuleModal(false);
    setEditingRule(null);
  };

  const handleReviewAction = async (transactionId: string, decision: ReviewDecision, notes: string) => {
    try {
      await fetch(`/api/admin/advances/${transactionId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision, notes })
      });
      toast.success(`Transaction ${decision}`);
      fetchFlaggedTransactions();
    } catch (err) {
      toast.error('Failed to submit review');
    }
    setReviewTransaction(null);
  };

  // Stats
  const stats: FraudStats = {
    total_rules: rules.length,
    active_rules: rules.filter(r => r.enabled).length,
    flagged_count: flaggedTransactions.length,
    high_risk: flaggedTransactions.filter(t => t.flag_type === 'fraud').length,
  };

  return (
    <AdminPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="fraud-detection-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="fraud-detection-title">
              Fraud Detection
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure rules and review flagged transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white/60 dark:bg-slate-800/60" onClick={fetchFlaggedTransactions}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
              data-testid="create-rule-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Rule
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Shield} label="Total Rules" value={stats.total_rules} subtext={`${stats.active_rules} active`} variant="purple" />
          <MetricCard icon={CheckCircle2} label="Active Rules" value={stats.active_rules} variant="green" />
          <MetricCard icon={AlertTriangle} label="Flagged Transactions" value={stats.flagged_count} variant="amber" />
          <MetricCard icon={AlertCircle} label="High Risk" value={stats.high_risk} subtext="Potential fraud" variant="red" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('rules')}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all",
              activeTab === 'rules'
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white"
            )}
          >
            <Shield className="w-4 h-4 inline-block mr-2" />
            Detection Rules
          </button>
          <button
            onClick={() => setActiveTab('flagged')}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all relative",
              activeTab === 'flagged'
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                : "bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white"
            )}
          >
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            Flagged Transactions
            {stats.flagged_count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {stats.flagged_count}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'rules' ? (
          <div className="space-y-4">
            {rules.length === 0 ? (
              <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/30">
                <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="font-semibold text-slate-900 dark:text-white">No fraud rules configured</h3>
                <p className="text-sm text-slate-500 mt-1">Create your first rule to start detecting suspicious activity</p>
                <Button 
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Rule
                </Button>
              </div>
            ) : (
              rules.map(rule => (
                <RuleCard 
                  key={rule.id}
                  rule={rule}
                  onToggle={handleToggleRule}
                  onEdit={(r) => { setEditingRule(r); setShowRuleModal(true); }}
                  onDelete={handleDeleteRule}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : flaggedTransactions.length === 0 ? (
              <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/30">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">No flagged transactions</h3>
                <p className="text-sm text-slate-500 mt-1">All transactions are currently clear</p>
              </div>
            ) : (
              flaggedTransactions.map(t => (
                <FlaggedCard 
                  key={t.id}
                  transaction={t}
                  onReview={setReviewTransaction}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <RuleModal 
        rule={editingRule}
        isOpen={showRuleModal}
        onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
        onSave={handleSaveRule}
      />

      <ReviewModal
        transaction={reviewTransaction}
        isOpen={!!reviewTransaction}
        onClose={() => setReviewTransaction(null)}
        onAction={handleReviewAction}
      />
    </AdminPortalLayout>
  );
}
