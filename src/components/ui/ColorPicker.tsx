import { Check } from 'lucide-react';
import { PALETTE } from '../../db/seed';
import { cn } from './cn';

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  const colors = PALETTE.includes(value.toUpperCase()) || PALETTE.includes(value) ? PALETTE : [value, ...PALETTE];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {colors.map((c) => {
        const selected = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn('flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 transition-shadow', selected && 'ring-2 ring-ink')}
            style={{ backgroundColor: c }}
          >
            {selected && <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
