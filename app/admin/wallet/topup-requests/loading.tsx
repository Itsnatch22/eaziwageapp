import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-6"><div className="space-y-2"><Skeleton className="h-8 w-64 rounded-md" /><Skeleton className="h-4 w-96 rounded-md" /></div><div className="rounded-2xl border overflow-hidden"><div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 flex-1 rounded-md" />)}</div><div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex items-center gap-4 h-20"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 flex-1 rounded-md" /><Skeleton className="h-5 w-28 rounded-md" /><Skeleton className="h-9 w-24 rounded-md" /></div>)}</div></div></div>;
}
