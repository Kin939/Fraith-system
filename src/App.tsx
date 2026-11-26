import React, { Suspense, lazy, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { SelectionFormatToolbar } from './components/common/SelectionFormatToolbar';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
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
const ConnectionsPage = lazy(() =>
  import('./pages/ConnectionsPage').then((m) => ({ default: m.ConnectionsPage }))
);
const MessengerPage = lazy(() =>
  import('./pages/MessengerPage').then((m) => ({ default: m.MessengerPage }))
);
const BoardPage = lazy(() =>
  import('./pages/BoardPage').then((m) => ({ default: m.BoardPage }))
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

  /** Сворачивание левого меню: «язычок» на середине его правого края. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarEdgeHover, setSidebarEdgeHover] = useState(false);
  const sidebarVisible = !sidebarCollapsed;

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
      <div
        className="hidden lg:block shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: sidebarCollapsed ? 0 : 256 }}
      >
        <Sidebar onLogout={logout} />
      </div>

      {/* Зона наведения у левого края — проявляет «язычок» свёрнутого меню */}
      {sidebarCollapsed && (
        <div
          className="hidden lg:block fixed inset-y-0 left-0 z-40 w-3"
          onPointerEnter={() => setSidebarEdgeHover(true)}
          onPointerLeave={() => setSidebarEdgeHover(false)}
        />
      )}

      <button
        type="button"
        onClick={() => {
          setSidebarCollapsed((prev) => !prev);
          setSidebarEdgeHover(false);
        }}
        onPointerEnter={() => setSidebarEdgeHover(true)}
        className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 h-24 w-5 items-center justify-center border border-border bg-deep/95 text-muted hover:text-primary hover:border-primary/60 transition-all duration-300 ${
          sidebarVisible || sidebarEdgeHover ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ left: sidebarCollapsed ? 4 : 256 }}
        title={sidebarCollapsed ? 'Показать меню' : 'Свернуть меню'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
      </button>

      <TabBar onLogout={logout} />

      <main
        className={
          activeTab === 'board'
            ? 'flex-1 min-w-0 w-full p-0 max-w-none'
            : 'flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1520px] w-full mx-auto'
        }
      >
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
            {activeTab === 'connections' && <ConnectionsPage />}
            {activeTab === 'talents' && <TalentsPage />}
            {activeTab === 'chat' && <MessengerPage />}
            {activeTab === 'board' && <BoardPage />}
            {activeTab === 'dm' && <DmPage />}
          </Suspense>
        </PageErrorBoundary>
      </main>

      <SelectionFormatToolbar />
      <UpdatePrompt />

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
