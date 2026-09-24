import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-8"><div className="space-y-4"><Skeleton className="h-4 w-28 rounded-md" /><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-xl" /><Skeleton className="h-7 w-64 rounded-md" /></div><div className="flex gap-2 border-b pb-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-md" />)}</div></div><div className="grid sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-8 w-28 rounded-md" /><Skeleton className="h-4 w-36 rounded-md" /></div>)}</div><div className="rounded-2xl border p-5 space-y-4"><Skeleton className="h-6 w-48 rounded-md" />{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div></div>;
}
