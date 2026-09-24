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
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* 4 Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30"
          >
            <Skeleton className="w-11 h-11 rounded-xl mb-3" />
            <Skeleton className="h-4 w-28 rounded-md mb-2" />
            <Skeleton className="h-8 w-24 rounded-md mb-2" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30">
        <div className="flex flex-col lg:flex-row gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <div className="flex items-center gap-2 flex-wrap">
            {['All', 'Pending', 'Approved', 'Disbursed', 'Rejected'].map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Advances List */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="p-4 flex flex-col xl:flex-row xl:items-center gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>

              <div className="space-y-1 xl:text-right">
                <Skeleton className="h-5 w-24 rounded-md xl:ml-auto" />
                <Skeleton className="h-3 w-32 rounded-md xl:ml-auto" />
              </div>

              <div className="space-y-1 xl:text-right">
                <Skeleton className="h-5 w-20 rounded-md xl:ml-auto" />
                <Skeleton className="h-3 w-24 rounded-md xl:ml-auto" />
              </div>

              <div className="flex items-center">
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>

              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20 rounded-lg" />
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}