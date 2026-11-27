import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';
import { literatureFileUrl } from '../../lib/api';
import type { LiteratureFile } from '../../lib/types';

interface LiteratureViewerProps {
  file: LiteratureFile;
  onClose: () => void;
}

/** Оставляем только безопасную разметку из DOCX (никаких скриптов и on*). */
function sanitizeDocxHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, style, base, meta').forEach((node) => {
    node.remove();
  });
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/**
 * Полноэкранное чтение файла литературы.
 * PDF и картинки открываются как есть, DOCX конвертируется mammoth прямо в браузере,
 * TXT/MD читается текстом — без скачивания файла на компьютер.
 */
export const LiteratureViewer: React.FC<LiteratureViewerProps> = ({ file, onClose }) => {
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [textBody, setTextBody] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const url = useMemo(() => literatureFileUrl(file.id), [file.id]);
  const downloadUrl = useMemo(() => literatureFileUrl(file.id, true), [file.id]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleKeyDown]);

  useEffect(() => {
    setDocxHtml(null);
    setDocxError(null);
    setTextBody(null);
    setTextError(null);
    setImgFailed(false);

    if (file.kind !== 'docx' && file.kind !== 'text') return;
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Не удалось открыть файл (${res.status})`);

        if (file.kind === 'text') {
          const raw = await res.text();
          if (!cancelled) setTextBody(raw);
          return;
        }

        const buffer = await res.arrayBuffer();
        // mammoth грузим лениво: он нужен только для Word и весит много.
        const mammothModule = await import('mammoth/mammoth.browser.js');
        const mammoth = (mammothModule as unknown as { default?: unknown }).default ?? mammothModule;
        const convert = (mammoth as { convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> })
          .convertToHtml;
        const result = await convert({ arrayBuffer: buffer });
        if (!cancelled) setDocxHtml(sanitizeDocxHtml(result.value));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось прочитать файл';
        if (!cancelled) {
          if (file.kind === 'text') setTextError(message);
          else setDocxError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [file.id, file.kind, url]);

  const kindLabel =
    file.kind === 'pdf'
      ? 'PDF'
      : file.kind === 'docx' || file.kind === 'doc'
        ? 'Word'
        : file.kind === 'image'
          ? 'Изображение'
          : file.kind === 'text'
            ? 'Текст'
            : file.fileExt.toUpperCase() || 'Файл';

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#05070b]/97 backdrop-blur-sm">
      <header className="flex items-center gap-3 border-b border-border bg-deep/90 px-3 sm:px-5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
              {kindLabel}
            </span>
            <h3 className="truncate text-sm sm:text-base font-medium text-text" title={file.title}>
              {file.title}
            </h3>
          </div>
          <div className="truncate text-[11px] text-muted font-mono">
            {file.fileName}
            {file.description ? ` · ${file.description}` : ''}
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-xs text-secondary hover:text-text hover:border-primary/50 transition-colors"
          title="Открыть в новой вкладке"
        >
          <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">В новой вкладке</span>
        </a>
        <a
          href={downloadUrl}
          className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-xs text-secondary hover:text-text hover:border-primary/50 transition-colors"
          title="Скачать файл"
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Скачать</span>
        </a>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="h-9 w-9 inline-flex items-center justify-center border border-border text-secondary hover:text-text hover:border-negative/60 transition-colors"
          title="Закрыть (Esc)"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="relative flex-1 min-h-0 overflow-auto">
        {file.kind === 'pdf' && (
          <iframe
            src={`${url}#view=FitH`}
            title={file.title}
            className="h-full w-full border-0 bg-white"
          />
        )}

        {file.kind === 'image' && (
          <div className="flex h-full w-full items-center justify-center p-3 sm:p-6">
            {imgFailed ? (
              <ViewerFallback
                message="Браузер не смог показать это изображение — скачайте файл."
                downloadUrl={downloadUrl}
                openUrl={url}
              />
            ) : (
              <img
                src={url}
                alt={file.title}
                onError={() => setImgFailed(true)}
                className="max-h-full max-w-full object-contain shadow-[0_0_60px_-20px_rgba(0,229,255,0.45)]"
              />
            )}
          </div>
        )}

        {file.kind === 'docx' && (
          <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
            <div className="bg-[#f7f7f2] text-[#16181d] shadow-2xl">
              {loading && <ViewerStatus icon="loading" text="Читаем документ Word…" />}
              {docxError && (
                <ViewerFallback message={docxError} downloadUrl={downloadUrl} openUrl={url} dark />
              )}
              {docxHtml && (
                <div
                  className="literature-docx px-5 py-6 sm:px-10 sm:py-10"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
              {!loading && !docxError && !docxHtml && (
                <ViewerStatus icon="file" text="Документ пуст" />
              )}
            </div>
          </div>
        )}

        {file.kind === 'doc' && (
          <div className="flex h-full items-center justify-center p-6">
            <ViewerFallback
              message="Старый формат .doc нельзя прочитать в браузере. Скачайте файл или пересохраните его как .docx."
              downloadUrl={downloadUrl}
              openUrl={url}
            />
          </div>
        )}

        {file.kind === 'text' && (
          <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
            <div className="glass-panel hud-cut p-4 sm:p-6">
              {loading && <ViewerStatus icon="loading" text="Читаем текст…" />}
              {textError && <ViewerFallback message={textError} downloadUrl={downloadUrl} openUrl={url} dark />}
              {textBody !== null && (
                <pre className="literature-text whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
                  {textBody}
                </pre>
              )}
            </div>
          </div>
        )}

        {file.kind === 'other' && (
          <div className="flex h-full items-center justify-center p-6">
            <ViewerFallback
              message={`Файл .${file.fileExt || 'bin'} нельзя открыть прямо в приложении.`}
              downloadUrl={downloadUrl}
              openUrl={url}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ViewerStatus: React.FC<{ icon: 'loading' | 'file'; text: string }> = ({ icon, text }) => (
  <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-secondary">
    {icon === 'loading' ? (
      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
    ) : (
      <FileText className="w-4 h-4" strokeWidth={1.5} />
    )}
    <span>{text}</span>
  </div>
);

const ViewerFallback: React.FC<{
  message: string;
  downloadUrl: string;
  openUrl: string;
  dark?: boolean;
}> = ({ message, downloadUrl, openUrl, dark = false }) => (
  <div
    className={`mx-auto max-w-md border p-6 text-center space-y-3 ${
      dark ? 'border-[#16181d]/20 bg-transparent text-[#16181d]' : 'glass-panel hud-cut border-border text-text'
    }`}
  >
    <AlertTriangle className="mx-auto w-6 h-6" strokeWidth={1.5} />
    <p className="text-sm leading-relaxed">{message}</p>
    <div className="flex items-center justify-center gap-2">
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="h-9 px-3 inline-flex items-center gap-1.5 border border-current/40 text-xs hover:opacity-80"
      >
        <ImageIcon className="w-4 h-4" strokeWidth={1.5} /> Открыть
      </a>
      <a
        href={downloadUrl}
        className="h-9 px-3 inline-flex items-center gap-1.5 border border-current/40 text-xs hover:opacity-80"
      >
        <Download className="w-4 h-4" strokeWidth={1.5} /> Скачать
      </a>
    </div>
  </div>
);
