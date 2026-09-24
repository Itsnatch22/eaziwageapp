import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Section: Main Company Overview & 4 Metric Cards */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* MainStatsCard skeleton */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-6 w-44 rounded-md" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
            <Skeleton className="w-36 h-36 rounded-full" />
          </div>

          <div className="flex items-center justify-center gap-8">
            <div className="text-center space-y-1">
              <Skeleton className="h-7 w-12 mx-auto rounded-md" />
              <Skeleton className="h-3 w-14 mx-auto rounded-md" />
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center space-y-1">
              <Skeleton className="h-7 w-14 mx-auto rounded-md" />
              <Skeleton className="h-3 w-16 mx-auto rounded-md" />
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30"
            >
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32 rounded-md mb-2" />
              <Skeleton className="h-8 w-28 rounded-md mb-2" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Middle Grid: Advances, Employees, Payroll Health */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Advances Summary Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Employees Summary Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Skeleton className="h-3 w-40 rounded-md mb-3" />
            <div className="flex items-end gap-1 h-12">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <Skeleton
                    className="w-full rounded-t-sm"
                    style={{ height: `${16 + ((i * 11) % 32)}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payroll Health Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-5 w-32 rounded-md" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl space-y-2">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-6 w-12 rounded-md" />
              </div>
              <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl space-y-2">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-6 w-12 rounded-md" />
              </div>
            </div>
          </div>
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
      </div>

      {/* Annual Access Available Section */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-5 w-48 rounded-md" />
          </div>
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30"
            >
              <Skeleton className="w-10 h-10 rounded-xl mb-3" />
              <Skeleton className="h-4 w-36 rounded-md mb-2" />
              <Skeleton className="h-8 w-28 rounded-md mb-2" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Referral Code & Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full rounded-md" />
          <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
            <Skeleton className="h-6 w-32 flex-1 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between mb-5">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm space-y-3"
              >
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-4 w-44 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Company Status & Risk Assessment */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <Skeleton className="h-6 w-36 rounded-md mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="h-5 w-36 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-linear-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
          <div className="flex items-start justify-between mb-5">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>

          <div className="flex items-center gap-6 mb-6">
            <Skeleton className="w-24 h-24 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-48 rounded-md" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 bg-white/40 dark:bg-slate-800/40 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}