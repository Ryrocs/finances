/** "Nice" step (1, 2, 2,5 or 5 × 10^n) for about `target` intervals over `span`. */
function niceStep(span: number, target: number): number {
  const raw = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Y-axis fitted to the data (not anchored at 0), so variations are visible:
 * [min, max] padded a little and rounded outwards to nice ticks.
 */
export function fittedDomain(min: number, max: number, target = 4): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  let lo = min;
  let hi = max;
  if (hi - lo < 1) {
    // A flat line: open a small window around it (5 % of the value, at least 10 €).
    const pad = Math.max(Math.abs(hi) * 0.05, 1000);
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, target);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [start, end], ticks };
}

/** Axis including 0 (bars must grow from a zero baseline). */
export function zeroBasedDomain(min: number, max: number, target = 4): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi - lo < 1) return { domain: [0, 1000], ticks: [0, 500, 1000] };
  const step = niceStep(hi - lo, target);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [start, end], ticks };
}
