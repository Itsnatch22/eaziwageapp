import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30"
          >
            <Skeleton className="w-10 h-10 rounded-xl mb-3" />
            <Skeleton className="h-4 w-28 rounded-md mb-2" />
            <Skeleton className="h-8 w-32 rounded-md mb-2" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        ))}
      </div>

      {/* Payroll Impact Simulator Card */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-3 w-72 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="w-5 h-5 rounded-md" />
          </div>
        </div>
      </div>

      {/* 2 Middle Cards: API Connection & Monthly EWA Deduction */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payroll API Connection Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-4 w-56 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>

          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 flex-1 rounded-xl" />
          </div>
        </div>

        {/* Monthly EWA Deduction Card */}
        <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/20 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-4 w-60 rounded-md" />
            </div>
          </div>

          <div className="p-6 bg-white/60 dark:bg-slate-800/30 rounded-xl text-center space-y-2">
            <Skeleton className="h-4 w-32 mx-auto rounded-md" />
            <Skeleton className="h-9 w-48 mx-auto rounded-md" />
            <Skeleton className="h-3 w-40 mx-auto rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl space-y-1.5 text-center">
              <Skeleton className="h-3 w-28 mx-auto rounded-md" />
              <Skeleton className="h-6 w-32 mx-auto rounded-md" />
            </div>
            <div className="p-3 bg-white/50 dark:bg-slate-800/30 rounded-xl space-y-1.5 text-center">
              <Skeleton className="h-3 w-28 mx-auto rounded-md" />
              <Skeleton className="h-6 w-32 mx-auto rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Upload History Section */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 space-y-1.5">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>

        <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-5 w-28 rounded-md hidden sm:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}