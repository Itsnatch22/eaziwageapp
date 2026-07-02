"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Calculator, BookOpen, TrendingUp,
  ArrowRight, ShieldCheck, PieChart, Wallet
} from 'lucide-react';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

const WellnessPage = () => {
  const { currency, symbol } = useCurrency();

  const [income, setIncome] = useState<number>(0);
  const [rent, setRent] = useState<number>(0);
  const [food, setFood] = useState<number>(0);
  const [others, setOthers] = useState<number>(0);

  const totalExpenses = rent + food + others;
  const balance = income - totalExpenses;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  return (
    <EmployeePortalLayout title="Financial Wellness">
      <div className="max-w-5xl mx-auto space-y-12">
        
        
        <div className="relative bg-linear-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-8 md:p-12 text-white overflow-hidden shadow-2xl shadow-emerald-500/20">
           <div className="absolute top-0 right-0 p-12 opacity-10">
              <TrendingUp className="w-64 h-64" />
           </div>
           <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                 <Sparkles className="w-5 h-5 text-emerald-200 fill-current" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-100">Better Money Habits</span>
              </div>
              <h2 className="text-4xl font-bold tracking-tight mb-4">Grow your financial confidence.</h2>
              <p className="text-emerald-50/80 text-lg leading-relaxed">
                 Use our tools to plan your monthly expenses and learn how to make the most of your earned wages.
              </p>
           </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
           
           
           <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-3 px-1">
                 <Calculator className="w-5 h-5 text-emerald-500" />
                 <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Monthly Budget Planner</h3>
              </div>
              
              <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-white/10 p-8 space-y-8">
                 <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expected Monthly Income</label>
                       <Input 
                         type="number" 
                         placeholder={`${symbol} 0`} 
                         className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-bold"
                         onChange={e => setIncome(Number(e.target.value))}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rent & Utilities</label>
                       <Input 
                         type="number" 
                         placeholder={`${symbol} 0`} 
                         className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                         onChange={e => setRent(Number(e.target.value))}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Food & Groceries</label>
                       <Input 
                         type="number" 
                         placeholder={`${symbol} 0`} 
                         className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                         onChange={e => setFood(Number(e.target.value))}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Other Expenses</label>
                       <Input 
                         type="number" 
                         placeholder={`${symbol} 0`} 
                         className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                         onChange={e => setOthers(Number(e.target.value))}
                       />
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-end justify-between mb-4">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estimated Savings</p>
                          <h4 className={cn("text-3xl font-bold tracking-tight", balance >= 0 ? "text-slate-900 dark:text-white" : "text-red-500")}>
                             {formatCurrency(balance, currency)}
                          </h4>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Savings Rate</p>
                          <p className={cn("text-xl font-bold", savingsRate > 20 ? "text-emerald-500" : "text-amber-500")}>
                             {savingsRate.toFixed(1)}%
                          </p>
                       </div>
                    </div>
                    
                    <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                       <div 
                         className={cn("h-full transition-all duration-1000", balance >= 0 ? "bg-emerald-500" : "bg-red-500")}
                         style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
                       />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                       Note: This is a private tool. Your budget data is not saved or shared with your employer.
                    </p>
                 </div>
              </div>
           </div>

           
           <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center gap-3 px-1">
                 <BookOpen className="w-5 h-5 text-emerald-500" />
                 <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Financial Tips</h3>
              </div>

              <div className="space-y-4">
                 {[
                   { 
                     title: "The 50/30/20 Rule", 
                     desc: "Aim to spend 50% on needs, 30% on wants, and save 20% of your income.",
                     icon: PieChart,
                     color: "blue"
                   },
                   { 
                     title: "Emergency Fund", 
                     desc: "Try to keep at least 3 months of expenses in a separate account for unexpected events.",
                     icon: ShieldCheck,
                     color: "emerald"
                   },
                   { 
                     title: "EWA Best Practice", 
                     desc: "Only use earned wage access for essential, unplanned expenses to avoid affecting your main paycheck.",
                     icon: Wallet,
                     color: "purple"
                   }
                 ].map((tip, idx) => {
                    const Icon = tip.icon;
                    return (
                      <div key={idx} className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 group hover:border-emerald-500/30 transition-all cursor-default">
                         <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              tip.color === 'blue' ? "bg-blue-50 text-blue-600" : tip.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                            )}>
                               <Icon className="w-5 h-5" />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{tip.title}</h4>
                               <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tip.desc}</p>
                            </div>
                         </div>
                      </div>
                    );
                 })}
                 
                 <Link href="/dashboards/employee-dashboard/wellness/resources">
                    <Button variant="ghost" className="w-full text-emerald-500 font-bold text-xs uppercase tracking-widest hover:bg-emerald-50 group">
                       View More Resources <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                 </Link>
              </div>
           </div>

        </div>

      </div>
    </EmployeePortalLayout>
  );
};

export default WellnessPage;
