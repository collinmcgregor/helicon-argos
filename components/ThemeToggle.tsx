'use client';

import { useLayoutEffect } from 'react';

const STORAGE_KEY = 'argos-theme';

const apply = (theme: 'light' | 'dark') => {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this page */
  }
};

// LIGHT|DARK segmented control, same idiom as the facility selector. The active
// segment is styled from html[data-theme] in globals.css (.theme-toggle rules),
// so this component holds no theme state and can't mismatch the inline script.
export function ThemeToggle() {
  // Dev-only Strict Mode remount resets <html> attributes; re-apply before paint.
  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div className="theme-toggle flex h-6 items-center rounded-sm border border-border">
      {(['light', 'dark'] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          data-set={theme}
          onClick={() => apply(theme)}
          className="h-full cursor-pointer px-2 font-mono text-[11px] text-text-muted transition-colors duration-100 hover:text-text-secondary"
        >
          {theme.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
