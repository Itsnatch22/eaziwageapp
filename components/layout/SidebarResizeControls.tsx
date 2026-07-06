'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarResizeControlsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onStartResize: (e: React.MouseEvent) => void;
  /** Full Tailwind class applied to the drag-handle line on hover, e.g. 'group-hover:bg-green-500/60'. */
  hoverLineClassName?: string;
}

// Desktop-only drag handle (full-height strip on the sidebar's right edge) plus
// a small floating toggle button to collapse/expand to an icon-only rail.
// Shared across the admin/employer/employee dashboards so the interaction is
// identical everywhere.
export function SidebarResizeControls({
  collapsed,
  onToggleCollapse,
  onStartResize,
  hoverLineClassName = 'group-hover:bg-green-500/60',
}: SidebarResizeControlsProps) {
  return (
    <>
      {!collapsed && (
        <div
          onMouseDown={onStartResize}
          className="hidden lg:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20 group"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        >
          <div className={cn('absolute inset-y-0 right-0 w-0.5 transition-colors', hoverLineClassName)} />
        </div>
      )}

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden lg:flex absolute top-6 -right-3 w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-500 hover:text-green-600 hover:border-green-600 transition-colors z-20"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </>
  );
}
