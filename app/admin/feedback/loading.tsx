import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="space-y-8"><div className="space-y-2"><Skeleton className="h-9 w-56 rounded-md" /><Skeleton className="h-4 w-72 rounded-md" /></div><Skeleton className="h-10 w-full max-w-md rounded-lg" /><div className="rounded-2xl border p-4 space-y-3">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div></div>;
}
