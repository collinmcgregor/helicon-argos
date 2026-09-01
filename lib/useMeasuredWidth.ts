'use client';

import { useEffect, useRef, useState } from 'react';

// Charts render in real pixel space (no viewBox stretching) so axis text,
// crosshairs, and tooltips stay crisp; this tracks the container width.
export function useMeasuredWidth(fallback = 620) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}
