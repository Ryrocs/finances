import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { addMonths, formatMonthYear, MONTHS, type MonthKey } from '../lib/dates';
import { useAppState } from '../state/app';
import { T } from '../texts';
import { Button, IconButton } from './ui/Button';
import { cn } from './ui/cn';
import { Sheet } from './ui/Sheet';

/** ‹  Octubre 2026 ▾  › — arrows change month, the name opens a month/year picker. */
export function MonthSelector({ disabled = false }: { disabled?: boolean }) {
  const { month, setMonth, today } = useAppState();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('flex items-center justify-between gap-1 rounded-2xl border border-line bg-surface p-1', disabled && 'opacity-50')}>
      <IconButton aria-label={T.month.previous} onClick={() => setMonth(addMonths(month, -1))} disabled={disabled}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </IconButton>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={`${T.month.pick}: ${formatMonthYear(month)}`}
        data-testid="month-selector"
        className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 text-[17px] font-semibold active:bg-soft"
      >
        <span className="truncate">{formatMonthYear(month)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      </button>
      <IconButton aria-label={T.month.next} onClick={() => setMonth(addMonths(month, 1))} disabled={disabled}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </IconButton>
      <MonthPicker
        open={open}
        value={month}
        current={today.slice(0, 7)}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          setMonth(m);
          setOpen(false);
        }}
      />
    </div>
  );
}

function MonthPicker({ open, value, current, onClose, onPick }: { open: boolean; value: MonthKey; current: MonthKey; onClose: () => void; onPick: (m: MonthKey) => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={T.month.pick}
      footer={
        <Button variant="secondary" block onClick={() => onPick(current)}>
          {T.month.current}
        </Button>
      }
    >
      {/* Mounted only while open, so it starts at the selected month's year every time. */}
      <PickerBody value={value} current={current} onPick={onPick} />
    </Sheet>
  );
}

function PickerBody({ value, current, onPick }: { value: MonthKey; current: MonthKey; onPick: (m: MonthKey) => void }) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconButton aria-label={T.month.previousYear} onClick={() => setYear(year - 1)}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <span className="text-[18px] font-semibold tabular">{year}</span>
        <IconButton aria-label={T.month.nextYear} onClick={() => setYear(year + 1)}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((name, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`;
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-pressed={selected}
              className={cn(
                'h-12 rounded-xl text-[15px] font-medium capitalize transition-colors',
                selected ? 'bg-primary text-white' : key === current ? 'bg-soft font-semibold text-ink' : 'bg-surface text-ink-2 active:bg-soft',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
