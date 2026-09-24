import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between py-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left: Tab list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/30 space-y-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-24 rounded-md flex-1" />
                {index === 0 && <Skeleton className="w-3.5 h-3.5 rounded-sm" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Settings Card */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-4 w-64 rounded-md" />
              </div>
            </div>

            {/* Avatar upload placeholder */}
            <div className="flex flex-col items-center my-6">
              <Skeleton className="w-24 h-24 rounded-full" />
              <Skeleton className="h-3 w-28 rounded-md mt-3" />
            </div>

            {/* Form grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
