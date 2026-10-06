'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const EAT_TIMEZONE = 'Africa/Nairobi';

type TimeValue = number | string | Date | null | undefined;

interface TimeProps {
  value?: TimeValue;
  className?: string;
  withGreeting?: boolean;
  showSeconds?: boolean;
}

function getGreeting(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-KE', {
      hour: 'numeric',
      hour12: false,
      timeZone: EAT_TIMEZONE,
    }).format(date),
  );

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Time({
  value,
  className,
  withGreeting = true,
  showSeconds = false,
}: TimeProps) {
  const [now, setNow] = useState<Date>(() => {
    const base = value ? new Date(value) : new Date();
    return Number.isNaN(base.getTime()) ? new Date() : base;
  });

  useEffect(() => {
    if (value === undefined || value === null) {
      const interval = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(interval);
    }
  }, [value]);

  const formattedTime = useMemo(() => {
    const date = value ? new Date(value) : now;
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-KE', {
      timeZone: EAT_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(date);
  }, [now, showSeconds, value]);

  const greeting = useMemo(() => getGreeting(value ? new Date(value) : now), [now, value]);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {withGreeting ? <span>{greeting}</span> : null}
      <span className="tabular-nums">{formattedTime}</span>
      <span className="text-xs uppercase tracking-[0.18em] opacity-70">EAT</span>
    </span>
  );
}

export default Time;
