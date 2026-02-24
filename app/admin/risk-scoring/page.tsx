'use client'
import React, { useState, useEffect } from 'react';
import { 
  Shield, Calculator, Building2, User, RotateCcw, RefreshCw,
   AlertTriangle, CheckCircle2, Search,
   Clock, Bell, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPortalLayout } from '@/components/admin/AdminLayout';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Type definitions
interface ScoringFactor {
  key: string;
  label: string;
  weight: number;
  description: string;
}

interface ScoringFactors {
  legal_compliance: ScoringFactor[];
  financial_health: ScoringFactor[];
  operational: ScoringFactor[];
  sector_exposure?: ScoringFactor[];
  aml_transparency?: ScoringFactor[];
}

interface Employer {
  id: string | number;
  name: string;
  risk_score: number;
  last_verified?: string;
  next_review_date?: string;
  days_until_review?: number;
  [key: string]: any;
}

interface Employee {
  id: string | number;
  name: string;
  employer_id: string | number;
  risk_score?: number;
  last_verified?: string;
  next_review_date?: string;
  days_until_review?: number;
  [key: string]: any;
}

interface VerificationAlerts {
  employers: Employer[];
  employees: Employee[];
}

interface RiskRating {
  rating: string;
  label: string;
  color: 'emerald' | 'amber' | 'orange' | 'red';
}

interface SaveRiskScoreResult {
  composite_risk_score?: number;
  [key: string]: any;
}

type EntityType = 'employer' | 'employee';
type TabValue = 'calculator' | 'alerts';
type ColorVariant = 'purple' | 'green' | 'amber' | 'red' | 'blue';

// Employer scoring factors
const EMPLOYER_FACTORS: ScoringFactors = {
  legal_compliance: [
    { key: 'registration_status', label: 'Registration Status', weight: 0.10, description: 'Company registration validity' },
    { key: 'tax_compliance', label: 'Tax Compliance', weight: 0.07, description: 'Tax payment history' },
    { key: 'ewa_agreement', label: 'EWA Agreement', weight: 0.03, description: 'Signed EWA contract' },
  ],
  financial_health: [
    { key: 'audited_financials', label: 'Audited Financials', weight: 0.15, description: 'Financial audit status' },
    { key: 'liquidity_ratio', label: 'Liquidity Ratio', weight: 0.10, description: 'Ability to meet obligations (external)' },
    { key: 'payroll_sustainability', label: 'Payroll Sustainability', weight: 0.10, description: 'Payroll funding history' },
  ],
  operational: [
    { key: 'employee_count', label: 'Employee Count', weight: 0.05, description: 'Workforce size stability' },
    { key: 'churn_rate', label: 'Churn Rate', weight: 0.05, description: 'Employee turnover' },
    { key: 'payroll_integration', label: 'Payroll Integration', weight: 0.10, description: 'System integration level' },
  ],
  sector_exposure: [
    { key: 'industry_risk', label: 'Industry Risk', weight: 0.10, description: 'Sector-specific risks' },
    { key: 'regulatory_exposure', label: 'Regulatory Exposure', weight: 0.05, description: 'Regulatory compliance risk' },
  ],
  aml_transparency: [
    { key: 'beneficial_ownership', label: 'Beneficial Ownership', weight: 0.05, description: 'Ownership transparency' },
    { key: 'pep_screening', label: 'PEP Screening', weight: 0.05, description: 'Political exposure screening' },
  ],
};

const EMPLOYEE_FACTORS: ScoringFactors = {
  legal_compliance: [
    { key: 'verification_status', label: 'ID Verification', weight: 0.15, description: 'Identity document verification' },
    { key: 'tax_compliance', label: 'Tax Compliance', weight: 0.10, description: 'Tax ID verification' },
    { key: 'consent_data_rights', label: 'Consent & Rights', weight: 0.10, description: 'Data consent obtained' },
  ],
  financial_health: [
    { key: 'account_verification', label: 'Account Verification', weight: 0.45, description: 'Bank/mobile money verified' },
  ],
  operational: [
    { key: 'employment_status', label: 'Employment Status', weight: 0.075, description: 'Active employment' },
    { key: 'employment_contract', label: 'Employment Contract', weight: 0.075, description: 'Contract on file' },
    { key: 'recent_payslips', label: 'Recent Payslips', weight: 0.025, description: 'Payslip verification' },
    { key: 'bank_statements', label: 'Bank Statements', weight: 0.025, description: 'Statement verification' },
  ],
};

