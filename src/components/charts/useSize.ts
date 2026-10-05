'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Measures an element's width so SVG charts render at real pixel size (crisp text, no scaling). */
export function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}
