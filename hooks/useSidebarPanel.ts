'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSidebarPanelOptions {
  /** Namespaces the localStorage keys per dashboard (e.g. 'admin', 'employer', 'employee'). */
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
}

// Desktop-only resizable/collapsible sidebar state, persisted per dashboard.
// Mobile (below the `lg` breakpoint) always uses defaultWidth as a full-width
// slide-over drawer — collapse/resize preferences only apply once there's
// room for them to matter.
export function useSidebarPanel({
  storageKey,
  defaultWidth = 288,
  minWidth = 220,
  maxWidth = 420,
  collapsedWidth = 80,
}: UseSidebarPanelOptions) {
  const widthKey = `${storageKey}-sidebar-width`;
  const collapsedKey = `${storageKey}-sidebar-collapsed`;

  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef(false);

  useEffect(() => {
    // One-time sync from localStorage/matchMedia on mount — these are external
    // sources React doesn't otherwise know about, not derived from prior state.
    try {
      const storedWidth = localStorage.getItem(widthKey);
      const storedCollapsed = localStorage.getItem(collapsedKey);
      if (storedWidth) {
        const parsed = Number(storedWidth);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(parsed)) setWidth(Math.min(maxWidth, Math.max(minWidth, parsed)));
      }
      if (storedCollapsed) setCollapsed(storedCollapsed === 'true');
    } catch {
      // localStorage unavailable (private browsing etc.) — fall back to defaults
    }

    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(collapsedKey, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [collapsedKey]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let latestWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      latestWidth = Math.min(maxWidth, Math.max(minWidth, moveEvent.clientX));
      setWidth(latestWidth);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      try { localStorage.setItem(widthKey, String(latestWidth)); } catch { /* ignore */ }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWidth, maxWidth, widthKey]);

  const effectiveWidth = isDesktop ? (collapsed ? collapsedWidth : width) : defaultWidth;
  const contentMarginLeft = isDesktop ? effectiveWidth : 0;

  return {
    width,
    collapsed,
    isDesktop,
    isResizing,
    effectiveWidth,
    contentMarginLeft,
    toggleCollapsed,
    startResize,
    collapsedWidth,
  };
}

export type SidebarPanel = ReturnType<typeof useSidebarPanel>;
