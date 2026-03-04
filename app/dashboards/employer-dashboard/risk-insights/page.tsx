"use client";
import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Info, ChevronRight, FileCheck, Building2, Users, DollarSign,
  Scale, Eye, HelpCircle, Award, ArrowRight, Lightbulb, AlertCircle,
  TrendingUp, Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { GradientIconBox } from '@/components/employer/SharedComponents';
import { cn, getRiskRatingLabel, calculateFeePercentage } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Framework Constants (from PDF) ───────────────────────────────────────────
//
// EaziWage Risk Classification, Scoring & Framework (REV1 - Oct 25, 2025)
// 
// Risk formula: CRS_employer = Σ(Score_i × Weight_i) / Σ Weight_i
// Fee formula: Application Fee (%) = Bf + (Rf × (1 - CRS_total/5))
//   where Bf = 3.5% (Base Service Fee)
//   and   Rf = 3.0% (Risk Adjustment Factor)
//

const RISK_CATEGORIES = {
  legal_compliance: {
    label: 'Legal & Compliance',
    icon: FileCheck,
    weight: 20,
    description: 'Registration, tax compliance, and EWA agreement status',
    rationale: 'Foundational compliance — filters unregistered or non-compliant entities',
    factors: [
      { 
        key: 'registration_status',
        label: 'Registration Status',
        weight: 10,
        criteria: {
          5: 'Fully registered & compliant',
          2: 'Registration pending',
          0: 'Unregistered',
        }
      },
      { 
        key: 'tax_compliance',
        label: 'Tax Compliance',
        weight: 7,
        criteria: {
          5: 'Valid Tax Compliance Certificate',
          3: 'Certificate overdue or invalid',
          0: 'No certificate',
        }
      },
      { 
        key: 'ewa_agreement',
        label: 'EWA Platform Agreement',
        weight: 3,
        criteria: {
          5: 'EWA Platform Agreement Signed and Valid',
          3: 'EWA Platform Agreement under Renewal',
          0: 'No Valid EWA Platform Agreement',
        }
      },
    ],
    tips: [
      'Ensure company registration is up to date with relevant authorities',
      'Maintain a valid Tax Compliance Certificate from KRA',
      'Keep your EWA Platform Agreement current and renewed on time',
      'Update registration details immediately if there are any changes',
    ],
  },
  financial_health: {
    label: 'Financial Health & Solvency',
    icon: DollarSign,
    weight: 35,
    description: 'Audited financials, liquidity, and payroll sustainability',
    rationale: 'Core risk driver — determines payroll reliability and your primary exposure',
    factors: [
      { 
        key: 'audited_financials',
        label: 'Audited Financials',
        weight: 15,
        criteria: {
          5: '3 years of audited financials',
          2: 'Partial or unaudited (2-4)',
          0: 'None',
        }
      },
      { 
        key: 'liquidity_ratio',
        label: 'Liquidity Ratio (Current Ratio)',
        weight: 10,
        criteria: {
          5: 'Current ratio >1.5',
          3: 'Current ratio 1.0–1.5',
          1: 'Current ratio <1.0',
        }
      },
      { 
        key: 'payroll_sustainability',
        label: 'Payroll Sustainability',
        weight: 10,
        criteria: {
          5: 'Payroll account funded regularly for >12 months',
          3: 'Payroll account funded regularly for >6 months',
          0: 'Inconsistent funding',
        }
      },
    ],
    tips: [
      'Submit 3 years of audited financial statements for the highest score',
      'Maintain a current ratio (current assets/current liabilities) above 1.5',
      'Fund your payroll account consistently for 12+ consecutive months',
      'Work with a reputable auditing firm for financial statement preparation',
      'Build cash reserves to demonstrate strong liquidity position',
    ],
  },
  operational: {
    label: 'Operational / HR Dynamics',
    icon: Users,
    weight: 20,
    description: 'Workforce size, employee retention, and system integration',
    rationale: 'Affects data accuracy & repayment timing — operational continuity matters',
    factors: [
      { 
        key: 'employee_count',
        label: 'Number of Employees',
        weight: 5,
        criteria: {
          5: '>100 employees',
          3: '20–99 employees',
          1: '<20 employees',
        }
      },
      { 
        key: 'churn_rate',
        label: 'Employee Churn Rate',
        weight: 5,
        criteria: {
          5: '<5% per month',
          3: '5–10% per month',
          1: '>10% per month',
        }
      },
      { 
        key: 'payroll_integration',
        label: 'Payroll System Integration',
        weight: 10,
        criteria: {
          5: 'Automated payroll API',
          3: 'Manual upload',
          1: 'No integration',
        }
      },
    ],
    tips: [
      'Grow your workforce to 100+ employees for better operational scores',
      'Reduce employee churn rate to below 5% monthly through retention programs',
      'Integrate your payroll system via automated API for real-time updates',
      'Implement robust HR management systems for better employee tracking',
      'Maintain detailed employment records and contracts',
    ],
  },
  sector_exposure: {
    label: 'Sector & Regulatory Exposure',
    icon: Building2,
    weight: 15,
    description: 'Industry risk classification and regulatory compliance',
    rationale: 'Captures macro volatility — different sectors have structural cash-flow cycles',
    factors: [
      { 
        key: 'industry_risk',
        label: 'Industry Risk',
        weight: 10,
        criteria: {
          5: 'Low-risk sector (Healthcare, Education, Finance)',
          3: 'Moderate-risk sector (Retail, Manufacturing)',
          1: 'High-risk sector (Construction, Hospitality, Logistics)',
        }
      },
      { 
        key: 'regulatory_exposure',
        label: 'Regulatory Exposure',
        weight: 5,
        criteria: {
          5: 'No pending cases or fines',
          3: 'Minor compliance issues',
          0: 'Regulatory action pending',
        }
      },
    ],
    tips: [
      'Low-risk sectors like healthcare, education, and finance score higher',
      'Resolve any pending regulatory issues or compliance cases promptly',
      'Maintain a clean compliance record with all relevant authorities',
      'Document all interactions with regulatory bodies',
      'Implement proactive compliance monitoring systems',
    ],
  },
  aml_transparency: {
    label: 'AML / Ownership Transparency',
    icon: Eye,
    weight: 10,
    description: 'Beneficial ownership disclosure and PEP screening',
    rationale: 'Protects against reputational & regulatory risk — ensures defensibility',
    factors: [
      { 
        key: 'beneficial_ownership',
        label: 'Beneficial Ownership Transparency',
        weight: 5,
        criteria: {
          5: 'Fully disclosed',
          2: 'Incomplete (2–4)',
          0: 'Unclear/offshore (0–1)',
        }
      },
      { 
        key: 'pep_screening',
        label: 'PEP / Sanctions Screening',
        weight: 5,
        criteria: {
          5: 'Clear',
          3: 'Flagged but justified',
          0: 'Confirmed high-risk',
        }
      },
    ],
    tips: [
      'Fully disclose all beneficial owners (individuals with >25% ownership)',
      'Complete Politically Exposed Person (PEP) screening for all stakeholders',
      'Maintain a transparent ownership structure with clear documentation',
      'Update ownership information immediately when changes occur',
      'Provide supporting documentation for all ownership claims',
    ],
  },
} as const;

