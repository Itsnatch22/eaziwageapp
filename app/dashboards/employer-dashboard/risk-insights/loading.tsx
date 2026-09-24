import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-8 w-44 rounded-xl" />
          <Skeleton className="h-6 w-36 rounded-md" />
        </div>
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Top Grid: CRS & Rating Scale */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Composite Risk Score Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30 text-center">
          <Skeleton className="h-4 w-44 mx-auto rounded-md mb-4" />
          <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
            <Skeleton className="w-32 h-32 rounded-full" />
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl space-y-2">
            <Skeleton className="h-4 w-36 mx-auto rounded-md" />
            <Skeleton className="h-7 w-20 mx-auto rounded-md" />
          </div>
        </div>

        {/* Risk Rating Scale Card */}
        <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-5">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Breakdown Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-52 rounded-md" />
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-md">
                  <Skeleton className="h-5 w-48 rounded-md" />
                  <Skeleton className="h-3 w-64 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-28 rounded-md hidden sm:block" />
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="w-5 h-5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Fee Impact & Improvement Steps */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fee Impact Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
          </div>
          <div className="p-4 bg-primary/5 rounded-xl space-y-2">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* How to Improve Score Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-44 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl mt-2" />
        </div>
      </div>

      {/* Framework Info Banner */}
      <div className="bg-blue-50/60 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/30">
        <div className="flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-5 w-56 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-4/6 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}