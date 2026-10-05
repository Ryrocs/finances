/** "Nice" axis ticks (1, 2, 2.5, 5 × 10^n) covering [min, max] and always including 0. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (lo === hi) hi = lo + 1;
  const rawStep = (hi - lo) / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  const step = nice * magnitude;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Nice ticks strictly inside [min, max] (not forced to include 0) — for line charts. */
export function niceTicksInRange(min: number, max: number, target = 3): number[] {
  if (max <= min) return [min];
  const rawStep = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}
