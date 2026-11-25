import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import { useCampaignStore } from './lib/store';
import { BestiaryPage } from './pages/BestiaryPage';
import { CharacterPage } from './pages/CharacterPage';
import { DmPage } from './pages/DmPage';
import { LoginPage } from './pages/LoginPage';
import { QuestsPage } from './pages/QuestsPage';
import { SpellsPage } from './pages/SpellsPage';
import { TalentsPage } from './pages/TalentsPage';

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
        <div className="glass-panel rounded-3xl p-8 text-center space-y-3 border border-rose-500/40 max-w-xl mx-auto my-8">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <div className="font-anime font-bold text-base">
            Ошибка отображения раздела
          </div>
          <p className="text-xs text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="anime-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Обновить панель</span>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-panel neon-border rounded-3xl px-8 py-6 text-center space-y-2">
          <div className="font-anime font-extrabold text-lg text-primary animate-pulse">
            FRAITH.SYSTEM
          </div>
          <div className="text-xs text-muted">Подключение к Cloudflare D1 &amp; Durable Objects...</div>
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

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        <PageErrorBoundary resetKey={`${activeTab}-${dmSelectedPlayerId}`}>
          {activeTab === 'character' && <CharacterPage />}
          {activeTab === 'quests' && <QuestsPage />}
          {activeTab === 'bestiary' && <BestiaryPage />}
          {activeTab === 'spells' && <SpellsPage />}
          {activeTab === 'talents' && <TalentsPage />}
          {activeTab === 'dm' && <DmPage />}
        </PageErrorBoundary>
      </main>

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto glass-panel rounded-2xl p-3.5 border flex items-start justify-between gap-3 shadow-neon ${
              t.variant === 'error'
                ? 'border-rose-500/60'
                : t.variant === 'success'
                  ? 'border-emerald-500/60'
                  : t.variant === 'warning'
                    ? 'border-amber-500/60'
                    : 'border-primary/60'
            }`}
          >
            <div className="min-w-0">
              <div className="font-anime font-bold text-xs">{t.title}</div>
              <div className="text-xs text-muted mt-0.5">{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-muted hover:text-text shrink-0"
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
