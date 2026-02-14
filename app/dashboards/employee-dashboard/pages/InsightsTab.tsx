import React from 'react';
import { Icons } from '@/constants';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon }) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center group hover:border-green-200 transition-colors">
    <div className="p-3 bg-slate-50 text-green-400 group-hover:text-green-500 group-hover:bg-green-50 rounded-2xl mb-3 transition-colors">
      {icon}
    </div>
    <div className="text-2xl font-black text-slate-900 mb-1">{value}</div>
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
  </div>
);

interface InsightsTabProps {
  performanceMetrics: {
    daysWorked: number;
    overtimeHours: number;
    officeAttendance: number;
    dailyRate: number;
    overtimeRate: number;
  };
}

const InsightsTab: React.FC<InsightsTabProps> = ({ performanceMetrics }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Days Worked" value={performanceMetrics.daysWorked} icon={<Icons.Calendar size={20}/>} />
        <MetricCard label="Overtime (Hrs)" value={performanceMetrics.overtimeHours} icon={<Icons.Clock size={20}/>} />
        <MetricCard label="Office Attendance" value={`${performanceMetrics.officeAttendance}%`} icon={<Icons.Users size={20}/>} />
      </div>
      
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
        <h3 className="font-bold text-green-900 mb-6">Earnings Breakdown (Current Month)</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-green-900">Regular Wages</span>
              <span className="text-xs text-slate-500">{performanceMetrics.daysWorked} days at ${performanceMetrics.dailyRate}/day</span>
            </div>
            <span className="font-bold text-green-900">${(performanceMetrics.daysWorked * performanceMetrics.dailyRate).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-50">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-green-900">Overtime Premium</span>
              <span className="text-xs text-slate-500">{performanceMetrics.overtimeHours} hours at ${performanceMetrics.overtimeRate}/hr</span>
            </div>
            <span className="font-bold text-green-900">${(performanceMetrics.overtimeHours * performanceMetrics.overtimeRate).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <div className="flex flex-col">
              <span className="text-base font-bold text-green-900">Gross Earned Total</span>
              <span className="text-xs text-emerald-600 font-bold">Attendance Multiplier: {performanceMetrics.officeAttendance}%</span>
            </div>
            <span className="text-xl font-black text-green-600">
              ${(performanceMetrics.daysWorked * performanceMetrics.dailyRate + performanceMetrics.overtimeHours * performanceMetrics.overtimeRate).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-blue-100 text-green-600 rounded-xl">
            <Icons.TrendingUp size={24} />
          </div>
          <div>
            <h4 className="font-bold text-green-900">Advance Eligibility Note</h4>
            <p className="text-sm text-green-700 leading-relaxed mt-1">
              Your advance limit is currently capped at 70% of gross earned wages. This percentage may increase based on your long-term performance and attendance history.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;