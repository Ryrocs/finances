export interface DonutSlice {
  id: string;
  label: string;
  color: string;
  value: number;
}

/** Folds everything after the first `max` slices into one neutral slice, so the donut stays readable. */
export function foldSlices(slices: DonutSlice[], max: number, otherLabel: string): DonutSlice[] {
  if (slices.length <= max + 1) return slices;
  const rest = slices.slice(max).reduce((sum, s) => sum + s.value, 0);
  return [...slices.slice(0, max), { id: '__rest', label: otherLabel, color: '#cfd0d6', value: rest }];
}
