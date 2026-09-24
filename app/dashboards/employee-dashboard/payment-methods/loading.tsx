import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-52 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-12 w-44 rounded-2xl" />
      </div>

      {/* Payment methods list */}
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-5">
              <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  {index === 0 && <Skeleton className="h-5 w-16 rounded-full" />}
                </div>
                <Skeleton className="h-4 w-40 rounded-md font-mono" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Security note card */}
      <div className="bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-[2rem] p-6 flex gap-4">
        <Skeleton className="w-6 h-6 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-md" />
        </div>
      </div>
    </div>
  );
}
