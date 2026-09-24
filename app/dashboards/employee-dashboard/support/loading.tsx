import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* 2 Top Action Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-emerald-600/10 dark:bg-emerald-900/20 rounded-[2rem] p-8 border border-emerald-500/20 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-12 w-48 rounded-2xl" />
        </div>

        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 dark:border-white/10 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1">
          <Skeleton className="w-5 h-5 rounded-md" />
          <Skeleton className="h-3 w-56 rounded-md" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 flex items-center justify-between"
            >
              <Skeleton className="h-4 w-64 rounded-md" />
              <Skeleton className="w-4 h-4 rounded-sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Support Tickets */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1">
          <Skeleton className="w-5 h-5 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
        </div>

        <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="p-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
