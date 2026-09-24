import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile banner card */}
      <div className="bg-slate-900 dark:bg-emerald-900/40 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <Skeleton className="w-24 h-24 rounded-3xl shrink-0" />
          <div className="text-center md:text-left space-y-2 flex-1 flex flex-col items-center md:items-start">
            <Skeleton className="h-8 w-52 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Detail Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-white/10 flex items-start gap-4"
          >
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-4 w-44 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Organization Policy card */}
      <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 dark:border-white/10 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-6 w-48 rounded-md" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <Skeleton className="h-4 w-44 rounded-md" />
              </div>
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>

        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/40 flex items-start gap-3">
          <Skeleton className="w-5 h-5 rounded-md shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