// Risk rating thresholds from PDF Table 6
const RISK_RATING_SCALE = [
  { 
    rating: 'A', 
    range: '4.0 – 5.0', 
    label: 'Low Risk', 
    desc: 'Stable, compliant, transparent, financially healthy',
    color: 'emerald',
    minScore: 4.0,
  },
  { 
    rating: 'B', 
    range: '3.0 – 3.9', 
    label: 'Medium Risk', 
    desc: 'Moderate risk, minor compliance or liquidity issues',
    color: 'blue',
    minScore: 3.0,
  },
  { 
    rating: 'C', 
    range: '2.6 – 2.9', 
    label: 'High Risk', 
    desc: 'Weak compliance, unstable finances, or opaque ownership',
    color: 'amber',
    minScore: 2.6,
  },
  { 
    rating: 'D', 
    range: '0 – 2.5', 
    label: 'Very High Risk', 
    desc: 'Cannot advance wages — immediate action required',
    color: 'red',
    minScore: 0,
  },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RiskRatingBadgeProps {
  rating: string;
  size?: 'sm' | 'md' | 'lg';
}

const RiskRatingBadge = ({ rating, size = 'md' }: RiskRatingBadgeProps) => {
  const colors: Record<string, string> = {
    A: 'bg-emerald-500 text-white',
    B: 'bg-blue-500 text-white',
    C: 'bg-amber-500 text-white',
    D: 'bg-red-500 text-white',
  };
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-16 h-16 text-2xl', lg: 'w-24 h-24 text-4xl' };

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-bold shadow-lg',
      sizes[size],
      colors[rating] ?? 'bg-slate-400 text-white',
    )}>
      {rating || '?'}
    </div>
  );
};

