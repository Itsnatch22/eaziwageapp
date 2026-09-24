import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-8"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-64 rounded-md" /><Skeleton className="h-4 w-80 rounded-md" /></div><Skeleton className="h-10 w-28 rounded-xl" /></div><div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-8 w-28 rounded-md" /><Skeleton className="h-4 w-40 rounded-md" /></div>)}</div><div className="rounded-2xl border overflow-hidden"><div className="flex gap-4 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 flex-1 rounded-md" />)}</div><div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div></div></div>;
}
