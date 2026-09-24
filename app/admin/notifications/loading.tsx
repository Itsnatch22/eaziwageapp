import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-8"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-56 rounded-md" /><Skeleton className="h-4 w-72 rounded-md" /></div><div className="flex gap-2"><Skeleton className="h-10 w-24 rounded-lg" /><Skeleton className="h-10 w-32 rounded-lg" /></div></div><div className="rounded-2xl border p-5 space-y-4"><Skeleton className="h-6 w-40 rounded-md" /><div className="grid sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div></div><div className="flex gap-3"><Skeleton className="h-10 flex-1 rounded-lg" /><Skeleton className="h-10 w-28 rounded-lg" /></div><div className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div></div>;
}
