import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/ui/Toast';
import { runAutomation } from './db/automation';
import { ensureSeed } from './db/repo';
import { today } from './lib/dates';
import { AnalysisPage } from './pages/Analysis';
import { DashboardPage } from './pages/Dashboard';
import { AccountsPage } from './pages/more/Accounts';
import { BudgetPage } from './pages/more/Budget';
import { CategoriesPage } from './pages/more/Categories';
import { DataPage } from './pages/more/Data';
import { RecurringPage } from './pages/more/Recurring';
import { MorePage } from './pages/More';
import { MovementsPage } from './pages/Movements';
import { OnboardingPage } from './pages/Onboarding';
import { WealthPage } from './pages/Wealth';
import { requestPersistentStorage } from './pwa';
import { AppStateProvider } from './state/app';
import { DataProvider, useStore } from './state/data';
import { T } from './texts';

export function App() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      void requestPersistentStorage();
      await ensureSeed();
      // Pending recurring movements and finished months' interest, as if a server had kept working.
      await runAutomation(today());
      if (!cancelled) setReady(true);
    })().catch((e) => {
      console.error(e);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <Splash text={T.common.error} />;
  if (!ready) return <Splash />;

  return (
    <BrowserRouter>
      <AppStateProvider>
        <ToastProvider>
          <DataProvider fallback={<Splash />}>
            <Root />
          </DataProvider>
        </ToastProvider>
      </AppStateProvider>
    </BrowserRouter>
  );
}

function Root() {
  const { settings } = useStore();
  if (!settings.onboardingDone) return <OnboardingPage />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="moviments" element={<MovementsPage />} />
        <Route path="analisi" element={<AnalysisPage />} />
        <Route path="patrimoni" element={<WealthPage />} />
        <Route path="mes" element={<MorePage />} />
        <Route path="mes/pressupost" element={<BudgetPage />} />
        <Route path="mes/comptes" element={<AccountsPage />} />
        <Route path="mes/categories" element={<CategoriesPage />} />
        <Route path="mes/recurrents" element={<RecurringPage />} />
        <Route path="mes/dades" element={<DataPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Splash({ text }: { text?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-6 text-center text-[15px] text-ink-3" aria-busy={!text}>
      {text ?? <span className="sr-only">{T.common.loading}</span>}
    </div>
  );
}
