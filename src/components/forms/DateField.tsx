import { addDays } from '../../lib/dates';
import { T } from '../../texts';
import { cn } from '../ui/cn';
import { Field, TextInput, useFieldId } from '../ui/Field';

/** Native date picker plus "Avui" / "Ahir" shortcuts. */
export function DateField({
  label,
  value,
  onChange,
  error,
  today,
  shortcuts = true,
  min,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  today: string;
  shortcuts?: boolean;
  min?: string;
  testId?: string;
}) {
  const id = useFieldId('date');
  const yesterday = addDays(today, -1);
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex min-w-0 items-center gap-2">
        <TextInput
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          invalid={!!error}
          data-testid={testId}
          className="flex-1"
        />
        {shortcuts && (
          <>
            <Shortcut active={value === today} onClick={() => onChange(today)} label={T.common.today} />
            <Shortcut active={value === yesterday} onClick={() => onChange(yesterday)} label={T.common.yesterday} />
          </>
        )}
      </div>
    </Field>
  );
}

function Shortcut({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('h-12 shrink-0 rounded-xl px-3 text-[14px] font-semibold transition-colors', active ? 'bg-primary text-white' : 'bg-soft text-ink-2 active:bg-soft-2')}
    >
      {label}
    </button>
  );
}
