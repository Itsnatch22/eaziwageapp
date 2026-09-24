import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance Card */}
        <div className="bg-linear-to-br from-primary to-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-primary/20 space-y-3">
          <Skeleton className="h-4 w-32 rounded-md bg-white/30" />
          <Skeleton className="h-10 w-44 rounded-md bg-white/40" />
          <Skeleton className="h-7 w-48 rounded-full bg-white/20 mt-4" />
        </div>

        {/* Outstanding Arrears Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-4 w-36 rounded-md" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-3 w-56 rounded-md mt-2" />
        </div>

        {/* Total Disbursed Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-7 w-32 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-6 w-44 rounded-md" />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-160">
            {/* Table Header Row */}
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 flex items-center gap-4 border-b border-slate-200/50 dark:border-slate-700/30">
              <Skeleton className="w-24 h-4 rounded-md" />
              <Skeleton className="w-32 h-4 rounded-md" />
              <Skeleton className="w-24 h-4 rounded-md" />
              <Skeleton className="flex-1 h-4 rounded-md" />
              <Skeleton className="w-24 h-4 rounded-md" />
              <Skeleton className="w-20 h-4 rounded-md" />
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="px-6 py-4 flex items-center gap-4">
                  <Skeleton className="w-24 h-4 rounded-md" />
                  <Skeleton className="w-32 h-4 rounded-md font-mono" />
                  <div className="w-24 flex items-center gap-2">
                    <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                    <Skeleton className="w-14 h-4 rounded-md" />
                  </div>
                  <Skeleton className="flex-1 h-4 rounded-md" />
                  <Skeleton className="w-24 h-5 rounded-md font-bold" />
                  <Skeleton className="w-20 h-6 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}