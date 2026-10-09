import { useLayoutEffect, useRef, useState } from 'react';
import { formatEUR, formatEURCompact, type FormatOptions } from '../../lib/money';
import { cn } from './cn';

/**
 * An amount that always stays on one line inside its box: if it doesn't fit it shrinks the font
 * (down to `minScale`) and, as a last resort, switches to the compact format ("12,3k €").
 */
export function FitAmount({
  cents,
  className,
  options,
  minScale = 0.6,
  testId,
}: {
  cents: number;
  className?: string;
  options?: FormatOptions;
  minScale?: number;
  testId?: string;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ scale: number; compact: boolean }>({ scale: 1, compact: false });
  const full = formatEUR(cents, options);
  const text = fit.compact ? `${options?.signed && cents > 0 ? '+' : ''}${formatEURCompact(cents)}` : full;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const update = () => {
      const available = box.clientWidth;
      const needed = measure.scrollWidth;
      let next = { scale: 1, compact: false };
      if (available > 0 && needed > available) {
        const scale = Math.floor((available / needed) * 100) / 100;
        next = scale >= minScale ? { scale, compact: false } : { scale: 1, compact: true };
      }
      setFit((s) => (s.scale === next.scale && s.compact === next.compact ? s : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [full, minScale]);

  return (
    <span ref={boxRef} className={cn('relative block min-w-0 overflow-hidden', className)} data-testid={testId} title={full}>
      <span ref={measureRef} aria-hidden className="money invisible absolute left-0 top-0">
        {full}
      </span>
      <span className="money inline-block" style={fit.scale < 1 ? { fontSize: `${fit.scale}em` } : undefined}>
        {text}
      </span>
    </span>
  );
}
