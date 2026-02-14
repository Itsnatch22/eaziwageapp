'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/constants';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface BudgetCategory {
  id: string;
  category: string;
  allocated: number;
  spent: number;
  color: string;
}

interface BudgetPlannerProps {
  onClose: () => void;
}

const BudgetPlanner: React.FC<BudgetPlannerProps> = ({ onClose }) => {
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: budgetData } = await supabase
      .from('user_budgets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (budgetData) {
      setMonthlyIncome(budgetData.monthly_income || 0);
      setCategories(budgetData.categories || getDefaultCategories());
    } else {
      setCategories(getDefaultCategories());
    }
    setLoading(false);
  };

  const getDefaultCategories = (): BudgetCategory[] => [
    { id: '1', category: 'Needs (50%)', allocated: 0, spent: 0, color: 'bg-blue-500' },
    { id: '2', category: 'Wants (30%)', allocated: 0, spent: 0, color: 'bg-purple-500' },
    { id: '3', category: 'Savings (20%)', allocated: 0, spent: 0, color: 'bg-emerald-500' },
  ];

  const calculateAllocations = (income: number) => {
    const updated = [
      { ...categories[0], allocated: income * 0.5 },
      { ...categories[1], allocated: income * 0.3 },
      { ...categories[2], allocated: income * 0.2 },
    ];
    setCategories(updated);
  };

  const handleIncomeChange = (value: string) => {
    const income = parseFloat(value) || 0;
    setMonthlyIncome(income);
    calculateAllocations(income);
  };

  const updateSpent = (index: number, value: string) => {
    const spent = parseFloat(value) || 0;
    const updated = [...categories];
    updated[index] = { ...updated[index], spent };
    setCategories(updated);
  };

  const saveBudget = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_budgets')
      .upsert({
        user_id: user.id,
        monthly_income: monthlyIncome,
        categories: categories,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);
    onClose();
  };

  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const totalAllocated = categories.reduce((sum, cat) => sum + cat.allocated, 0);
  const remaining = totalAllocated - totalSpent;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
        <div className="bg-white rounded-3xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-black text-slate-900">50/30/20 Budget Planner</h2>
            <p className="text-sm text-slate-500 mt-1">Plan your finances using the proven 50/30/20 rule</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors">
            <Icons.X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Monthly Income Input */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">
              Monthly Income (After Tax)
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">$</span>
              <input
                type="number"
                value={monthlyIncome || ''}
                onChange={(e) => handleIncomeChange(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-3xl font-black focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Budget Breakdown */}
          <div className="space-y-4">
            {categories.map((category, index) => {
              const percentage = category.allocated > 0 ? (category.spent / category.allocated) * 100 : 0;
              const isOverBudget = percentage > 100;

              return (
                <div key={category.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${category.color}`}></div>
                      <div>
                        <h4 className="font-bold text-slate-900">{category.category}</h4>
                        <p className="text-xs text-slate-500">Allocated: ${category.allocated.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Spent</div>
                      <input
                        type="number"
                        value={category.spent || ''}
                        onChange={(e) => updateSpent(index, e.target.value)}
                        placeholder="0"
                        className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-lg text-right font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : category.color}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className={`font-bold ${isOverBudget ? 'text-red-600' : 'text-slate-600'}`}>
                      {percentage.toFixed(0)}% used
                    </span>
                    <span className="text-slate-500">
                      ${(category.allocated - category.spent).toFixed(2)} remaining
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="bg-linear-to-br from-emerald-600 to-green-700 p-6 rounded-2xl text-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Budget Summary</h3>
              <Icons.PieChart size={24} className="opacity-80" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-emerald-200 uppercase tracking-widest mb-1">Allocated</div>
                <div className="text-2xl font-black">${totalAllocated.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-200 uppercase tracking-widest mb-1">Spent</div>
                <div className="text-2xl font-black">${totalSpent.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-200 uppercase tracking-widest mb-1">Remaining</div>
                <div className={`text-2xl font-black ${remaining < 0 ? 'text-red-300' : ''}`}>
                  ${remaining.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={saveBudget}
              disabled={saving || monthlyIncome === 0}
              className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Icons.Save size={20} />
                  Save Budget
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetPlanner;