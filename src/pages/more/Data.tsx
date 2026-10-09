import { Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardTitle } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Select, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';
import { runAutomation } from '../../db/automation';
import { exportBackup, markBackupDone, restoreBackup, wipeAll } from '../../db/repo';
import { validateBackup, type BackupFile } from '../../lib/backup';
import { buildCsv } from '../../lib/csv';
import { formatLongDate, formatMonthYear, monthOf, today as localToday } from '../../lib/dates';
import { shareOrDownload } from '../../lib/share';
import { useAppState } from '../../state/app';
import { useStore } from '../../state/data';
import { T } from '../../texts';
import { daysSinceBackup } from '../More';

const d = T.data;

type CsvRange = 'all' | 'year' | 'month';

export function DataPage() {
  const store = useStore();
  const { today } = useAppState();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const yearId = useFieldId('csv-year');
  const monthId = useFieldId('csv-month');

  const [range, setRange] = useState<CsvRange>('all');
  const years = useMemo(() => [...new Set([today.slice(0, 4), ...store.transactions.map((t) => t.date.slice(0, 4))])].sort().reverse(), [store.transactions, today]);
  const months = useMemo(() => [...new Set([monthOf(today), ...store.transactions.map((t) => monthOf(t.date))])].sort().reverse(), [store.transactions, today]);
  const [year, setYear] = useState(today.slice(0, 4));
  const [month, setMonth] = useState(monthOf(today));
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const days = daysSinceBackup(store.settings.lastBackupAt, today);

  const exportCsv = async () => {
    const txs = store.transactions.filter((t) => (range === 'all' ? true : range === 'year' ? t.date.startsWith(year) : monthOf(t.date) === month));
    if (txs.length === 0) {
      toast(d.csvEmpty, 'error');
      return;
    }
    const csv = buildCsv(txs, store.accounts, store.categories);
    const suffix = range === 'all' ? `tot-${today}` : range === 'year' ? year : month;
    const result = await shareOrDownload(csv, T.csv.fileName(suffix), 'text/csv;charset=utf-8', T.csv.shareTitle);
    if (result !== 'cancelled') toast(d.csvDone(txs.length));
  };

  const backup = async () => {
    const file = await exportBackup();
    const result = await shareOrDownload(JSON.stringify(file, null, 1), T.backup.fileName(today), 'application/json', d.backupTitle);
    if (result === 'cancelled') return;
    await markBackupDone();
    toast(d.backupDone);
  };

  const pickBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = validateBackup(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.reason);
      setPending(result.backup);
    } catch (e) {
      console.warn(e);
      toast(d.invalidBackup, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <>
      <PageHeader title={d.title} back="/mes" />
      <div className="space-y-3">
        <Card className="flex gap-3">
          <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 space-y-2 text-[14px] leading-relaxed text-ink-2">
            <p>{d.localInfo}</p>
            {persisted !== null && (
              <p className={persisted ? 'flex items-center gap-1.5 font-medium text-income-ink' : 'font-medium text-warning-ink'}>
                {persisted && <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />}
                {persisted ? d.persistent : d.notPersistent}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle subtitle={d.backupBody}>{d.backupTitle}</CardTitle>
          <p className="mb-3 text-[14px] font-medium text-ink-2" data-testid="last-backup">
            {d.lastBackup(days === null ? d.never : d.ago(days))}
          </p>
          <div className="space-y-2.5">
            <Button block onClick={backup} data-testid="backup-export">
              <Download className="h-5 w-5" aria-hidden />
              {d.backupExport}
            </Button>
            <Button variant="outline" block onClick={() => fileInput.current?.click()}>
              <Upload className="h-5 w-5" aria-hidden />
              {d.backupImport}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="backup-file"
              onChange={(e) => void pickBackup(e.target.files?.[0])}
            />
          </div>
        </Card>

        <Card>
          <CardTitle subtitle={d.csvBody}>{d.csvTitle}</CardTitle>
          <div className="space-y-3">
            <Segmented
              label={d.csvRange}
              value={range}
              onChange={setRange}
              size="sm"
              options={[
                { value: 'all', label: d.csvAll },
                { value: 'year', label: d.csvYear },
                { value: 'month', label: d.csvMonth },
              ]}
            />
            {range === 'year' && (
              <Field label={d.csvYear} htmlFor={yearId}>
                <Select id={yearId} value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {range === 'month' && (
              <Field label={d.csvMonth} htmlFor={monthId}>
                <Select id={monthId} value={month} onChange={(e) => setMonth(e.target.value)}>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthYear(m)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button variant="outline" block onClick={exportCsv} data-testid="csv-export">
              <Download className="h-5 w-5" aria-hidden />
              {d.csvExport}
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle subtitle={d.wipeBody}>{d.wipeTitle}</CardTitle>
          <Button variant="secondary" block className="text-expense-ink" onClick={() => setWipeStep(1)} data-testid="wipe">
            {d.wipeTitle}
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={d.restoreTitle}
        danger={false}
        confirmLabel={d.restoreConfirm}
        body={pending ? d.restoreBody(formatLongDate(localToday(new Date(pending.exportedAt))), store.transactions.length, pending.data.transactions.length) : ''}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await restoreBackup(pending);
          // Catch up recurring movements and interest due since the backup was made.
          await runAutomation(today);
          setPending(null);
          toast(d.restored);
          navigate('/', { replace: true });
        }}
      />
      <ConfirmDialog
        open={wipeStep === 1}
        title={d.wipeConfirm1Title}
        body={d.wipeConfirm1Body}
        confirmLabel={T.common.continue}
        onClose={() => setWipeStep(0)}
        onConfirm={() => setWipeStep(2)}
      />
      <ConfirmDialog
        open={wipeStep === 2}
        title={d.wipeConfirm2Title}
        body={d.wipeConfirm2Body}
        confirmLabel={d.wipeConfirm2Action}
        onClose={() => setWipeStep(0)}
        onConfirm={async () => {
          await wipeAll();
          setWipeStep(0);
          navigate('/', { replace: true });
        }}
      />
    </>
  );
}
