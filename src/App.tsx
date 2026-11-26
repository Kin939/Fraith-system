import React, { Suspense, lazy } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { SelectionFormatToolbar } from './components/common/SelectionFormatToolbar';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import { useCampaignStore } from './lib/store';
import { LoginPage } from './pages/LoginPage';

const CharacterPage = lazy(() =>
  import('./pages/CharacterPage').then((m) => ({ default: m.CharacterPage }))
);
const QuestsPage = lazy(() =>
  import('./pages/QuestsPage').then((m) => ({ default: m.QuestsPage }))
);
const BestiaryPage = lazy(() =>
  import('./pages/BestiaryPage').then((m) => ({ default: m.BestiaryPage }))
);
const SpellsPage = lazy(() =>
  import('./pages/SpellsPage').then((m) => ({ default: m.SpellsPage }))
);
const TalentsPage = lazy(() =>
  import('./pages/TalentsPage').then((m) => ({ default: m.TalentsPage }))
);
const DmPage = lazy(() =>
  import('./pages/DmPage').then((m) => ({ default: m.DmPage }))
);

class PageErrorBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass-panel hud-cut p-8 text-center space-y-3 border border-negative/40 max-w-xl mx-auto my-8">
          <AlertTriangle className="w-5 h-5 text-negative mx-auto" strokeWidth={1.5} />
          <div className="font-medium text-base text-text">
            Не удалось отобразить раздел
          </div>
          <p className="text-xs text-muted font-mono">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="anime-btn-primary px-4 py-2 text-xs inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            <span>Повторить</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const { user, authReady, loading, authError, login, logout } = useAuth();
  const activeTab = useCampaignStore((s) => s.activeTab);
  const dmSelectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const toasts = useCampaignStore((s) => s.toasts);
  const dismissToast = useCampaignStore((s) => s.dismissToast);

  useWebSocket();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel hud-cut p-6 text-left space-y-2 max-w-sm w-full">
          <div className="font-medium text-lg text-text">Fraith</div>
          <div className="text-sm text-secondary">
            Подключение к столу кампании…
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} loading={loading} error={authError} />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <Sidebar onLogout={logout} />
      <TabBar onLogout={logout} />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1520px] w-full mx-auto">
        <PageErrorBoundary resetKey={`${activeTab}-${dmSelectedPlayerId}`}>
          <Suspense
            fallback={
              <div className="glass-panel hud-cut p-8 text-center text-sm text-muted">
                Загрузка раздела…
              </div>
            }
          >
            {activeTab === 'character' && <CharacterPage />}
            {activeTab === 'quests' && <QuestsPage />}
            {activeTab === 'bestiary' && <BestiaryPage />}
            {activeTab === 'spells' && <SpellsPage />}
            {activeTab === 'talents' && <TalentsPage />}
            {activeTab === 'dm' && <DmPage />}
          </Suspense>
        </PageErrorBoundary>
      </main>

      <SelectionFormatToolbar />

      {/* Quiet Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto bg-raised hud-cut-sm p-4 border border-border border-l-2 shadow-glass flex items-start justify-between gap-3 ${
              t.variant === 'error'
                ? 'border-l-negative'
                : t.variant === 'success'
                  ? 'border-l-positive'
                  : t.variant === 'warning'
                    ? 'border-l-warning'
                    : 'border-l-primary'
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-sm text-text">{t.title}</div>
              <div className="text-xs text-secondary mt-1">{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-muted hover:text-text transition-colors shrink-0 p-0.5"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
