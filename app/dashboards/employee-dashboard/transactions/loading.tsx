import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-8 w-44 rounded-md" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* 2 Stat Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 dark:bg-white/4 rounded-3xl p-6 space-y-2">
          <Skeleton className="w-9 h-9 rounded-xl mb-4" />
          <Skeleton className="h-2.5 w-20 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-2.5 w-32 rounded-md" />
        </div>

        <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-6 space-y-2">
          <Skeleton className="w-9 h-9 rounded-xl mb-4" />
          <Skeleton className="h-2.5 w-24 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-2.5 w-36 rounded-md" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Skeleton className="h-11 w-full flex-1 rounded-xl" />
        <div className="flex gap-2 w-full sm:w-auto">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-16 sm:w-20 rounded-xl shrink-0" />
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="px-5 py-4 flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-36 rounded-md" />
            </div>
            <div className="space-y-1.5 flex flex-col items-end shrink-0">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="w-4 h-4 rounded-sm shrink-0 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
