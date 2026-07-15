'use client';

import { useState } from 'react';
import { Copy, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  /** Used for aria-label/title, and as the visible text in the 'pill' variant. */
  label?: string;
  /** Toast shown on success. Omit for a silent copy (icon swap only). */
  successMessage?: string;
  /** icon: filled primary square button. ghost: transparent hover button. pill: labeled outline button. */
  variant?: 'icon' | 'ghost' | 'pill';
  size?: 'sm' | 'md';
  className?: string;
  /** Overrides the ghost variant's default slate/emerald icon color — for use on dark or colored backgrounds. */
  iconClassName?: string;
}

// Consolidates what were 5 near-duplicate copy-to-clipboard implementations
// (a keyed copiedRef map, a local `copied` boolean + toast, and a couple of
// bare buttons with no feedback state at all) into the 3 visual shapes those
// call sites actually used. Each instance manages its own `copied` state, so
// no keying is needed even when several CopyButtons appear in the same list.
export function CopyButton({
  value,
  label = 'Copy',
  successMessage,
  variant = 'icon',
  size = 'md',
  className,
  iconClassName,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (successMessage) toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const Icon = copied ? ClipboardCheck : Copy;
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
          className,
        )}
      >
        <Icon className={iconSize} />
        {copied ? 'Copied' : label}
      </button>
    );
  }

  if (variant === 'ghost') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={label}
        aria-label={label}
        className={cn('p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors', className)}
      >
        <Icon className={cn(iconSize, iconClassName ?? (copied ? 'text-emerald-500' : 'text-slate-400'))} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        'shrink-0 p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors',
        className,
      )}
    >
      <Icon className={iconSize} />
    </button>
  );
}
