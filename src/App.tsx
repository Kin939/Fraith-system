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
        <div className="glass-panel hud-corners hud-cut p-8 text-center space-y-3 border border-rose-500/50 max-w-xl mx-auto my-8">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <div className="font-anime font-bold text-base uppercase tracking-wider">
            SYS.ERR // Ошибка отображения раздела
          </div>
          <p className="text-xs text-muted font-mono">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="anime-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Перезагрузить модуль</span>
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

  // Connect real-time CampaignRoom Durable Object WebSocket
  useWebSocket();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel neon-border hud-corners hud-cut px-8 py-6 text-left space-y-2 max-w-md w-full">
          <div className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">
            SYS.LINK // D1 + DURABLE OBJECTS
          </div>
          <div className="font-anime font-extrabold text-xl text-text tracking-widest">
            FRAITH<span className="text-primary">.SYSTEM</span>
          </div>
          <div className="text-xs text-muted">
            Синхронизация тактического канала кампании...
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

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-[1640px] w-full mx-auto">
        <PageErrorBoundary resetKey={`${activeTab}-${dmSelectedPlayerId}`}>
          <Suspense
            fallback={
              <div className="glass-panel hud-corners hud-cut p-8 text-center text-xs font-mono uppercase tracking-widest text-muted">
                LOADING MODULE // ПОДОЖДИТЕ...
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

      {/* Global Floating Rich Text Selection Toolbar for all textareas */}
      <SelectionFormatToolbar />

      {/* Real-time Tactical Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto glass-panel hud-corners hud-cut-sm p-3.5 border-l-2 flex items-start justify-between gap-3 ${
              t.variant === 'error'
                ? 'border-rose-500/70 border-l-rose-400'
                : t.variant === 'success'
                  ? 'border-emerald-500/70 border-l-emerald-400'
                  : t.variant === 'warning'
                    ? 'border-amber-500/70 border-l-amber-400'
                    : 'neon-border border-l-primary'
            }`}
          >
            <div className="min-w-0">
              <div className="font-anime font-bold text-xs uppercase tracking-wide">{t.title}</div>
              <div className="text-xs text-muted mt-0.5">{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-muted hover:text-primary transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
