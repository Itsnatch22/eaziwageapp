import React from 'react';
import { Icons, MOCK_TRANSACTIONS } from '@/constants';

interface WalletTabProps {
  calculatedEligibility: number;
  performanceMetrics: {
    daysWorked: number;
    overtimeHours: number;
    officeAttendance: number;
    dailyRate: number;
    overtimeRate: number;
  };
  savingsGoal: {
    title: string;
    target: number;
    current: number;
    monthlyContribution: number;
  };
  onRequestAdvance: () => void;
}

const WalletTab: React.FC<WalletTabProps> = ({ 
  calculatedEligibility, 
  performanceMetrics, 
  savingsGoal,
  onRequestAdvance 
}) => {
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Hero Balance Card */}
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl shadow-slate-200/50 text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <Icons.Wallet size={120} />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Eligible For Advance</p>
        <h2 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tighter mb-8">
          ${calculatedEligibility.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={onRequestAdvance}
            className="w-full sm:w-auto px-12 py-5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 flex items-center justify-center group"
          >
            <Icons.ArrowUpRight className="mr-2 w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            Request Advance
          </button>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-50 flex flex-wrap justify-center items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center space-x-2">
            <Icons.Calendar size={12} className="text-blue-500" />
            <span>Days Worked: {performanceMetrics.daysWorked}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Icons.Clock size={12} className="text-amber-500" />
            <span>OT: {performanceMetrics.overtimeHours}h</span>
          </div>
          <div className="flex items-center space-x-2">
            <Icons.Users size={12} className="text-emerald-500" />
            <span>Office Score: {performanceMetrics.officeAttendance}%</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Savings Goal Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 flex items-center">
              <Icons.Target className="mr-2 w-5 h-5 text-indigo-500" />
              Savings Goal
            </h3>
            <button className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
              <Icons.Settings size={16} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-bold text-slate-900 mb-1">
                <span>{savingsGoal.title}</span>
                <span>{Math.round((savingsGoal.current / savingsGoal.target) * 100)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000" 
                  style={{ width: `${(savingsGoal.current / savingsGoal.target) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Saved</div>
                <div className="text-xl font-black text-slate-900">${savingsGoal.current.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Target</div>
                <div className="text-lg font-bold text-slate-400">${savingsGoal.target.toLocaleString()}</div>
              </div>
            </div>
            <button className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center space-x-2">
              <Icons.PiggyBank size={18} />
              <span>Auto-save $50 from next advance</span>
            </button>
          </div>
        </div>

        {/* Settlement Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 mb-6 flex items-center">
              <Icons.Calendar className="mr-2 w-5 h-5 text-slate-400" />
              Next Payday
            </h3>
            <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                  <Icons.Clock size={20} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Expected Date</div>
                  <div className="font-bold text-lg">May 28, 2024</div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                All advances requested this month will be automatically reconciled on this date.
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
              <div className="flex items-center space-x-2">
                <Icons.CheckCircle2 size={14} />
                <span>Manager Verified: 24h ago</span>
              </div>
              <Icons.ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Full Width */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-green-900 flex items-center">
            <Icons.History className="mr-2 w-5 h-5 text-green-400" />
            Recent Activity Log
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-100 transition-all">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.type === 'Withdrawal' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {tx.type === 'Withdrawal' ? <Icons.ArrowUpRight size={20} /> : <Icons.CheckCircle2 size={20} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-green-900">{tx.type}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{tx.date}</div>
                </div>
              </div>
              <div className={`text-sm font-bold ${tx.type === 'Withdrawal' ? 'text-slate-900' : 'text-emerald-600'}`}>
                {tx.type === 'Withdrawal' ? '-' : '+'}${tx.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletTab;