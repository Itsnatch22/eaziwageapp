import React from 'react';

interface TabButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ active, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
      active 
        ? 'bg-slate-900 text-white shadow-md' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    {label}
  </button>
);

interface NotificationItemProps {
  text: string;
  time: string;
  type: 'success' | 'info';
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ text, time, type }) => (
  <div className="p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 flex space-x-3">
    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${type === 'success' ? 'bg-emerald-500' : 'bg-green-500'}`}></div>
    <div>
      <p className="text-xs font-semibold text-slate-900 leading-snug">{text}</p>
      <span className="text-[10px] text-slate-400">{time}</span>
    </div>
  </div>
);