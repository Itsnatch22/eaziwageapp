'use client';

import { useState, useEffect, useRef } from 'react';
import { Icons } from "@/constants";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from 'recharts';

const InsightsTab = () => {
  const [data, setData] = useState<any>(null);
  const [viewBy, setViewBy] = useState<'country' | 'department'>('country');
  const [pulse, setPulse] = useState('emerald');
  const numberRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(setData);
  }, []);

  // Animate numbers
  useEffect(() => {
    if (!data) return;
    numberRefs.current.forEach((el, i) => {
      if (el) {
        const target = parseInt(el.dataset.value || '0');
        let start = 0;
        const duration = 1200;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
          start += step;
          if (start >= target) {
            el.textContent = target + (i === 0 ? '' : '%');
            clearInterval(timer);
          } else {
            el.textContent = Math.floor(start) + (i === 0 ? '' : '%');
          }
        }, 16);
      }
    });
  }, [data]);

  if (!data) return <div className="h-96 flex items-center justify-center text-slate-400">Loading intelligence engine...</div>;

  const { fss, stability, momentum, pulse: livePulse, countryBreakdown, totalEvents } = data;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Intelligence Hub</h2>
          <p className="text-slate-500 text-sm">Real-time workforce financial health • {totalEvents ?? 0} access events analyzed</p>
        </div>

        {/* PULSE INDICATOR */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${livePulse === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <div className={`w-3 h-3 rounded-full ${livePulse === 'amber' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-xs font-black uppercase tracking-widest">
            {livePulse === 'amber' ? 'Access Usage Spike' : 'System Stable'}
          </span>
        </div>

        {/* VIEW TOGGLE */}
        <div className="flex bg-slate-100 rounded-2xl p-1">
          {(['country', 'department'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewBy(v)}
              className={`px-6 py-2 text-xs font-black rounded-xl transition-all ${viewBy === v ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              By {v === 'country' ? 'Country' : 'Department'}
            </button>
          ))}
        </div>
      </div>

      {/* TOP ROW — 3 KEY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Behaviour Intelligence */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between">
            <div>
              <div className="text-xs font-black text-emerald-600 uppercase tracking-[2px]">BEHAVIOUR INTELLIGENCE</div>
              <div className="text-4xl font-black text-slate-900 mt-3 tabular-nums" ref={el => { numberRefs.current[0] = el; }} data-value={fss?.current ?? 0}>
                {fss?.current ?? 0}
              </div>
              <div className="text-emerald-600 text-sm font-bold flex items-center gap-1 mt-1">
                ↑ {fss?.trend ?? '0%'} since onboarding
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">INDUSTRY AVG</div>
              <div className="text-xl font-bold text-slate-300">{fss?.benchmark ?? 0}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-6">Financial Stability Score (FSS)</p>
        </div>

        {/* 2. Workforce Stability */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="text-xs font-black text-blue-600 uppercase tracking-[2px] mb-4">WORKFORCE STABILITY</div>
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-3xl font-black text-slate-900" ref={el => { numberRefs.current[1] = el; }} data-value={stability?.retentionAfter ?? 0}>
                  {stability?.retentionAfter ?? 0}%
                </div>
                <div className="text-xs text-emerald-600 font-bold">6-Month Retention</div>
              </div>
              <div className="text-right text-xs">
                <div className="line-through text-slate-400">71%</div>
                <div className="text-emerald-600 font-black">+18%</div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-black text-emerald-600" ref={el => { numberRefs.current[2] = el; }} data-value={stability?.recruitmentLift ?? 0}>
                  {stability?.recruitmentLift ?? 0}%
                </div>
                <div className="text-xs text-slate-500">Recruitment Lift</div>
              </div>
              <div>
                <div className="text-2xl font-black text-indigo-600" ref={el => { numberRefs.current[3] = el; }} data-value={stability?.engagement ?? 0}>
                  {stability?.engagement ?? 0}%
                </div>
                <div className="text-xs text-slate-500">Engagement Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Financial Momentum */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm relative overflow-hidden">
          <div className="text-xs font-black text-amber-600 uppercase tracking-[2px] mb-4">FINANCIAL MOMENTUM</div>
          <div className="text-4xl font-black text-slate-900">+11%</div>
          <div className="text-xs text-slate-500">MoM Growth</div>

          {/* Mini bars */}
          <div className="flex gap-1 mt-6">
            {(momentum?.growthRates ?? []).map((g: number, i: number) => (
              <div key={i} className="flex-1 bg-emerald-100 rounded-t" style={{ height: `${g * 2.4}px` }} />
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid lg:grid-cols-5 gap-8">
        {/* BEHAVIOUR TREND CHART */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between mb-6">
            <h3 className="font-black text-slate-900">Financial Stability Trend</h3>
            <div className="text-xs text-emerald-600 font-bold">8-WEEK ROLLING</div>
          </div>

          <div className="h-80 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fss?.weekly ?? []}>
                <defs>
                  <linearGradient id="fssGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[30, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 30px -10px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="fss" stroke="#10b981" strokeWidth={4} fill="url(#fssGrad)" />
                <ReferenceLine y={fss?.benchmark ?? 68} stroke="#e2e8f0" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 text-center">Based on {totalEvents ?? 0} wage access events • Projected next week: 87</p>
        </div>

        {/* COUNTRY BREAKDOWN */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-900 mb-6">Country Performance</h3>
          <div className="space-y-7 flex-1">
            {(countryBreakdown ?? []).map((c: any) => (
              <div key={c.code} className="flex items-center gap-4">
                <div className="w-9 h-9 bg-linear-to-br from-emerald-400 to-teal-500 text-white text-xs font-black rounded-2xl flex items-center justify-center shadow">
                  {c.code}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">FSS</span>
                    <span className="font-black text-emerald-600">{c.fss}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded mt-2">
                    <div className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded" style={{ width: `${c.fss}%` }} />
                  </div>
                </div>
                <div className="text-emerald-600 text-xs font-bold w-12 text-right">{c.growth}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;