// Gradient Icon Box
interface GradientIconBoxProps {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    size?: 'sm' | 'md' | 'lg';
    variant?: ColorVariant;
}

const GradientIconBox = ({ icon: Icon, size = 'md', variant = 'purple' }: GradientIconBoxProps) => {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-14 h-14' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' };
  const variants: Record<ColorVariant, string> = {
    purple: 'from-purple-600 to-indigo-600',
    green: 'from-emerald-500 to-green-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
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
interface MetricCardProps {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    value: number | string;
    subtext?: string;
    variant?: ColorVariant;
}

const MetricCard = ({ icon, label, value, subtext, variant = 'purple' }: MetricCardProps) => (
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

// Risk Rating Badge
interface RiskRatingBadgeProps {
    score: number;
    showScore?: boolean;
}

const RiskRatingBadge = ({ score, showScore = true }: RiskRatingBadgeProps) => {
  const getRating = (s: number): RiskRating => {
    if (s >= 4.0) return { rating: 'A', label: 'Low Risk', color: 'emerald' };
    if (s >= 3.0) return { rating: 'B', label: 'Medium Risk', color: 'amber' };
    if (s >= 2.6) return { rating: 'C', label: 'High Risk', color: 'orange' };
    return { rating: 'D', label: 'Very High Risk', color: 'red' };
  };
  
  const { rating, label, color } = getRating(score);
  const colors: Record<RiskRating['color'], string> = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  };
  
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", colors[color])}>
      {showScore ? `${score?.toFixed(1)} - ${label}` : `${rating} - ${label}`}
    </span>
  );
};

// Verification Alert Card
interface VerificationAlertCardProps {
    item: Employer | Employee;
    type: EntityType;
    onReview: (item: Employer | Employee, type: EntityType) => void;
}

