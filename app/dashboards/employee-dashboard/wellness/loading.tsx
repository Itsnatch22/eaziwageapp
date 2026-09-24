import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Top Banner Card */}
      <div className="bg-emerald-600/15 dark:bg-emerald-950/40 rounded-[2.5rem] p-8 md:p-12 border border-emerald-500/20 shadow-2xl space-y-4">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-9 w-96 rounded-md max-w-full" />
        <Skeleton className="h-5 w-3/4 rounded-md max-w-full" />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Monthly Budget Planner */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>

          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-white/10 p-8 space-y-8">
            <div className="grid sm:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-36 rounded-md" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-28 rounded-md" />
                  <Skeleton className="h-8 w-36 rounded-md" />
                </div>
                <div className="space-y-1.5 flex flex-col items-end">
                  <Skeleton className="h-2.5 w-20 rounded-md" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              </div>

              <Skeleton className="w-full h-3 rounded-full" />
              <Skeleton className="h-2.5 w-72 rounded-md pt-1" />
            </div>
          </div>
        </div>

        {/* Right: Financial Tips */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 flex items-start gap-4"
              >
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-4/5 rounded-md" />
                </div>
              </div>
            ))}

            <Skeleton className="w-full h-10 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
