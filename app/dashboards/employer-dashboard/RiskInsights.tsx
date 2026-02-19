"use client"
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2,
  Info, ChevronRight, FileCheck, Building2, Users, DollarSign,
  Scale, Eye, HelpCircle, Award, ArrowRight, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EmployerPortalLayout } from "@/components/employer/EmployerLayout"
import { GradientIconBox } from '@/components/employer/SharedComponents';
import { cn, getRiskRatingLabel, calculateFeePercentage } from '@/lib/utils';

const API_URL = process.env.BACKEND_URL || "http://localhost:3000";

const RISK_CATEGORIES = {
  legal_compliance: {
    label: 'Legal & Compliance',
    icon: FileCheck,
    weight: 20,
    description: 'Registration, tax compliance, and EWA agreement status',
    tips: [
      'Ensure company registration is up to date',
      'Maintain valid Tax Compliance Certificate',
      'Keep EWA Platform Agreement current'
    ]
  },
  financial_health: {
    label: 'Financial Health',
    icon: DollarSign,
    weight: 35,
    description: 'Audited financials, liquidity, and payroll sustainability',
    tips: [
      'Submit 3 years of audited financial statements',
      'Maintain a current ratio above 1.5',
      'Fund payroll account consistently for 12+ months'
    ]
  },
  operational: {
    label: 'Operational Dynamics',
    icon: Users,
    weight: 20,
    description: 'Workforce size, employee retention, and system integration',
    tips: [
      'Grow workforce to 100+ employees for better scores',
      'Reduce employee churn rate below 5% monthly',
      'Integrate payroll system via automated API'
    ]
  },
  sector_exposure: {
    label: 'Sector & Regulatory',
    icon: Building2,
    weight: 15,
    description: 'Industry risk classification and regulatory compliance',
    tips: [
      'Low-risk sectors like healthcare and education score higher',
      'Resolve any pending regulatory issues',
      'Maintain clean compliance record'
    ]
  },
  aml_transparency: {
    label: 'AML & Ownership',
    icon: Eye,
    weight: 10,
    description: 'Beneficial ownership disclosure and PEP screening',
    tips: [
      'Fully disclose all beneficial owners',
      'Complete PEP screening for all stakeholders',
      'Maintain transparent ownership structure'
    ]
  }
};

interface RiskRatingBadgeProps {
    rating: string;
    size?: 'sm' | 'md' | 'lg';
}

const RiskRatingBadge = ({ rating, size = 'md' }: RiskRatingBadgeProps) => {
  const colors = {
    A: 'bg-emerald-500 text-white',
    B: 'bg-blue-500 text-white',
    C: 'bg-amber-500 text-white',
    D: 'bg-red-500 text-white',
  };

  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-24 h-24 text-4xl',
  };

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-bold shadow-lg",
      sizes[size],
      colors[rating] || 'bg-slate-400 text-white'
    )}>
      {rating || '?'}
    </div>
  );
};

