import { describe, expect, it } from 'vitest';
import { cn } from '../../src/components/ui/cn';

describe('cn', () => {
  it('lets later utilities override earlier ones, including theme colours and arbitrary sizes', () => {
    expect(cn('p-4', 'p-0')).toBe('p-0');
    // px/py come after p in Tailwind's CSS, so they win without removing p-4.
    expect(cn('rounded-card border p-4', 'p-0 overflow-hidden')).toBe('rounded-card border p-0 overflow-hidden');
    expect(cn('text-[16px] text-ink', 'text-[24px]')).toBe('text-ink text-[24px]');
    expect(cn('bg-soft text-ink', 'text-expense-ink')).toBe('bg-soft text-expense-ink');
    expect(cn('h-12', 'h-auto min-h-[88px]')).toBe('h-auto min-h-[88px]');
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
