import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Images, Loader2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { BestiaryCreature, BestiaryCreatureDetail } from '../../lib/types';
import { EntityNotes } from '../common/EntityNotes';
import { FormattedText } from '../common/FormattedText';
import { getCrRimColor } from './BestiaryTile';
import { DndsuImage } from './DndsuImage';
import { MonsterArt } from './MonsterArt';

interface BestiaryDetailProps {
  creature: BestiaryCreature | null;
  isDm?: boolean;
  onClose: () => void;
  onToggleReveal?: (creature: BestiaryCreature) => void;
}

export const BestiaryDetail: React.FC<BestiaryDetailProps> = ({
  creature,
  isDm = false,
  onClose,
  onToggleReveal,
}) => {
  const [detail, setDetail] = useState<BestiaryCreatureDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const pushToast = useCampaignStore((s) => s.pushToast);

  useEffect(() => {
    if (!creature) {
      setDetail(null);
      setLightbox(null);
      return;
    }
    let cancelled = false;
    setLightbox(null);
    setRevealed(creature.isRevealed);
    setLoading(true);
    setDetail(null);
    apiFetch<{ creature: BestiaryCreatureDetail }>(`/api/bestiary/${creature.id}`)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.creature);
        setRevealed(res.creature.isRevealed);
      })
      .catch((err) => {
        if (cancelled) return;
        pushToast({
          title: 'Не удалось открыть запись',
          message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
          variant: 'error',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creature, pushToast]);

  const gallery = detail?.gallery ?? [];
  const galleryCount = gallery.length;

  useEffect(() => {
    if (lightbox === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowRight' && galleryCount > 1) {
        setLightbox((prev) => (prev === null ? prev : (prev + 1) % galleryCount));
      }
      if (event.key === 'ArrowLeft' && galleryCount > 1) {
        setLightbox((prev) => (prev === null ? prev : (prev - 1 + galleryCount) % galleryCount));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox, galleryCount]);

  if (!creature) return null;

  const view = detail ?? creature;
  const crColor = getCrRimColor(view.crNumeric);
  const typeLine = [view.size, view.creatureType, view.alignment].filter(Boolean).join(', ');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 flex items-start justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel hud-cut max-w-3xl w-full my-6 overflow-hidden shadow-glass"
      >
        <div className="relative h-48 bg-deep border-b border-border">
          <MonsterArt
            creature={view}
            variant="full"
            className="absolute inset-0 w-full h-full"
            imgClassName="w-full h-full object-cover"
            eager
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-surface/90 border border-border flex items-center justify-center text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-secondary truncate">{typeLine || 'Существо'}</div>
              <h3 className="font-medium text-2xl text-text mt-0.5 truncate">{view.name}</h3>
              {view.nameEn && (
                <div className="text-xs text-muted font-mono truncate">{view.nameEn}</div>
              )}
            </div>
            <span className="hud-keycap shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: crColor }} />
              <span>
                Опасность {view.cr} · {view.xp.toLocaleString('ru-RU')} опыта
              </span>
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {view.sourceTitle && (
              <span className="hud-keycap" title="Источник">
                {view.sourceTitle}
              </span>
            )}
            {view.isCompendium && (
              <span className="hud-keycap text-muted">dnd.su</span>
            )}
            {revealed ? (
              <span className="hud-keycap text-positive">Открыто игрокам</span>
            ) : (
              <span className="hud-keycap text-muted">Скрыто от игроков</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {view.sourceUrl && (
                <a
                  href={view.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hud-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>dnd.su</span>
                </a>
              )}
              {isDm && onToggleReveal && (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed((prev) => !prev);
                    onToggleReveal(view);
                  }}
                  className={`h-8 px-3 text-xs border inline-flex items-center gap-1.5 transition-colors ${
                    revealed
                      ? 'bg-positive/10 border-positive/30 text-positive'
                      : 'bg-raised border-border text-muted hover:text-text'
                  }`}
                >
                  {revealed ? (
                    <>
                      <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Открыто игрокам</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Показать игрокам</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Опасность</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {view.cr}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Опыт</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {view.xp.toLocaleString('ru-RU')}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Класс доспеха</div>
              <div className="font-mono font-medium text-lg text-text mt-1 tabular-nums">
                {view.ac}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Хиты</div>
              <div className="font-mono font-medium text-sm text-text mt-1.5 tabular-nums">
                {view.hp}
              </div>
            </div>
            <div className="p-3 bg-bg border border-border">
              <div className="text-xs text-muted">Скорость</div>
              <div className="text-sm text-text mt-1 leading-snug">
                {detail?.speed || '—'}
              </div>
            </div>
          </div>

          {(detail?.senses || detail?.languages) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detail.senses && (
                <div className="p-3 bg-bg border border-border">
                  <div className="text-xs text-muted">Чувства</div>
                  <div className="text-sm text-secondary mt-1">{detail.senses}</div>
                </div>
              )}
              {detail.languages && (
                <div className="p-3 bg-bg border border-border">
                  <div className="text-xs text-muted">Языки</div>
                  <div className="text-sm text-secondary mt-1">{detail.languages}</div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted">
                {view.isCompendium ? 'Статблок и описание' : 'Описание'}
              </div>
              {loading && (
                <span className="text-[11px] text-muted inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  загрузка статблока…
                </span>
              )}
            </div>
            {detail?.description ? (
              <div className="max-h-[42vh] overflow-y-auto pr-1">
                <FormattedText text={detail.description} className="text-sm text-secondary" />
              </div>
            ) : loading ? (
              <div className="text-xs text-muted">Загружаем подробности…</div>
            ) : (
              <div className="text-xs text-muted border border-dashed border-border p-3">
                Статблок пока не заполнен. Мастер может добавить описание в редакторе бестиария.
              </div>
            )}
          </div>

          {galleryCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted inline-flex items-center gap-1.5">
                  <Images className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Галерея dnd.su</span>
                </div>
                <span className="text-[11px] text-muted font-mono tabular-nums">
                  {galleryCount} {galleryCount === 1 ? 'изображение' : 'изображений'}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {gallery.map((image, index) => (
                  <button
                    key={`${image.thumb}-${index}`}
                    type="button"
                    onClick={() => setLightbox(index)}
                    className="group relative aspect-square bg-deep border border-border overflow-hidden hover:border-primary/60 transition-colors"
                    title="Открыть изображение"
                  >
                    <DndsuImage
                      thumbUrl={image.thumb}
                      fullUrl={image.full}
                      alt={`${view.name} — изображение ${index + 1}`}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      fallback={
                        <span className="w-full h-full flex items-center justify-center text-[10px] text-muted">
                          нет изображения
                        </span>
                      }
                    />
                    <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <EntityNotes kind="creature" entityId={creature.id} />
          </div>
        </div>
      </div>

      {lightbox !== null && gallery[lightbox] && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-surface/90 border border-border flex items-center justify-center text-muted hover:text-text"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>

          {galleryCount > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox((prev) => (prev === null ? prev : (prev - 1 + galleryCount) % galleryCount));
                }}
                className="absolute left-3 sm:left-6 w-10 h-10 bg-surface/90 border border-border flex items-center justify-center text-muted hover:text-text"
                title="Предыдущее (←)"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox((prev) => (prev === null ? prev : (prev + 1) % galleryCount));
                }}
                className="absolute right-3 sm:right-6 w-10 h-10 bg-surface/90 border border-border flex items-center justify-center text-muted hover:text-text"
                title="Следующее (→)"
              >
                <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </>
          )}

          <div className="max-w-[92vw] max-h-[86vh] space-y-2" onClick={(event) => event.stopPropagation()}>
            <DndsuImage
              thumbUrl={gallery[lightbox].thumb}
              fullUrl={gallery[lightbox].full}
              variant="full"
              alt={`${view.name} — изображение ${lightbox + 1}`}
              className="max-w-[92vw] max-h-[80vh] object-contain"
              imgClassName="max-w-[92vw] max-h-[80vh] object-contain border border-border bg-deep"
              eager
            />
            <div className="text-center text-xs text-secondary">
              {view.name} · {lightbox + 1} / {galleryCount}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
