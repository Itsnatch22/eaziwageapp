import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md max-w-full" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>
      </div>

      {/* Notifications list container */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-6 flex gap-5">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md" />
                </div>
                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
              </div>
              <Skeleton className="h-3 w-4/5 rounded-md pt-1" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
