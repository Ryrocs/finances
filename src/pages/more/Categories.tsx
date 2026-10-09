import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { chipClass } from '../../components/sheets/Chips';
import { Button } from '../../components/ui/Button';
import { Card, CardTitle } from '../../components/ui/Card';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Select, TextInput, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { createCategory, defaultReassignTarget, deleteCategory, updateCategory } from '../../db/repo';
import { PALETTE } from '../../db/seed';
import type { Category, CategoryGroup, CategoryKind } from '../../lib/types';
import { useStore } from '../../state/data';
import { T } from '../../texts';

const c = T.categories;

const EMOJI_SUGGESTIONS = ['🏠', '🛒', '🚇', '🚗', '⛽', '📱', '💊', '📚', '🍔', '☕', '🍺', '🎉', '🛍️', '👕', '✈️', '🎮', '🎬', '🐶', '🎁', '💡', '🏋️', '💇', '👶', '🏷️', '💼', '💰', '📈', '🏦'];

/** Keeps the first emoji (grapheme) of whatever was typed or pasted. */
function firstGrapheme(text: string): string {
  const value = text.trim();
  if (!value) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segment = new Intl.Segmenter('ca', { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next().value;
    return segment?.segment ?? '';
  }
  return Array.from(value)[0] ?? '';
}

export function CategoriesPage() {
  const { categories } = useStore();
  const [editing, setEditing] = useState<Category | { kind: CategoryKind } | null>(null);

  return (
    <>
      <PageHeader
        title={c.title}
        back="/mes"
        action={
          <Button size="sm" onClick={() => setEditing({ kind: 'expense' })} data-testid="new-category">
            <Plus className="h-4 w-4" aria-hidden />
            {T.common.add}
          </Button>
        }
      />
      <div className="space-y-3">
        {(['expense', 'income'] as const).map((kind) => (
          <Card key={kind}>
            <CardTitle>{kind === 'expense' ? c.expenses : c.income}</CardTitle>
            <ul className="flex flex-wrap gap-2">
              {categories
                .filter((x) => x.kind === kind)
                .map((x) => (
                  <li key={x.id} className="min-w-0 max-w-full">
                    <button type="button" className={chipClass(false)} onClick={() => setEditing(x)} data-testid={`category-${x.name}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: x.color }} aria-hidden />
                      <span aria-hidden>{x.emoji}</span>
                      <span className="truncate">{x.name}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      {editing && <CategorySheet key={'id' in editing ? editing.id : 'new'} category={'id' in editing ? editing : null} initialKind={editing.kind} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategorySheet({ category, initialKind, onClose }: { category: Category | null; initialKind: CategoryKind; onClose: () => void }) {
  const { categories, transactions, rules } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[categories.length % PALETTE.length]);
  const [group, setGroup] = useState<CategoryGroup>(category?.group ?? 'altres');
  const [errors, setErrors] = useState<{ name?: string; emoji?: string }>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const nameId = useFieldId('cat-name');
  const emojiId = useFieldId('cat-emoji');
  const groupId = useFieldId('cat-group');

  const save = async () => {
    const next = { name: name.trim() ? undefined : T.validation.nameRequired, emoji: emoji ? undefined : T.validation.emojiRequired };
    setErrors(next);
    if (next.name || next.emoji) return;
    setBusy(true);
    if (category) await updateCategory(category.id, { name, emoji, color, group });
    else await createCategory({ name, emoji, color, kind, group: kind === 'expense' ? group : undefined });
    toast(c.saved);
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={category ? c.editTitle : c.newTitle}
        testId="category-sheet"
        footer={
          <div className="flex gap-3">
            {category && (
              <Button variant="secondary" block className="text-expense-ink" onClick={() => setConfirming(true)} data-testid="delete-category">
                {T.common.delete}
              </Button>
            )}
            <Button block onClick={save} disabled={busy} data-testid="save-category">
              {T.common.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-2">
          {!category && (
            <Field label={c.kind}>
              <Segmented
                label={c.kind}
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'expense', label: T.types.expense },
                  { value: 'income', label: T.types.income },
                ]}
              />
            </Field>
          )}
          <div className="flex gap-3">
            <Field label={c.emoji} htmlFor={emojiId} error={errors.emoji} className="w-24 shrink-0">
              <TextInput
                id={emojiId}
                value={emoji}
                onChange={(e) => setEmoji(firstGrapheme(e.target.value))}
                className="text-center text-[24px]"
                invalid={!!errors.emoji}
                autoComplete="off"
              />
            </Field>
            <Field label={c.name} htmlFor={nameId} error={errors.name} className="flex-1">
              <TextInput id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} invalid={!!errors.name} autoComplete="off" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label={c.emojiHint}>
            {EMOJI_SUGGESTIONS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px] active:bg-soft" aria-label={e}>
                {e}
              </button>
            ))}
          </div>
          {kind === 'expense' && (
            <Field label={c.group} htmlFor={groupId}>
              <Select id={groupId} value={group} onChange={(e) => setGroup(e.target.value as CategoryGroup)}>
                {(Object.keys(T.groups) as CategoryGroup[]).map((g) => (
                  <option key={g} value={g}>
                    {T.groups[g]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={c.color}>
            <ColorPicker value={color} onChange={setColor} label={c.color} />
          </Field>
        </div>
      </Sheet>
      {category && (
        <DeleteCategory
          open={confirming}
          category={category}
          categories={categories}
          usage={{
            movements: transactions.filter((t) => t.categoryId === category.id).length,
            rules: rules.filter((r) => r.categoryId === category.id).length,
          }}
          onClose={() => setConfirming(false)}
          onDeleted={() => {
            setConfirming(false);
            toast(c.deleted);
            onClose();
          }}
        />
      )}
    </>
  );
}

function DeleteCategory({
  open,
  category,
  categories,
  usage,
  onClose,
  onDeleted,
}: {
  open: boolean;
  category: Category;
  categories: Category[];
  usage: { movements: number; rules: number };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const others = useMemo(() => categories.filter((x) => x.kind === category.kind && x.id !== category.id), [categories, category]);
  const [target, setTarget] = useState(() => defaultReassignTarget(categories, category)?.id ?? '');
  const targetId = useFieldId('reassign');
  const used = usage.movements + usage.rules > 0;

  return (
    <ConfirmDialog
      open={open}
      title={c.deleteTitle(category.name)}
      confirmDisabled={others.length === 0 || (used && !target)}
      onClose={onClose}
      onConfirm={async () => {
        // A category without movements still needs a target for its budget entries: any of the same kind works.
        await deleteCategory(category.id, target || others[0].id);
        onDeleted();
      }}
      body={
        others.length === 0 ? (
          <p className="font-medium text-expense-ink">{c.lastOfKind}</p>
        ) : used ? (
          <div className="space-y-3">
            <p>{c.deleteUsage(usage.movements, usage.rules)}</p>
            <Field label={c.reassignTo} htmlFor={targetId}>
              <Select id={targetId} value={target} onChange={(e) => setTarget(e.target.value)} data-testid="reassign-select">
                {others.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.emoji} {x.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          c.deleteEmpty
        )
      }
    />
  );
}
