import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top 12-col grid: SpeedDial card + 4 StatBlocks */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: SpeedDial circular card */}
        <div className="lg:col-span-5">
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-8 space-y-8 relative overflow-hidden">
            <div className="w-44 h-44 rounded-full mx-auto relative flex flex-col items-center justify-center p-4">
              <Skeleton className="w-44 h-44 rounded-full absolute inset-0" />
              <div className="relative z-10 space-y-2 flex flex-col items-center">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 py-2">
              <div className="text-center space-y-1 flex flex-col items-center">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
              <div className="text-center space-y-1 flex flex-col items-center">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            </div>

            <Skeleton className="w-full h-13 rounded-2xl" />
          </div>
        </div>

        {/* Right: 4 StatBlocks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3"
              >
                <Skeleton className="w-9 h-9 rounded-xl" />
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-7 w-28 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            ))}
          </div>

          {/* Verification / status banner placeholder */}
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
            </div>
            <Skeleton className="w-4 h-4 rounded-md" />
          </div>
        </div>
      </div>

      {/* Advance Calculator promo banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-700/30 bg-white/40 dark:bg-white/3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-56 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>

      {/* Bottom 12-col grid: Recent Activity + Account Health */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Recent Activity */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-3 w-14 rounded-md" />
          </div>

          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </div>
                <div className="space-y-1.5 flex flex-col items-end">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-3 w-14 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Account Health */}
        <div className="lg:col-span-4 space-y-3">
          <div className="px-1">
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>

          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-5 space-y-5">
            <div className="space-y-3">
              {[0, 1].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-xl" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
              <Skeleton className="h-3 w-14 rounded-md" />
              <Skeleton className="w-full h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