interface CategoryScoreCardProps {
  category: string;
  score: number;
  categoryData: Record<string, number> | undefined;
  expanded?: boolean;
  onToggle: () => void;
}

const CategoryScoreCard = ({ 
  category, 
  score, 
  categoryData,
  expanded, 
  onToggle 
}: CategoryScoreCardProps) => {
  const config = RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES];
  if (!config) return null;

  const Icon = config.icon;
  const normalizedScore = (score / 5) * 100;

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
      <div
        className="p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <GradientIconBox icon={Icon} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">{config.label}</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-lg font-bold',
                  score >= 4 ? 'text-emerald-600' :
                  score >= 3 ? 'text-blue-600' :
                  score >= 2.6 ? 'text-amber-600' : 'text-red-600',
                )}>
                  {score.toFixed(1)}/5
                </span>
                <ChevronRight className={cn(
                  'w-5 h-5 text-slate-400 transition-transform',
                  expanded && 'rotate-90',
                )} />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
            <div className="mt-3">
              <Progress value={normalizedScore} className="h-2" />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-400">Weight: {config.weight}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">{config.rationale}</p>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-200/50 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-800/20">
          {/* Individual Factor Scores */}
          <div className="pt-4 mb-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-primary" />
              Factor Breakdown
            </h4>
            <div className="space-y-3">
              {config.factors.map((factor) => {
                const factorScore = categoryData?.[factor.key] ?? 3;
                return (
                  <div key={factor.key} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {factor.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Weight: {factor.weight}%</span>
                        <span className={cn(
                          'text-sm font-bold',
                          factorScore >= 4 ? 'text-emerald-600' :
                          factorScore >= 3 ? 'text-blue-600' :
                          factorScore >= 2.6 ? 'text-amber-600' : 'text-red-600',
                        )}>
                          {factorScore}/5
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      {Object.entries(factor.criteria).map(([score, desc]) => (
                        <div key={score} className={cn(
                          'pl-2 border-l-2',
                          Number(score) === factorScore 
                            ? 'border-primary text-primary font-medium' 
                            : 'border-slate-200 dark:border-slate-700'
                        )}>
                          {score}: {desc}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Improvement Tips */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Tips to Improve This Category
            </h4>
            <ul className="space-y-2">
              {config.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

interface FeeImpactCardProps {
  currentScore: number;
  currentFee: number;
}

const FeeImpactCard = ({ currentScore, currentFee }: FeeImpactCardProps) => {
  // Calculate potential fees at different risk levels using central utility
  const potentialSavings = [
    { score: 4.5, label: 'Excellent (4.5)', rating: 'A' },
    { score: 3.5, label: 'Good (3.5)', rating: 'B' },
    { score: 2.8, label: 'Fair (2.8)', rating: 'C' },
  ].map(item => ({
    ...item,
    fee: calculateFeePercentage(item.score),
    savings: currentFee - calculateFeePercentage(item.score),
  }));

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-3 mb-5">
        <GradientIconBox icon={TrendingUp} size="md" />
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Fee Impact</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">How your score affects application fees</p>
        </div>
      </div>

      {/* Current Fee */}
      <div className="p-4 bg-linear-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 mb-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Current Application Fee</p>
        <p className="text-3xl font-bold text-primary">{currentFee.toFixed(2)}%</p>
        <p className="text-xs text-slate-500 mt-1">Based on your current score of {currentScore.toFixed(1)}</p>
      </div>

      {/* Fee Formula from PDF */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl mb-4">
        <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-2">
          Fee = 3.5% + (3.0% × (1 - Score/5))
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Base Fee: 3.5% | Risk Factor: 3.0%
        </p>
      </div>

      {/* Potential Savings */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Potential with Higher Scores
        </h4>
        <div className="space-y-2">
          {potentialSavings.map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <RiskRatingBadge rating={item.rating} size="sm" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500">Fee: {item.fee.toFixed(2)}%</p>
                </div>
              </div>
              {item.savings > 0 && (
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">
                    Save {item.savings.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {currentScore < 2.6 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Very High Risk: Cannot advance wages
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            Immediate action required to improve your risk score above 2.6
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function RiskInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Fetch risk data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/employer-dashboard/risk-insights');
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch risk insights');
        }
        const json = await res.json();
        setData(json);
      } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err) || 'Failed to load risk insights');
        console.error('[risk-insights]', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <EmployerPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading risk insights...</p>
          </div>
        </div>
      </EmployerPortalLayout>
    );
  }

  if (!data) {
    return (
      <EmployerPortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No Risk Data Available
            </h2>
            <p className="text-slate-500 mb-4">
              Complete your employer profile to view risk insights
            </p>
            <Button onClick={() => window.location.href = '/employer/onboarding'}>
              Complete Onboarding
            </Button>
          </div>
        </div>
      </EmployerPortalLayout>
    );
  }

  const {
    company_name,
    risk_score = 3.0,
    risk_rating = 'B',
    application_fee: apiFee,
    currency = 'KES',
    risk_factors,
    has_pending_review,
    framework_version,
    framework_date,
  } = data;

  // Use API fee if available, otherwise calculate
  const feePercentage = apiFee ?? calculateFeePercentage(risk_score);

  // Calculate category averages using proper framework weights
  const getCategoryAverage = (category: string) => {
    const factors = risk_factors?.[category];
    if (!factors) return 3.0;
    
    const subWeights = data?.sub_factor_weights?.[category];
    const catWeight = data?.category_weights?.[category];
    
    if (subWeights && catWeight) {
      let weightedSum = 0;
      Object.entries(factors).forEach(([key, score]) => {
        weightedSum += (score as number) * (subWeights[key] || 0);
      });
      return weightedSum / catWeight;
    }

    const values = Object.values(factors) as number[];
    return values.reduce((sum, val) => sum + val, 0) / (values.length || 1);
  };

  return (
    <EmployerPortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Risk Insights
            </h1>
            {framework_version && (
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                Framework {framework_version} ({framework_date})
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Comprehensive risk assessment for {company_name}
          </p>
        </div>

        {/* Pending Review Alert */}
        {has_pending_review && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Risk Review Pending
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Your risk profile is under review. You&apos;ll be notified once the review is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Score Overview */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Composite Score Card */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
                Composite Risk Score (CRS)
              </p>

              {/* Circular progress */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                    className="text-slate-200 dark:text-slate-700" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#riskProgressGradient)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - risk_score / 5)}
                    className="transition-all duration-1000" />
                  <defs>
                    <linearGradient id="riskProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0df259" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {risk_score.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">out of 5</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                <RiskRatingBadge rating={risk_rating} size="sm" />
                <span className="text-lg font-semibold text-slate-900 dark:text-white">
                  {getRiskRatingLabel(risk_rating)}
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-300">Current Application Fee</p>
                <p className="text-2xl font-bold text-primary mt-1">{feePercentage.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* Rating Scale */}
          <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-5">
              <GradientIconBox icon={Scale} size="md" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Risk Rating Scale</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Framework-based classification</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {RISK_RATING_SCALE.map((item) => (
                <div
                  key={item.rating}
                  className={cn(
                    'p-4 rounded-xl border transition-all',
                    risk_rating === item.rating
                      ? `bg-${item.color}-50 border-${item.color}-200 dark:bg-${item.color}-900/20 dark:border-${item.color}-700/30`
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/30',
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <RiskRatingBadge rating={item.rating} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.range}</p>
                    </div>
                    {risk_rating === item.rating && (
                      <div className="ml-auto px-2 py-1 bg-primary/10 rounded-full">
                        <span className="text-xs font-medium text-primary">Current</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Risk Category Breakdown
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Click to expand details</p>
          </div>
          <div className="space-y-3">
            {Object.keys(RISK_CATEGORIES).map((category) => (
              <CategoryScoreCard
                key={category}
                category={category}
                score={getCategoryAverage(category)}
                categoryData={risk_factors?.[category]}
                expanded={expandedCategory === category}
                onToggle={() =>
                  setExpandedCategory(expandedCategory === category ? null : category)
                }
              />
            ))}
          </div>
        </div>

        {/* Fee Impact + How to Improve */}
        <div className="grid lg:grid-cols-2 gap-6">
          <FeeImpactCard currentScore={risk_score} currentFee={feePercentage} />

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-5">
              <GradientIconBox icon={Award} size="md" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">How to Improve Your Score</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Action steps for better ratings</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { 
                  step: 1, 
                  title: 'Complete KYC & Compliance', 
                  desc: 'Upload registration docs, tax certificates, and sign EWA agreement',
                  category: 'legal_compliance'
                },
                { 
                  step: 2, 
                  title: 'Submit Financial Statements', 
                  desc: '3 years of audited financials + maintain liquidity ratio >1.5',
                  category: 'financial_health'
                },
                { 
                  step: 3, 
                  title: 'Integrate Payroll System', 
                  desc: 'Connect via automated API for real-time payroll updates',
                  category: 'operational'
                },
                { 
                  step: 4, 
                  title: 'Disclose Ownership', 
                  desc: 'Complete beneficial ownership documentation and PEP screening',
                  category: 'aml_transparency'
                },
              ].map(({ step, title, desc, category }) => (
                <div 
                  key={step} 
                  className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedCategory(category)}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{step}</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}

              <Button
                className="w-full mt-4 bg-primary text-white"
                onClick={() => window.open('mailto:info@eaziwage.com', '_blank')}
              >
                Contact Support for Help
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Framework Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800/30 rounded-xl flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About the Risk Scoring Framework
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  Your risk score is calculated using EaziWage&apos;s Risk Classification, Scoring & Framework 
                  (REV1, approved October 25, 2025). The framework uses a weighted formula across five dimensions:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Financial Health (35%)</strong> — Core risk driver: liquidity and payroll sustainability</li>
                  <li><strong>Legal & Compliance (20%)</strong> — Registration, tax compliance, EWA agreement</li>
                  <li><strong>Operational Dynamics (20%)</strong> — Workforce size, churn rate, system integration</li>
                  <li><strong>Sector Exposure (15%)</strong> — Industry risk and regulatory compliance</li>
                  <li><strong>AML Transparency (10%)</strong> — Ownership disclosure and PEP screening</li>
                </ul>
                <p className="mt-3">
                  <strong>Fee Formula:</strong> Application Fee = 3.5% + (3.0% × (1 - Score/5))
                </p>
                <p>
                  Lower risk scores result in lower application fees. Scores are recalculated annually 
                  or when significant risk factors change. For detailed information, contact 
                  <a href="mailto:info@eaziwage.com" className="underline ml-1">info@eaziwage.com</a>.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </EmployerPortalLayout>
  );
}
