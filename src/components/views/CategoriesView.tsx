'use client';

import { ArchiveRestore, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { CategoryBadge, IconBadge, categoryIcon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDeleteCategory, useSaveCategory } from '@/hooks/api';
import { useLookups } from '@/hooks/useFormat';
import { ApiClientError } from '@/lib/api-client';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/categories';
import type { CategoryDTO, CategoryGroup, CategoryKind } from '@/lib/types';

type Editing = { open: false } | { open: true; category?: CategoryDTO; kind: CategoryKind; key: number };

export function CategoriesView() {
  const { t } = useI18n();
  const { categories, categoryLabel } = useLookups();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const save = useSaveCategory();
  const toast = useToast();
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const groups: { title: string; kind: CategoryKind; items: CategoryDTO[] }[] = [
    { title: t('categoryAdmin.expenseCategories'), kind: 'expense', items: active.filter((c) => c.kind === 'expense') },
    { title: t('categoryAdmin.incomeCategories'), kind: 'income', items: active.filter((c) => c.kind === 'income') },
  ];

  return (
    <>
      <PageHeader title={t('categoryAdmin.title')} backHref="/settings" showSettings={false} />
      <div className="mx-auto max-w-2xl">
        {groups.map((g) => (
          <div key={g.kind}>
            <SectionTitle
              action={
                <Button
                  variant="link"
                  size="sm"
                  icon={<Plus className="h-4 w-4" aria-hidden />}
                  onClick={() => setEditing({ open: true, kind: g.kind, key: Date.now() })}
                >
                  {t('common.add')}
                </Button>
              }
            >
              {g.title}
            </SectionTitle>
            <Card className="p-2 sm:p-2">
              <ul>
                {g.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ open: true, category: c, kind: c.kind, key: Date.now() })}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2"
                    >
                      <CategoryBadge category={c} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{categoryLabel(c)}</span>
                        <span className="block truncate text-[13px] text-ink-3">{t(`groups.${c.group}`)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
        {archived.length > 0 && (
          <>
            <SectionTitle>{t('categoryAdmin.archivedSection')}</SectionTitle>
            <Card className="p-2 sm:p-2">
              <ul>
                {archived.map((c) => (
                  <li key={c.id} className="flex min-h-14 items-center gap-3 px-2 py-2">
                    <CategoryBadge category={c} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink-2">{categoryLabel(c)}</span>
                    <Button
                      variant="soft"
                      size="sm"
                      icon={<ArchiveRestore className="h-4 w-4" aria-hidden />}
                      onClick={() => save.mutate({ id: c.id, payload: { archived: false } }, { onSuccess: () => toast.show(t('categoryAdmin.saved')) })}
                    >
                      {t('categoryAdmin.restore')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
      <CategorySheet
        key={editing.open ? editing.key : 'closed'}
        open={editing.open}
        category={editing.open ? editing.category : undefined}
        kind={editing.open ? editing.kind : 'expense'}
        onClose={() => setEditing({ open: false })}
      />
    </>
  );
}

function CategorySheet({ open, category, kind, onClose }: { open: boolean; category?: CategoryDTO; kind: CategoryKind; onClose: () => void }) {
  const { t, tDynamic } = useI18n();
  const { categoryLabel } = useLookups();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const editing = !!category;
  const [name, setName] = useState(category ? categoryLabel(category) : '');
  const [group, setGroup] = useState<CategoryGroup>(category?.group ?? (kind === 'income' ? 'income' : 'needs'));
  const [icon, setIcon] = useState(category?.icon ?? 'circle-ellipsis');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return setError('required');
    setError(null);
    // Keep built-in categories translated unless the user actually renamed them.
    const renamed = !category?.key || name.trim() !== categoryLabel({ ...category, name: null });
    const payload = { ...(renamed ? { name: name.trim() } : {}), group, icon, color };
    try {
      await save.mutateAsync({ id: category?.id, payload: editing ? payload : { ...payload, name: name.trim(), kind } });
      toast.show(t('categoryAdmin.saved'));
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields.name) setError(err.fields.name);
      setFormError(errorMessage(err));
    }
  }

  async function onDelete() {
    if (!category) return;
    try {
      const res = await remove.mutateAsync(category.id);
      toast.show(res.archived ? t('categoryAdmin.archivedResult') : t('categoryAdmin.deleted'));
      setConfirm(false);
      onClose();
    } catch (err) {
      setConfirm(false);
      setFormError(errorMessage(err));
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? t('categoryAdmin.edit') : t('categoryAdmin.add')}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="square" onClick={() => setConfirm(true)} aria-label={t('common.delete')}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <Button type="submit" form="category-form" className="flex-1" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <form id="category-form" onSubmit={submit} noValidate className="space-y-5 pt-1">
          <div className="flex items-center gap-3">
            <IconBadge icon={categoryIcon(icon)} color={color} size="lg" />
            <Field label={t('categoryAdmin.name')} error={error ? tDynamic(`errors.${error}`) : undefined} className="min-w-0 flex-1">
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('categoryAdmin.namePlaceholder')} autoComplete="off" />}
            </Field>
          </div>
          {kind === 'expense' && (
            <div>
              <p className="mb-2 px-1 text-sm font-medium text-ink-2">{t('categoryAdmin.group')}</p>
              <Segmented<CategoryGroup>
                label={t('categoryAdmin.group')}
                value={group}
                onChange={setGroup}
                options={(['needs', 'lifestyle', 'other'] as const).map((g) => ({ value: g, label: t(`groups.${g}`) }))}
              />
            </div>
          )}
          <fieldset>
            <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{t('categoryAdmin.icon')}</legend>
            <div className="grid grid-cols-6 gap-2 max-[359px]:grid-cols-5">
              {CATEGORY_ICONS.map((name) => {
                const Icon = categoryIcon(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    aria-pressed={icon === name}
                    aria-label={name}
                    className={cn('flex aspect-square min-h-11 items-center justify-center rounded-2xl border transition-colors', icon === name ? 'border-brand bg-brand-soft text-brand-ink' : 'border-transparent bg-surface-2 text-ink-2')}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{t('categoryAdmin.color')}</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={color === c}
                  aria-label={c}
                  className={cn('h-11 w-11 rounded-full border-4', color === c ? 'border-ink/80' : 'border-surface')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          {formError && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title={t('categoryAdmin.deleteConfirmTitle')}
        description={t('categoryAdmin.deleteConfirmText')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void onDelete()}
        loading={remove.isPending}
      />
    </>
  );
}
