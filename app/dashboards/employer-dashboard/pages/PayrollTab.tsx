'use client';

import { useState, useEffect } from 'react';
import { Icons } from "@/constants";

const PayrollTab = () => {
  const [data, setData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('3m');
  const [statementPreview, setStatementPreview] = useState<any>(null);
  const [notification, setNotification] = useState<any>(null);

  useEffect(() => {
    fetch('/api/payroll/summary')
      .then(r => r.json())
      .then(setData);
  }, []);

  const requestStatement = async () => {
    const res = await fetch('/api/payroll/statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: selectedPeriod }),
    });
    const json = await res.json();
    if (json.success) {
      setStatementPreview(json.preview);
    } else {
      setNotification({ type: 'error', message: json.error });
    }
  };

  if (!data) return <div className="animate-pulse">Loading intelligence...</div>;

  const { 
    currentCycle, 
    settlement = { status: 'CLOSED', days: 0 }, 
    disbursed = { mtd: 0, today: 0, rolling12: 0 }, 
    feesAccrued = 0, 
    dailySpark = [], 
    liquidityUtil = 0, 
    utilColor = 'emerald', 
    reconciliation = { expectedSettlement: 0, totalAdvances: 0, feesCovered: 0, netAdjustment: 0 }, 
    countryUtils = [] 
  } = data;

  // Simple sparkline path
  const maxSpark = Math.max(...dailySpark, 1);
  const sparkPoints = dailySpark.map((v: number, i: number) => 
    `${i * 12},${80 - (v / maxSpark) * 70}`
  ).join(' ');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid md:grid-cols-3 gap-6">
        {/* MAIN CARD */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-10 shadow-sm">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">Payroll Cycle: {currentCycle}</h3>
              <p className={`text-sm font-bold ${settlement.status === 'OPEN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                Settlement Window: {settlement.status === 'OPEN' ? 'OPEN' : `Opens in ${settlement.days} days`}
              </p>
            </div>
            <button className="p-3 bg-slate-50 text-slate-500 rounded-xl hover:text-slate-900 transition-all">
              <Icons.ArrowDownToLine size={20} />
            </button>
          </div>

          <div className="space-y-8">
            {/* TOTAL DISBURSED */}
            <div className="p-8 bg-linear-to-br from-green-50 to-white rounded-4xl border border-green-100 flex items-center justify-between shadow-inner relative overflow-hidden">
              <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-200">
                  <Icons.Wallet size={32} />
                </div>
                <div>
                  <div className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">Total Disbursed (This Month)</div>
                  <div className="text-5xl font-black text-slate-900 tabular-nums">
                    KES {disbursed.mtd.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600 font-bold flex items-center gap-2 mt-1">
                    <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded">↑ Today: KES {disbursed.today.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="absolute right-10 bottom-8 opacity-30">
                <svg width="180" height="80" className="overflow-visible">
                  <polyline points={sparkPoints} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="text-right">
                <div className={`text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-2xl ${utilColor === 'red' ? 'bg-red-100 text-red-600' : utilColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Liquidity Utilisation: {liquidityUtil}%
                </div>
              </div>
            </div>

            {/* MINI METRICS */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Rolling 12-Month Disbursed</div>
                <div className="text-2xl font-black text-green-600">KES {disbursed.rolling12.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Access Fee Accrued</div>
                <div className="text-2xl font-black text-green-600">KES {feesAccrued.toLocaleString()}</div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold">Covered by EaziWage</p>
              </div>
            </div>
          </div>
        </div>

        {/* RECONCILIATION PREVIEW */}
        <div className="bg-white rounded-3xl border border-slate-200 p-10 flex flex-col shadow-sm">
          <h4 className="text-xl font-black mb-6">Reconciliation Preview</h4>
          
          <div className="space-y-6 flex-1">
            <div>
              <div className="text-xs text-slate-500 font-bold">Expected Settlement Amount</div>
              <div className="text-3xl font-black text-green-600">KES {reconciliation.expectedSettlement.toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Total Advances Issued</div>
                <div className="font-bold">KES {reconciliation.totalAdvances.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-500">Fees Covered</div>
                <div className="font-bold text-emerald-600">KES {reconciliation.feesCovered.toLocaleString()}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-dashed">
              <div className="text-xs text-slate-500 font-bold">Net Payroll Adjustment</div>
              <div className="text-2xl font-black text-rose-600">KES {reconciliation.netAdjustment.toLocaleString()}</div>
              <p className="text-[10px] text-slate-400">To be deducted on payday</p>
            </div>
          </div>

          <button 
            onClick={() => setModalOpen(true)}
            className="w-full py-4 mt-8 bg-green-600 hover:bg-green-700 text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-green-900/40"
          >
            Request Statement
          </button>
        </div>
      </div>

      {/* COUNTRY UTILISATION BAR */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8">
        <h4 className="font-black text-slate-900 mb-6">Access Cap Utilisation by Country</h4>
        <div className="space-y-5">
          {countryUtils.map((c: any) => (
            <div key={c.code} className="flex items-center gap-6">
              <div className="w-10 font-mono text-xs font-black text-slate-400 uppercase">{c.code}</div>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${c.util > 85 ? 'bg-red-500' : c.util > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, c.util)}%` }}
                />
              </div>
              <div className="w-16 text-right font-bold text-sm">{c.util}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* STATEMENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-8">
              <h3 className="font-black text-2xl mb-8">Request Statement</h3>
              
              <div className="space-y-3">
                {(['3m','6m','12m'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    disabled={p === '6m' || p === '12m'} // simulate gating
                    className={`w-full text-left px-6 py-4 rounded-2xl border transition-all ${selectedPeriod === p ? 'border-green-600 bg-green-50' : 'border-slate-200'}`}
                  >
                    Last {p.replace('m','')} Months
                  </button>
                ))}
              </div>

              {statementPreview && (
                <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-sm">
                  <div>Preview ready • {statementPreview.records} records</div>
                  <div className="font-bold text-xl">KES {statementPreview.totalDisbursed.toLocaleString()}</div>
                </div>
              )}
            </div>

            <div className="border-t flex">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-5 text-slate-500 font-bold">Cancel</button>
              <button onClick={requestStatement} className="flex-1 py-5 bg-green-600 text-white font-black">Generate & Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold ${notification.type === 'success' ? 'bg-green-900' : 'bg-red-600'} text-white`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default PayrollTab;