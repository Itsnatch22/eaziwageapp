"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: { name: string; value: number };
    value: number;
    name: string;
  }[];
  totalEmployees: number;
}

const DEPARTMENT_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function departmentColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEPARTMENT_COLORS[Math.abs(hash) % DEPARTMENT_COLORS.length];
}

const CustomTooltip = ({
  active,
  payload,
  totalEmployees,
}: CustomTooltipProps) => {
  if (active && payload?.length) {
    const { name, value } = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {name}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {value} employees (
          {totalEmployees > 0 ? ((value / totalEmployees) * 100).toFixed(1) : 0}
          %)
        </p>
      </div>
    );
  }
  return null;
};

export default function DepartmentPieChart({
  data,
  totalEmployees,
}: {
  data: Record<string, number>;
  totalEmployees: number;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: Number(value),
    color: departmentColor(name),
  }));

  return (
    <div className="flex items-center gap-6" data-testid="department-pie-chart">
      <div className="relative w-40 h-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip totalEmployees={totalEmployees} />}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {totalEmployees}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Total
          </span>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2">
        {chartData.slice(0, 8).map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {item.name}
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white ml-auto">
              {item.value}
            </span>
          </div>
        ))}
        {chartData.length > 8 && (
          <div className="text-xs text-slate-500 col-span-2">
            +{chartData.length - 8} more departments
          </div>
        )}
      </div>
    </div>
  );
}
