import { expect, type Page } from '@playwright/test';

export const TODAY = '2026-10-09';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

/** "1.831,57 €" as rendered (non-breaking space, real minus sign). */
export function eur(text: string): string {
  return text.replace(/ /g, NBSP).replace(/^-/, MINUS);
}

/** Cents → "1.831,57 €" (same rules as the app, written independently). */
export function centsToEur(cents: number, signed = false): string {
  const abs = Math.abs(cents);
  const int = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = cents < 0 ? MINUS : signed && cents > 0 ? '+' : '';
  return `${sign}${int},${String(abs % 100).padStart(2, '0')}${NBSP}€`;
}

export async function start(page: Page) {
  // Fixed "now" so the flow (and the interest of finished months) is deterministic.
  await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00+02:00`));
  await page.goto('/');
}

export async function openNewMovement(page: Page) {
  await page.getByTestId('fab').click();
  await expect(page.getByTestId('movement-form')).toBeVisible();
}

export async function addMovement(
  page: Page,
  m: { type?: 'Despesa' | 'Ingrés' | 'Transferència'; amount: string; category?: string; account?: string; to?: string; date?: string; description?: string },
) {
  await openNewMovement(page);
  const form = page.getByTestId('movement-form');
  // The amount field is focused automatically: type straight away.
  await expect(form.getByLabel('Import', { exact: true })).toBeFocused();
  await page.keyboard.type(m.amount);
  if (m.type && m.type !== 'Despesa') await form.getByRole('radio', { name: m.type }).click();
  if (m.category) await form.getByTestId(`category-chip-${m.category}`).click();
  if (m.account) await form.getByTestId(`account-chip-${m.account}`).click();
  if (m.to) await form.getByTestId(`to-account-chip-${m.to}`).click();
  if (m.date) await form.getByTestId('movement-date').fill(m.date);
  if (m.description) await form.getByLabel('Descripció', { exact: true }).fill(m.description);
  await form.getByTestId('save-movement').click();
  await expect(page.getByTestId('movement-form')).toBeHidden();
}

export async function goTab(page: Page, name: 'Resum' | 'Moviments' | 'Anàlisi' | 'Patrimoni' | 'Més') {
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name }).click();
}

export async function goMore(page: Page, name: 'Pressupost' | 'Comptes' | 'Categories' | 'Recurrents' | 'Dades') {
  await goTab(page, 'Més');
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Reads all transactions straight from IndexedDB. */
export async function dbTransactions(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('finances');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise<Array<Record<string, unknown>>>((res) => {
      const r = db.transaction('transactions').objectStore('transactions').getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return rows;
  });
}

const FORBIDDEN = [
  // English
  'Dashboard', 'Settings', 'Income', 'Expense', 'Balance', 'Budget', 'Save', 'Cancel', 'Delete', 'Edit', 'Account', 'Category', 'Today', 'Yesterday', 'Loading', 'Monday', 'October', 'Total wealth',
  // Spanish
  'Gastos', 'Ingresos', 'Cuenta', 'Ahorro', 'Presupuesto', 'Movimientos', 'Añadir', 'Cerrar', 'Hoy', 'Ayer', 'Categoría', 'Lunes', 'Octubre de', 'Patrimonio', 'Configuración', 'Guardado',
];

/**
 * Layout guards for the current screen: no horizontal scroll, no amount cut, clipped or wrapped,
 * inputs ≥ 16 px, touch targets ≥ 44 px and no English/Spanish words.
 */
export async function checkScreen(page: Page, label: string) {
  const problems = await page.evaluate((forbidden) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontal scroll ${document.documentElement.scrollWidth} > ${vw}`);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
    };
    for (const el of document.querySelectorAll<HTMLElement>('.money')) {
      if (!visible(el) || el.classList.contains('invisible')) continue;
      const r = el.getBoundingClientRect();
      const text = el.textContent ?? '';
      if (r.right > vw + 1 || r.left < -1) out.push(`amount off screen: ${text}`);
      if (el.scrollWidth > el.clientWidth + 1) out.push(`amount clipped: ${text}`);
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      if (r.height > fontSize * 2.2) out.push(`amount wrapped: ${text}`);
    }
    for (const box of document.querySelectorAll<HTMLElement>('[data-fit]')) {
      if (!visible(box)) continue;
      const inner = box.lastElementChild as HTMLElement | null;
      if (inner && inner.getBoundingClientRect().width > box.clientWidth + 1) out.push(`fitted amount overflows: ${inner.textContent}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=file]), select, textarea')) {
      if (!visible(el) || el.tabIndex === -1) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 16) out.push(`input font < 16px: ${el.outerHTML.slice(0, 80)}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], [role="radio"]')) {
      if (!visible(el) || el.closest('.recharts-wrapper')) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 43.5) out.push(`touch target ${Math.round(r.width)}×${Math.round(r.height)}: ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}`);
    }
    const text = document.body.innerText;
    for (const word of forbidden) {
      // Whole words only ("Cancel" must not match "Cancel·lar").
      if (new RegExp(`(?<![\\p{L}·])${word}(?![\\p{L}·])`, 'u').test(text)) out.push(`non-Catalan text: ${word}`);
    }
    return out;
  }, FORBIDDEN);
  expect(problems, `${label}: ${problems.join(' | ')}`).toEqual([]);
}