const VerificationAlertCard = ({ item, type, onReview }: VerificationAlertCardProps) => {
  const daysOverdue = (item.days_until_review ?? 0) < 0 ? Math.abs(item.days_until_review ?? 0) : 0;
  const isDue = (item.days_until_review ?? 0) <= 30;
  
  return (
    <div className={cn(
      "border rounded-xl p-4 flex items-center justify-between",
      daysOverdue > 0 
        ? "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30"
        : isDue
        ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
        : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          type === 'employer' ? "bg-purple-100 dark:bg-purple-500/20" : "bg-blue-100 dark:bg-blue-500/20"
        )}>
          {type === 'employer' ? <Building2 className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-blue-600" />}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
          <p className="text-xs text-slate-500">
            {daysOverdue > 0 
              ? `${daysOverdue} days overdue`
              : `Review in ${item.days_until_review} days`
            }
          </p>
        </div>
      </div>
      <Button 
        size="sm" 
        variant="ghost"
        onClick={() => onReview(item, type)}
        className="text-xs"
      >
        <Eye className="w-4 h-4 mr-1" /> Review
      </Button>
    </div>
  );
};

export default function RiskScoringPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>('calculator');
  const [entityType, setEntityType] = useState<EntityType>('employer');
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Employer | Employee | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SaveRiskScoreResult | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [verificationAlerts, setVerificationAlerts] = useState<VerificationAlerts>({
    employers: [],
    employees: []
  });

  const factors: ScoringFactors = entityType === 'employer' ? EMPLOYER_FACTORS : EMPLOYEE_FACTORS;

  // Fetch employers and employees
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employersRes, employeesRes] = await Promise.all([
          fetch(`/api/admin/employers/`),
          fetch(`/api/admin/employees/`)
        ]);
        
        if (employersRes.ok && employeesRes.ok) {
          const employersData: Employer[] = await employersRes.json();
          const employeesData: Employee[] = await employeesRes.json();
          setEmployers(employersData);
          setEmployees(employeesData);

          // Check URL params for entity selection
          const entityId = searchParams?.get('entity_id');
          const entityTypeParam = searchParams?.get('entity_type') as EntityType | null;
          
          if (entityId && entityTypeParam) {
            const entity = entityTypeParam === 'employer' 
              ? employersData.find((e: Employer) => e.id.toString() === entityId)
              : employeesData.find((e: Employee) => e.id.toString() === entityId);
            
            if (entity) {
              setSelectedEntity(entity);
              setEntityType(entityTypeParam);
              setActiveTab('calculator');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      }
    };
    fetchData();
  }, [searchParams]);

  // Fetch verification alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/verification-alerts/');
        if (response.ok) {
          const data: VerificationAlerts = await response.json();
          setVerificationAlerts(data);
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };
    fetchAlerts();
  }, []);

  // Initialize scores when entity is selected
  useEffect(() => {
    if (selectedEntity) {
      const initialScores: Record<string, number> = {};
      Object.values(factors).flat().forEach((factor: ScoringFactor) => {
        initialScores[factor.key] = selectedEntity[factor.key] || 3;
      });
      setScores(initialScores);
      setResult(null);
    }
  }, [selectedEntity, entityType]);

  const handleScoreChange = (key: string, value: number[]) => {
    setScores(prev => ({ ...prev, [key]: value[0] }));
  };

  const calculateCategoryScore = (category: keyof ScoringFactors): number => {
    const categoryFactors = factors[category];
    if (!categoryFactors) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    categoryFactors.forEach((factor: ScoringFactor) => {
      weightedSum += scores[factor.key] * factor.weight;
      totalWeight += factor.weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  const getCategoryScore = (category: string): string => {
    return calculateCategoryScore(category as keyof ScoringFactors).toFixed(2);
  };

  const calculateOverallScore = (): number => {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    Object.values(factors).flat().forEach((factor: ScoringFactor) => {
      totalWeightedScore += scores[factor.key] * factor.weight;
      totalWeight += factor.weight;
    });
    
    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  };

  const overallScore = calculateOverallScore();
  
  // Net weighted score for employees
  const employerScore = entityType === 'employee' && selectedEntity 
    ? (employers.find((e: Employer) => e.id === (selectedEntity as Employee).employer_id)?.risk_score || 3)
    : 0;
  
  const netWeightedScore = entityType === 'employee'
    ? ((employerScore * 0.4) + (overallScore * 0.6)).toFixed(2)
    : overallScore.toFixed(2);

  const displayScore = entityType === 'employee' 
    ? parseFloat(netWeightedScore)
    : overallScore;

  // Fee calculation
  const feePercentage = 3.5 + (3 * (1 - displayScore / 5));

  const handleSaveScore = async () => {
    if (!selectedEntity) return;
    
    try {
      const endpoint = entityType === 'employer' 
        ? `/api/admin/employers/${selectedEntity.id}/risk-score/`
        : `/api/admin/employees/${selectedEntity.id}/risk-score/`;
      
      const payload = {
        scores,
        composite_risk_score: parseFloat(netWeightedScore),
        entity_type: entityType
      };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data: SaveRiskScoreResult = await response.json();
        setResult(data);
        toast.success('Risk score saved successfully!');
        
        // Refresh data
        const refreshResponse = await fetch(
          entityType === 'employer' 
            ? `/api/admin/employers/` 
            : `/api/admin/employees/`
        );
        
        if (refreshResponse.ok) {
          const refreshedData: Employer[] | Employee[] = await refreshResponse.json();
          if (entityType === 'employer') {
            setEmployers(refreshedData as Employer[]);
          } else {
            setEmployees(refreshedData as Employee[]);
          }
        }
      }
    } catch (error) {
      console.error('Error saving score:', error);
      toast.error('Failed to save risk score');
    }
  };

  const handleReset = () => {
    if (selectedEntity) {
      const initialScores: Record<string, number> = {};
      Object.values(factors).flat().forEach((factor: ScoringFactor) => {
        initialScores[factor.key] = 3;
      });
      setScores(initialScores);
      setResult(null);
    }
  };

  const filteredEntities = entityType === 'employer'
    ? employers.filter((e: Employer) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : employees.filter((e: Employee) => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalAlerts = verificationAlerts.employers.length + verificationAlerts.employees.length;
  const overdueAlerts = verificationAlerts.employers.filter((e: Employer) => (e.days_until_review ?? 0) < 0).length +
                        verificationAlerts.employees.filter((e: Employee) => (e.days_until_review ?? 0) < 0).length;

  return (
    <AdminPortalLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Risk Scoring Engine</h1>
              <p className="text-slate-600 dark:text-slate-400">Calculate composite risk scores and application fees</p>
            </div>
            <GradientIconBox icon={Shield} size="lg" variant="purple" />
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <MetricCard icon={Building2} label="Total Employers" value={employers.length} variant="purple" />
            <MetricCard icon={User} label="Total Employees" value={employees.length} variant="blue" />
            <MetricCard 
              icon={Bell} 
              label="Verification Alerts" 
              value={totalAlerts}
              subtext={overdueAlerts > 0 ? `${overdueAlerts} overdue` : undefined}
              variant={overdueAlerts > 0 ? "red" : "amber"} 
            />
            <MetricCard 
              icon={Calculator} 
              label="Avg. Application Fee" 
              value="4.2%" 
              variant="green" 
            />
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="mb-6">
              <TabsTrigger value="calculator" className="gap-2">
                <Calculator className="w-4 h-4" /> Calculator
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="w-4 h-4" /> 
                Alerts
                {totalAlerts > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {totalAlerts}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calculator">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Entity Selection */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="font-semibold text-lg mb-4 text-slate-900 dark:text-white">Select Entity</h2>
                    
                    <div className="mb-4">
                      <Label>Entity Type</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={entityType === 'employer' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => { setEntityType('employer'); setSelectedEntity(null); }}
                        >
                          <Building2 className="w-4 h-4 mr-2" /> Employer
                        </Button>
                        <Button
                          variant={entityType === 'employee' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => { setEntityType('employee'); setSelectedEntity(null); }}
                        >
                          <User className="w-4 h-4 mr-2" /> Employee
                        </Button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <Label>Search</Label>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder={`Search ${entityType}s...`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredEntities.map((entity) => (
                        <button
                          key={entity.id}
                          onClick={() => setSelectedEntity(entity)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            selectedEntity?.id === entity.id
                              ? "bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/30"
                              : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <p className="font-medium text-slate-900 dark:text-white">{entity.name}</p>
                          {entity.risk_score !== undefined && (
                            <div className="mt-1">
                              <RiskRatingBadge score={entity.risk_score} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scoring Factors */}
                <div className="lg:col-span-1 space-y-4">
                  {!selectedEntity ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calculator className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500">Select an entity to calculate risk score</p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Scoring Factors</h2>
                        <Button variant="ghost" size="sm" onClick={handleReset}>
                          <RotateCcw className="w-4 h-4 mr-2" /> Reset
                        </Button>
                      </div>

                      <div className="space-y-6">
                        {Object.entries(factors).map(([category, categoryFactors]) => (
                          <div key={category}>
                            <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-3 capitalize">
                              {category.replace(/_/g, ' ')}
                            </h3>
                            <div className="space-y-4">
                              {categoryFactors.map((factor: ScoringFactor) => (
                                <div key={factor.key} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm">{factor.label}</Label>
                                    <span className="text-sm font-medium text-purple-600">
                                      {scores[factor.key]?.toFixed(1) || '3.0'}
                                    </span>
                                  </div>
                                  <Slider
                                    value={[scores[factor.key] || 3]}
                                    onValueChange={(value) => handleScoreChange(factor.key, value)}
                                    min={1}
                                    max={5}
                                    step={0.1}
                                    className="w-full"
                                  />
                                  <p className="text-xs text-slate-500">{factor.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button 
                        className="w-full mt-6" 
                        onClick={handleSaveScore}
                        disabled={!selectedEntity}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> Save Risk Score
                      </Button>
                    </div>
                  )}
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 sticky top-6">
                    <h2 className="font-semibold text-lg mb-6 text-slate-900 dark:text-white">Risk Assessment</h2>
                    
                    {/* Overall Score */}
                    <div className="text-center mb-6">
                      <div className={cn(
                        "w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl font-bold border-4",
                        displayScore >= 4.0 ? "border-emerald-500 text-emerald-600" :
                        displayScore >= 3.0 ? "border-amber-500 text-amber-600" :
                        displayScore >= 2.6 ? "border-orange-500 text-orange-600" :
                        "border-red-500 text-red-600"
                      )}>
                        {displayScore >= 4.0 ? 'A' : displayScore >= 3.0 ? 'B' : displayScore >= 2.6 ? 'C' : 'D'}
                      </div>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{displayScore.toFixed(2)}</p>
                      <RiskRatingBadge score={displayScore} showScore={false} />
                    </div>

                    {/* Net Weighted Score for Employees */}
                    {entityType === 'employee' && selectedEntity && (
                      <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl p-4 mb-4">
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-2">Net Weighted Score</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Employer (40%)</span>
                          <span className="font-medium">{(employers.find((e: Employer) => e.id === (selectedEntity as Employee).employer_id)?.risk_score || 3).toFixed(1)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Employee (60%)</span>
                          <span className="font-medium">{overallScore.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm border-t border-purple-200 dark:border-purple-500/30 mt-2 pt-2">
                          <span className="font-semibold text-purple-700 dark:text-purple-300">Net Score</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">{netWeightedScore}</span>
                        </div>
                      </div>
                    )}

                    {/* Fee Calculation */}
                    <div className="bg-linear-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl p-4 mb-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Calculated Application Fee</p>
                      <p className="text-2xl font-bold text-purple-600">{feePercentage.toFixed(2)}%</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formula: 3.5% + (3% * (1 - CRS/5))
                      </p>
                    </div>

                    {/* Category Breakdown */}
                    {selectedEntity && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Category Scores</p>
                        <div className="space-y-2">
                          {Object.keys(factors).map((category) => (
                            <div key={category} className="flex items-center justify-between">
                              <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">{category.replace(/_/g, ' ')}</span>
                              <span className={cn(
                                "text-sm font-medium px-2 py-0.5 rounded",
                                parseFloat(getCategoryScore(category)) >= 3.5 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                                parseFloat(getCategoryScore(category)) >= 2.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                                'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                              )}>
                                {getCategoryScore(category)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result && (
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 text-center mt-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        <p className="font-medium text-emerald-900 dark:text-emerald-300">Score Saved!</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">CRS: {result.composite_risk_score?.toFixed(2) || displayScore.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="p-6 space-y-6">
              {/* Overdue Reviews */}
              {(verificationAlerts.employers.filter((e: Employer) => (e.days_until_review ?? 0) < 0).length > 0 ||
                verificationAlerts.employees.filter((e: Employee) => (e.days_until_review ?? 0) < 0).length > 0) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Overdue Reviews
                  </h3>
                  <div className="space-y-2">
                    {verificationAlerts.employers.filter((e: Employer) => (e.days_until_review ?? 0) < 0).map((emp: Employer) => (
                      <VerificationAlertCard 
                        key={emp.id} 
                        item={emp} 
                        type="employer" 
                        onReview={(item) => { setSelectedEntity(item); setEntityType('employer'); setActiveTab('calculator'); }}
                      />
                    ))}
                    {verificationAlerts.employees.filter((e: Employee) => (e.days_until_review ?? 0) < 0).map((emp: Employee) => (
                      <VerificationAlertCard 
                        key={emp.id} 
                        item={emp} 
                        type="employee" 
                        onReview={(item) => { setSelectedEntity(item); setEntityType('employee'); setActiveTab('calculator'); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Reviews */}
              {(verificationAlerts.employers.filter((e: Employer) => (e.days_until_review ?? 0) >= 0).length > 0 ||
                verificationAlerts.employees.filter((e: Employee) => (e.days_until_review ?? 0) >= 0).length > 0) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-amber-600 flex items-center gap-2">
                    <Clock className="w-5 h-5" /> Upcoming Reviews (Next 60 days)
                  </h3>
                  <div className="space-y-2">
                    {verificationAlerts.employers.filter((e: Employer) => (e.days_until_review ?? 0) >= 0).map((emp: Employer) => (
                      <VerificationAlertCard 
                        key={emp.id} 
                        item={emp} 
                        type="employer" 
                        onReview={(item) => { setSelectedEntity(item); setEntityType('employer'); setActiveTab('calculator'); }}
                      />
                    ))}
                    {verificationAlerts.employees.filter((e: Employee) => (e.days_until_review ?? 0) >= 0).map((emp: Employee) => (
                      <VerificationAlertCard 
                        key={emp.id} 
                        item={emp} 
                        type="employee" 
                        onReview={(item) => { setSelectedEntity(item); setEntityType('employee'); setActiveTab('calculator'); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {verificationAlerts.employers.length === 0 && verificationAlerts.employees.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">All caught up!</h3>
                  <p className="text-sm text-slate-500 mt-1">No verification reviews due in the next 60 days</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminPortalLayout>
  );
}