interface CategoryScoreCardProps {
    category: string;
    score: number;
    expanded?: boolean;
    onToggle: () => void;
}
// Category Score Card
const CategoryScoreCard = ({ category, score, expanded, onToggle }: CategoryScoreCardProps) => {
  const config = RISK_CATEGORIES[category];
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
                  "text-lg font-bold",
                  score >= 4 ? 'text-emerald-600' :
                  score >= 3 ? 'text-blue-600' :
                  score >= 2.6 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {score.toFixed(1)}/5
                </span>
                <ChevronRight className={cn(
                  "w-5 h-5 text-slate-400 transition-transform",
                  expanded && "rotate-90"
                )} />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
            <div className="mt-3">
              <Progress value={normalizedScore} className="h-2" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Weight: {config.weight}%</p>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-200/50 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="pt-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Tips to Improve
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
// Fee Impact Visualization
const FeeImpactCard = ({ currentScore, currentFee }: FeeImpactCardProps) => {
  const scenarios = [
    { label: 'Current', score: currentScore, fee: currentFee, active: true },
    { label: 'If Score = 4.0', score: 4.0, fee: calculateFeePercentage(4.0), active: false },
    { label: 'If Score = 5.0', score: 5.0, fee: calculateFeePercentage(5.0), active: false },
  ];

  return (
    <div className="bg-gradient-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
      <div className="flex items-center gap-3 mb-5">
        <GradientIconBox icon={DollarSign} size="md" />
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Fee Impact</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">How your risk score affects advance fees</p>
        </div>
      </div>

      <div className="space-y-3">
        {scenarios.map((scenario, idx) => (
          <div 
            key={idx}
            className={cn(
              "flex items-center justify-between p-3 rounded-xl transition-colors",
              scenario.active 
                ? "bg-primary/10 border border-primary/20" 
                : "bg-white/50 dark:bg-slate-800/30"
            )}
          >
            <div className="flex items-center gap-3">
              {scenario.active && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              <div>
                <p className={cn(
                  "font-medium",
                  scenario.active ? "text-primary" : "text-slate-600 dark:text-slate-300"
                )}>
                  {scenario.label}
                </p>
                <p className="text-xs text-slate-400">CRS: {scenario.score.toFixed(1)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-xl font-bold",
                scenario.active ? "text-primary" : "text-slate-700 dark:text-slate-200"
              )}>
                {scenario.fee.toFixed(2)}%
              </p>
              <p className="text-xs text-slate-400">Application Fee</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Formula:</strong> Application Fee = 3.5% + (3% × (1 - CRS/5))
            <br />
            Lower risk scores mean higher fees to compensate for increased risk.
          </p>
        </div>
      </div>
    </div>
  );
};

export default function RiskInsightsPage() {
    const [employer, setEmployer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [requestingReview, setRequestingReview] = useState(false);
    const [reviewRequested, setReviewRequested] = useState(false);
    
    const handleRequestReview = async () => {
        setRequestingReview(true);
        try {
            await fetch('/api/employer/request-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employerId: employer?.id,
                    type: 'risk_review',
                    message: `${employer?.company_name || 'Employer'} has requested a risk score review.`
                }),
            });
            setReviewRequested(true);
        } catch (error) {
            console.error('Error requesting review:', error);
        } finally {
            setRequestingReview(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/employer/employer-data');
                const data = await response.json();
                setEmployer(data);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const riskScore = employer?.risk_score || 3.5;
    const riskRating = employer?.risk_rating || (riskScore >= 4 ? 'A' : riskScore >= 3 ? 'B' : riskScore >= 2.6 ? 'C' : 'D');
    const feePercentage = calculateFeePercentage(riskScore);

    const categoryScores = employer?.risk_factors || {
        legal_compliance: { registration_status: 4, tax_compliance: 3, ewa_agreement: 4 },
        financial_health: { audited_financials: 3, liquidity_ratio: 4, payroll_sustainability: 4 },
        operational: { employee_count: 3, churn_rate: 4, payroll_integration: 3 },
        sector_exposure: { industry_risk: 4, regulatory_exposure: 4 },
        aml_transparency: { beneficial_ownership: 4, pep_screening: 5 }
    };

    const getCategoryAverage = (category) => {
        const factors = categoryScores[category];
        if (!factors) return 3;
        const values = Object.values(factors);
        return values.reduce((a, b) => a + b, 0) / values.length;
    };
    return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="risk-insights-title">
              Risk Insights
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Understand your company's risk score and how to improve it
            </p>
          </div>
          {reviewRequested ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Review Requested</span>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60"
              onClick={handleRequestReview}
              disabled={requestingReview}
              data-testid="request-review-btn"
            >
              {requestingReview ? (
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <HelpCircle className="w-4 h-4" />
              )}
              {requestingReview ? 'Requesting...' : 'Request Review'}
            </Button>
          )}
        </div>

        {/* Main Score Overview */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Score Summary Card */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
                Composite Risk Score
              </p>
              
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" 
                    className="text-slate-200 dark:text-slate-700" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#riskProgressGradient)" strokeWidth="8" 
                    strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} 
                    strokeDashoffset={2 * Math.PI * 40 * (1 - (riskScore / 5))}
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
                    {riskScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">out of 5</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                <RiskRatingBadge rating={riskRating} size="sm" />
                <span className="text-lg font-semibold text-slate-900 dark:text-white">
                  {getRiskRatingLabel(riskRating)}
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Current Application Fee
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {feePercentage.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Rating Scale Explanation */}
          <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-5">
              <GradientIconBox icon={Scale} size="md" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Rating Scale</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">What each rating means</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { rating: 'A', range: '4.0 - 5.0', label: 'Low Risk', desc: 'Stable, compliant, financially healthy', color: 'emerald' },
                { rating: 'B', range: '3.0 - 3.9', label: 'Medium Risk', desc: 'Moderate risk with minor issues', color: 'blue' },
                { rating: 'C', range: '2.6 - 2.9', label: 'High Risk', desc: 'Weak compliance or unstable finances', color: 'amber' },
                { rating: 'D', range: '0 - 2.5', label: 'Very High Risk', desc: 'Cannot advance wages', color: 'red' },
              ].map((item) => (
                <div 
                  key={item.rating}
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    riskRating === item.rating 
                      ? `bg-${item.color}-50 border-${item.color}-200 dark:bg-${item.color}-900/20 dark:border-${item.color}-700/30`
                      : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/30"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <RiskRatingBadge rating={item.rating} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.range}</p>
                    </div>
                    {riskRating === item.rating && (
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Score Breakdown by Category</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Click to see improvement tips</p>
          </div>
          
          <div className="space-y-3">
            {Object.keys(RISK_CATEGORIES).map((category) => (
              <CategoryScoreCard
                key={category}
                category={category}
                score={getCategoryAverage(category)}
                expanded={expandedCategory === category}
                onToggle={() => setExpandedCategory(
                  expandedCategory === category ? null : category
                )}
              />
            ))}
          </div>
        </div>

        {/* Fee Impact */}
        <div className="grid lg:grid-cols-2 gap-6">
          <FeeImpactCard currentScore={riskScore} currentFee={feePercentage} />

          {/* Next Steps */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-5">
              <GradientIconBox icon={Award} size="md" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">How to Improve</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Steps to achieve a better rating</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Complete KYC Documents</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Upload all required verification documents</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Submit Financial Statements</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">3 years of audited financials for best score</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Integrate Payroll System</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Connect via API for automated scoring</p>
                </div>
              </div>

              <Button className="w-full mt-4 bg-primary text-white" data-testid="contact-support-btn">
                Contact Support for Help
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800/30 rounded-xl flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">About Risk Scoring</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your risk score is calculated using a weighted formula that considers legal compliance (20%), 
                financial health (35%), operational dynamics (20%), sector exposure (15%), and AML transparency (10%). 
                The score determines the application fee charged on employee advances - lower risk means lower fees. 
                Scores are recalculated annually or when risk factors change.
              </p>
            </div>
          </div>
        </div>
      </div>
    </EmployerPortalLayout>
  );
}