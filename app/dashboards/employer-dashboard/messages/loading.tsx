import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Skeleton */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-6 w-44 rounded-md" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>

            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <Skeleton className="h-4 w-full rounded-md" />
            </div>

            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        {/* Right Column: Announcement History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-6 w-52 rounded-md" />
              </div>
              <Skeleton className="h-9 w-48 rounded-lg" />
            </div>

            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-5 w-60 rounded-md" />
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-3 w-32 rounded-md" />
                        <Skeleton className="h-3 w-20 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="w-8 h-8 rounded-lg" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}