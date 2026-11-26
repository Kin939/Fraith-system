import { useCallback, useEffect, useRef } from 'react';
import { OnlineMember, useCampaignStore } from '../lib/store';
import { isJournalLocallyBusy, isSheetLocallyBusy } from '../lib/syncTracker';
import type {
  CampaignWsMessage,
  CharacterProfile,
  ChatMessage,
  ChatPoll,
  CustomCampaignEmoji,
  JournalEntry,
  LearnedSpellRecord,
  NextSessionBanner,
  NoteEntityKind,
  PlayerId,
  PurchasedTalent,
  EntityNote,
  Quest,
  RollLogEntry,
  Spell,
  TalentNode,
  ThemeVariables,
} from '../lib/types';

let sharedSocket: WebSocket | null = null;

export function sendCampaignSocketMessage(type: string, payload: unknown): boolean {
  if (sharedSocket && sharedSocket.readyState === WebSocket.OPEN) {
    sharedSocket.send(JSON.stringify({ type, payload }));
    return true;
  }
  return false;
}

export function useWebSocket() {
  const user = useCampaignStore((s) => s.user);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!user) return;
    if (sharedSocket && (sharedSocket.readyState === WebSocket.OPEN || sharedSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/api/ws`;
    const ws = new WebSocket(wsUrl);
    sharedSocket = ws;

    ws.onopen = () => {
      useCampaignStore.getState().setWsConnected(true);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as CampaignWsMessage;
        const store = useCampaignStore.getState();

        switch (msg.type) {
          case 'connected':
          case 'presence:update': {
            const p = msg.payload as { online?: OnlineMember[] };
            if (Array.isArray(p?.online)) {
              store.setOnlineUsers(p.online);
            }
            break;
          }
          case 'quests:updated': {
            const p = msg.payload as { quests?: Quest[] };
            if (Array.isArray(p?.quests)) {
              store.setQuests(p.quests);
            }
            break;
          }
          case 'notes:updated': {
            const p = msg.payload as {
              kind?: NoteEntityKind;
              entityId?: number;
              notes?: EntityNote[];
            };
            if (p?.kind && typeof p.entityId === 'number' && Array.isArray(p.notes)) {
              store.setEntityNotes(p.kind, p.entityId, p.notes);
            }
            break;
          }
          case 'npcs:updated': {
            void store.refreshNpcs();
            break;
          }
          case 'bestiary:updated': {
            void store.refreshBestiary();
            break;
          }
          case 'spells:updated': {
            const p = msg.payload as { spells?: Spell[] };
            if (Array.isArray(p?.spells)) {
              store.setSpells(p.spells);
            }
            break;
          }
          case 'learned_spells:updated': {
            const p = msg.payload as {
              playerId?: PlayerId;
              learnedSpells?: LearnedSpellRecord[];
            };
            if (p?.playerId && Array.isArray(p.learnedSpells)) {
              store.updateLearnedSpellsInStore(p.playerId, p.learnedSpells);
            }
            break;
          }
          case 'talents:updated': {
            const p = msg.payload as {
              inspirationPoints: number;
              nodes: TalentNode[];
              purchases: PurchasedTalent[];
            };
            if (p && Array.isArray(p.nodes)) {
              store.setTalentsBundle(p);
            }
            break;
          }
          case 'inspiration:updated': {
            const p = msg.payload as { inspirationPoints?: number };
            if (typeof p?.inspirationPoints === 'number') {
              store.setInspirationPoints(p.inspirationPoints);
            }
            break;
          }
          case 'journal:updated': {
            const p = msg.payload as { playerId?: PlayerId; journal?: JournalEntry };
            if (p?.playerId && p.journal) {
              // Never clobber the author's own active typing with a delayed WS self-echo
              if (msg.senderId && msg.senderId === store.user?.id) break;
              if (isJournalLocallyBusy(p.playerId)) break;
              store.updateJournalInStore(p.playerId, p.journal);
            }
            break;
          }
          case 'character:updated': {
            const p = msg.payload as { playerId?: PlayerId; profile?: CharacterProfile };
            if (p?.playerId && p.profile) {
              // Ignore our own echo so rapid HP/resource/text edits never snap back
              if (msg.senderId && msg.senderId === store.user?.id) break;
              if (isSheetLocallyBusy(p.playerId)) {
                store.mergeCharacterMetadataInStore(p.playerId, p.profile);
              } else {
                store.updateCharacterProfileInStore(p.playerId, p.profile);
              }
            }
            break;
          }
          case 'lss:roll': {
            const roll = msg.payload as RollLogEntry;
            if (roll && roll.title) {
              store.prependRoll(roll);
              if (msg.senderId !== store.user?.id) {
                store.pushToast({
                  title: `${roll.characterName}: ${roll.title}`,
                  message: `${roll.breakdown || roll.formula} → ${roll.total}`,
                  variant: roll.isCrit
                    ? roll.critKind === 'failure'
                      ? 'error'
                      : 'success'
                    : 'info',
                });
              }
            }
            break;
          }
          case 'rolls:cleared': {
            store.setRolls([]);
            break;
          }
          case 'theme:updated': {
            const p = msg.payload as { userId?: number; theme?: ThemeVariables };
            if (p?.theme && (!p.userId || p.userId === store.user?.id)) {
              store.applyLiveTheme(p.theme);
              store.pushToast({
                title: 'Тема обновлена Мастером',
                message: 'Новое оформление применено в реальном времени.',
                variant: 'info',
              });
            }
            break;
          }
          case 'chat:message_created': {
            const p = msg.payload as { message?: ChatMessage };
            if (p?.message) {
              const isFromOther = p.message.userId !== store.user?.id;
              store.upsertChatMessage(p.message, isFromOther);
            }
            break;
          }
          case 'chat:message_updated': {
            const p = msg.payload as { message?: ChatMessage };
            if (p?.message) {
              store.upsertChatMessage(p.message, false);
            }
            break;
          }
          case 'chat:message_deleted': {
            const p = msg.payload as { messageId?: number };
            if (typeof p?.messageId === 'number') {
              store.removeChatMessage(p.messageId);
            }
            break;
          }
          case 'chat:poll_updated': {
            const p = msg.payload as { poll?: ChatPoll };
            if (p?.poll) {
              store.updateChatPollInStore(p.poll);
            }
            break;
          }
          case 'chat:session_updated': {
            const p = msg.payload as { nextSession?: NextSessionBanner | null };
            store.setNextSessionInStore(p?.nextSession ?? null);
            break;
          }
          case 'party:avatars_updated': {
            const p = msg.payload as {
              userId?: number;
              playerId?: PlayerId | null;
              avatarUrl?: string | null;
            };
            if (p?.playerId) {
              store.applyPlayerAvatar(p.playerId, p.avatarUrl ?? null, p.userId ?? null);
            }
            break;
          }
          case 'chat:emojis_updated': {
            const p = msg.payload as { customEmojis?: CustomCampaignEmoji[] };
            if (Array.isArray(p?.customEmojis)) {
              store.setCustomEmojis(p.customEmojis);
            }
            break;
          }
          case 'chat:typing': {
            const p = msg.payload as { userId?: number; displayName?: string };
            if (typeof p?.userId === 'number' && p.displayName) {
              store.registerTypingUser(p.userId, p.displayName);
            }
            break;
          }
          default:
            break;
        }
      } catch {
        // Ignore malformed WS message
      }
    };

    ws.onclose = () => {
      useCampaignStore.getState().setWsConnected(false);
      sharedSocket = null;
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (useCampaignStore.getState().user) {
        reconnectTimerRef.current = window.setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
      }
      return;
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [user, connect]);
}
