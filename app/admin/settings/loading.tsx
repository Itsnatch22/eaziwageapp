import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-8"><div className="space-y-2"><Skeleton className="h-9 w-52 rounded-md" /><Skeleton className="h-4 w-96 rounded-md" /></div><div className="grid lg:grid-cols-[280px_1fr] gap-6"><div className="rounded-2xl border p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div><div className="space-y-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl border p-6 space-y-5"><Skeleton className="h-6 w-56 rounded-md" />{Array.from({ length: 4 }).map((_, j) => <div key={j} className="space-y-2"><Skeleton className="h-4 w-40 rounded-md" /><Skeleton className="h-10 w-full rounded-lg" /></div>)}</div>)}</div></div></div>;
}
