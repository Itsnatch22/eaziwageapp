import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
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
            <Skeleton className="h-8 w-24 rounded-md mb-2" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-full lg:w-72 rounded-xl" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-16 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Employees Table List */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        {/* Table Column Headers */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/30">
          <Skeleton className="w-10 h-4 rounded-md" />
          <Skeleton className="flex-1 h-4 rounded-md" />
          <Skeleton className="w-24 h-4 rounded-md" />
          <Skeleton className="w-20 h-4 rounded-md" />
          <Skeleton className="w-16 h-4 rounded-md" />
          <Skeleton className="w-20 h-4 rounded-md" />
          <Skeleton className="w-24 h-4 rounded-md" />
          <Skeleton className="w-16 h-4 rounded-md" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="p-4 flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
              <Skeleton className="w-24 h-4 rounded-md hidden sm:block" />
              <Skeleton className="w-20 h-4 rounded-md hidden md:block" />
              <Skeleton className="w-16 h-6 rounded-full hidden lg:block" />
              <Skeleton className="w-20 h-6 rounded-full" />
              <Skeleton className="w-20 h-8 rounded-lg hidden xl:block" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}