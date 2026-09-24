import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-40 rounded-md" /><Skeleton className="h-4 w-72 rounded-md" /></div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-7 w-24 rounded-md" /><Skeleton className="h-4 w-28 rounded-md" /></div>)}
      </div>
      <div className="rounded-2xl border p-4"><Skeleton className="h-10 w-full max-w-md rounded-lg" /></div>
      <div className="rounded-2xl border overflow-hidden">
        <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4 flex-1 rounded-md" />)}</div>
        <div className="p-4 space-y-3">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      </div>
    </div>
  );
}
