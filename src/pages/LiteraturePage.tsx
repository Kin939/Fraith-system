import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { VisibilityPicker } from '../components/common/VisibilityPicker';
import { LiteratureViewer } from '../components/literature/LiteratureViewer';
import {
  deleteLiteratureFile,
  fetchLiterature,
  fetchPartyPlayers,
  literatureFileUrl,
  patchLiteratureFile,
  uploadLiteratureFile,
} from '../lib/api';
import { useCampaignStore } from '../lib/store';
import type { LiteratureFile, LiteratureKind, PartyPlayerSummary } from '../lib/types';

type KindFilter = 'all' | 'pdf' | 'word' | 'text' | 'image';

const KIND_ICON: Record<LiteratureKind, React.ReactNode> = {
  pdf: <FileText className="w-5 h-5" strokeWidth={1.5} />,
  docx: <FileText className="w-5 h-5" strokeWidth={1.5} />,
  doc: <FileText className="w-5 h-5" strokeWidth={1.5} />,
  text: <FileText className="w-5 h-5" strokeWidth={1.5} />,
  image: <ImageIcon className="w-5 h-5" strokeWidth={1.5} />,
  other: <BookOpen className="w-5 h-5" strokeWidth={1.5} />,
};

const KIND_LABEL: Record<LiteratureKind, string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  text: 'Текст',
  image: 'Картинка',
  other: 'Файл',
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function matchesFilter(file: LiteratureFile, filter: KindFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'word') return file.kind === 'docx' || file.kind === 'doc';
  return file.kind === filter;
}

export const LiteraturePage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const isDm = user?.role === 'dm';

  const [files, setFiles] = useState<LiteratureFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PartyPlayerSummary[]>([]);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [viewerFile, setViewerFile] = useState<LiteratureFile | null>(null);
  const [editingFile, setEditingFile] = useState<LiteratureFile | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Форма загрузки
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchLiterature();
        setFiles(res.files);
      } catch (err) {
        pushToast({
          title: 'Не удалось загрузить литературу',
          message: err instanceof Error ? err.message : 'Попробуйте обновить страницу',
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isDm) return;
    void fetchPartyPlayers()
      .then(setPlayers)
      .catch(() => undefined);
  }, [isDm]);

  // Живое обновление: сервер шлёт literature:updated при загрузке/правках/удалении.
  useEffect(() => {
    const handler = () => {
      void load(true);
    };
    window.addEventListener('fraith:literature-updated', handler);
    return () => window.removeEventListener('fraith:literature-updated', handler);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((file) => {
      if (!matchesFilter(file, kindFilter)) return false;
      if (!q) return true;
      return [file.title, file.description, file.fileName]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [files, query, kindFilter]);

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadVisibility([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile) {
      pushToast({
        title: 'Выберите файл',
        message: 'PDF, Word, TXT, PNG или другой файл кампании',
        variant: 'warning',
      });
      return;
    }
    setUploading(true);
    try {
      await uploadLiteratureFile(uploadFile, {
        title: uploadTitle.trim() || uploadFile.name,
        description: uploadDesc.trim(),
        visibleUserIds: uploadVisibility,
      });
      pushToast({
        title: 'Файл добавлен в литературу',
        message:
          uploadVisibility.length === 0
            ? 'Виден всей партии'
            : `Виден ${uploadVisibility.length} игрок(ам)`,
        variant: 'success',
      });
      resetUploadForm();
      await load(true);
    } catch (err) {
      pushToast({
        title: 'Не удалось загрузить файл',
        message: err instanceof Error ? err.message : 'Проверьте размер и формат',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveVisibility = async (
    file: LiteratureFile,
    patch: { title: string; description: string; visibleUserIds: number[] }
  ) => {
    try {
      const updated = await patchLiteratureFile(file.id, patch);
      setFiles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingFile(null);
      pushToast({
        title: 'Файл обновлён',
        message:
          updated.visibleUserIds.length === 0
            ? 'Теперь виден всей партии'
            : `Виден ${updated.visibleUserIds.length} игрок(ам)`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось сохранить',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (file: LiteratureFile) => {
    setPendingDeleteId(file.id);
    try {
      await deleteLiteratureFile(file.id);
      setFiles((prev) => prev.filter((item) => item.id !== file.id));
      if (viewerFile?.id === file.id) setViewerFile(null);
      if (editingFile?.id === file.id) setEditingFile(null);
      pushToast({ title: 'Файл удалён', message: file.title, variant: 'info' });
    } catch (err) {
      pushToast({
        title: 'Не удалось удалить файл',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const personalCount = files.filter((file) => file.visibleUserIds.length > 0).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium text-text inline-flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" strokeWidth={1.5} /> Литература кампании
          </h2>
          <p className="text-xs text-muted mt-1">
            {isDm
              ? 'Загружайте PDF, Word, текст и картинки — игроки читают их прямо в приложении.'
              : 'Документы, которые мастер открыл партии. Нажмите на файл, чтобы прочитать.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
          <span className="px-2 py-1 border border-border">
            файлов: {files.length}
          </span>
          {isDm && personalCount > 0 && (
            <span className="px-2 py-1 border border-primary/40 text-primary inline-flex items-center gap-1">
              <EyeOff className="w-3 h-3" strokeWidth={1.75} /> личных: {personalCount}
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию и файлу…"
                className="anime-input w-full h-9 pl-8 text-sm"
              />
            </div>
            <div className="inline-flex items-center bg-surface border border-border p-0.5 gap-0.5">
              {(
                [
                  ['all', 'Все'],
                  ['pdf', 'PDF'],
                  ['word', 'Word'],
                  ['text', 'Текст'],
                  ['image', 'Картинки'],
                ] as Array<[KindFilter, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKindFilter(value)}
                  className={`h-8 px-2.5 text-[11px] transition-colors ${
                    kindFilter === value
                      ? 'bg-raised text-text font-medium'
                      : 'text-secondary hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="glass-panel hud-cut p-10 text-center text-sm text-muted inline-flex w-full items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> Загружаем литературу…
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-panel hud-cut p-10 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-muted mx-auto" strokeWidth={1.25} />
              <p className="text-sm text-secondary">
                {files.length === 0
                  ? isDm
                    ? 'Пока пусто. Загрузите первый PDF, документ Word или картинку.'
                    : 'Мастер ещё не открыл ни одного файла.'
                  : 'Ничего не найдено по этому запросу.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((file) => (
                <LiteratureCard
                  key={file.id}
                  file={file}
                  isDm={Boolean(isDm)}
                  deleting={pendingDeleteId === file.id}
                  onOpen={() => setViewerFile(file)}
                  onEdit={() => setEditingFile(file)}
                  onDelete={() => void handleDelete(file)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="xl:col-span-4 xl:sticky xl:top-6 self-start space-y-4">
          {isDm ? (
            <form onSubmit={handleUpload} className="glass-panel hud-cut p-5 space-y-3">
              <h3 className="text-sm font-medium text-text inline-flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" strokeWidth={1.5} /> Добавить файл
              </h3>

              <label
                className={`flex flex-col items-center justify-center gap-1.5 border border-dashed border-border px-3 py-6 text-center cursor-pointer transition-colors hover:border-primary/50 ${
                  uploading ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <Upload className="w-5 h-5 text-muted" strokeWidth={1.5} />
                <span className="text-xs text-secondary">
                  {uploadFile ? uploadFile.name : 'PDF, DOCX, TXT, PNG — до 25 МБ'}
                </span>
                {uploadFile && (
                  <span className="text-[11px] text-muted font-mono">
                    {formatSize(uploadFile.size)}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setUploadFile(file);
                    if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
                  }}
                />
              </label>

              <div>
                <label className="block text-xs text-secondary mb-1.5">Название</label>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Как файл увидит партия"
                  className="anime-input w-full h-9 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1.5">Описание (необязательно)</label>
                <textarea
                  rows={2}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Пара слов о содержании"
                  className="anime-input w-full text-sm"
                />
              </div>

              <VisibilityPicker
                players={players}
                value={uploadVisibility}
                onChange={setUploadVisibility}
                label="Кому виден файл"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetUploadForm}
                  disabled={uploading || (!uploadFile && !uploadTitle)}
                  className="hud-btn-secondary h-9 px-3 text-xs disabled:opacity-40"
                >
                  Сбросить
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Upload className="w-4 h-4" strokeWidth={1.5} />
                  )}
                  <span>{uploading ? 'Загрузка…' : 'Добавить в литературу'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="glass-panel hud-cut p-5 space-y-2">
              <h3 className="text-sm font-medium text-text inline-flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" strokeWidth={1.5} /> Как это работает
              </h3>
              <p className="text-xs text-secondary leading-relaxed">
                Мастер открывает партии книги, карты, письма и изображения. PDF и Word читаются
                прямо здесь, картинки и текст раскрываются на весь экран. Файлы, скрытые от вас,
                здесь не появятся.
              </p>
            </div>
          )}

          {isDm && players.length > 0 && (
            <div className="glass-panel hud-cut p-5 space-y-2">
              <h3 className="text-sm font-medium text-text inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" strokeWidth={1.5} /> Партия
              </h3>
              <ul className="space-y-1.5">
                {players.map((player) => {
                  const visibleCount = files.filter(
                    (file) =>
                      file.visibleUserIds.length === 0 ||
                      file.visibleUserIds.includes(player.userId)
                  ).length;
                  return (
                    <li
                      key={player.userId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-secondary">
                        {player.characterName || player.displayName}
                      </span>
                      <span className="font-mono text-[11px] text-muted tabular-nums shrink-0">
                        {visibleCount}/{files.length}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {viewerFile && (
        <LiteratureViewer file={viewerFile} onClose={() => setViewerFile(null)} />
      )}

      {editingFile && (
        <VisibilityEditorModal
          file={editingFile}
          players={players}
          onClose={() => setEditingFile(null)}
          onSave={(patch) => void handleSaveVisibility(editingFile, patch)}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */

const LiteratureCard: React.FC<{
  file: LiteratureFile;
  isDm: boolean;
  deleting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ file, isDm, deleting, onOpen, onEdit, onDelete }) => {
  const personal = file.visibleUserIds.length > 0;
  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group glass-panel hud-cut p-4 cursor-pointer transition-colors hover:border-primary/50 focus:outline-none focus-visible:border-primary"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 border border-border bg-bg inline-flex items-center justify-center text-primary">
          {KIND_ICON[file.kind]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-text leading-snug line-clamp-2">
              {file.title}
            </h3>
            {isDm && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1.5 text-muted hover:text-text transition-colors"
                  title="Изменить название и видимость"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 text-muted hover:text-negative transition-colors disabled:opacity-40"
                  title="Удалить файл"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            )}
          </div>

          {file.description && (
            <p className="mt-1 text-xs text-secondary leading-snug line-clamp-2">
              {file.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-muted">
            <span className="border border-border px-1.5 py-0.5 uppercase tracking-wide text-secondary">
              {KIND_LABEL[file.kind]}
            </span>
            <span className="tabular-nums">{formatSize(file.fileSize)}</span>
            <span className="text-border">·</span>
            <span className="truncate max-w-[9rem]" title={file.fileName}>
              {file.fileName}
            </span>
            {isDm && personal && (
              <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary inline-flex items-center gap-1">
                <EyeOff className="w-3 h-3" strokeWidth={1.75} />
                {file.visibleUserIds.length} игрок(ам)
              </span>
            )}
            {isDm && !personal && (
              <span className="border border-border px-1.5 py-0.5 inline-flex items-center gap-1">
                <Users className="w-3 h-3" strokeWidth={1.75} /> вся партия
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <span className="inline-flex items-center gap-1 text-secondary group-hover:text-primary transition-colors">
          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> Открыть
        </span>
        <a
          href={literatureFileUrl(file.id, true)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 hover:text-text transition-colors"
          title="Скачать файл"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.75} /> скачать
        </a>
      </div>
    </article>
  );
};

const VisibilityEditorModal: React.FC<{
  file: LiteratureFile;
  players: PartyPlayerSummary[];
  onClose: () => void;
  onSave: (patch: { title: string; description: string; visibleUserIds: number[] }) => void;
}> = ({ file, players, onClose, onSave }) => {
  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description);
  const [visibleUserIds, setVisibleUserIds] = useState<number[]>(file.visibleUserIds);

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4">
      <div className="glass-panel hud-cut w-full max-w-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text">Настройки файла</h3>
            <p className="text-[11px] text-muted font-mono truncate max-w-[22rem]">
              {file.fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-text transition-colors"
            title="Закрыть"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Название</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="anime-input w-full h-9 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Описание</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="anime-input w-full text-sm"
          />
        </div>

        <VisibilityPicker
          players={players}
          value={visibleUserIds}
          onChange={setVisibleUserIds}
          label="Кому виден файл"
        />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="hud-btn-secondary h-9 px-3 text-xs">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave({ title: title.trim() || file.title, description, visibleUserIds })}
            className="anime-btn-primary h-9 px-4 text-xs"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
