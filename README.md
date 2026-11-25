# FRAITH.SYSTEM — Веб-портал D&D 5e кампании (Cloudflare Stack)

Полнофункциональный веб-портал для проведения D&D-кампании (**3 игрока + 1 мастер**), построенный на экосистеме **Cloudflare Pages + Workers (Hono) + D1 (SQLite) + R2 + Durable Objects (WebSocket Hibernation API)** с живой интеграцией **Long Story Short (LSS)** и кастомизируемой тёмной аниме-темой для каждого аккаунта.

---

## Архитектура

1. **Frontend (Cloudflare Pages + React 18 + TypeScript + Vite + Tailwind CSS)**: SPA с 6 вкладками, Zustand-стором и системой темизации на CSS-переменных (`--bg`, `--surface`, `--primary`, `--accent`, `--text`, `--text-muted`, `--border`, `--glow`).
2. **Backend API (`/functions/api/[[route]].ts` на Hono)**: единый роутер Cloudflare Pages Functions с проверкой JWT-сессий из `httpOnly` cookie (и опциональной поддержкой заголовков **Cloudflare Access / Zero Trust**) и строгим разделением прав `dm` и `player` (`playerId = 1, 2, 3`).
3. **Хранение данных (Cloudflare D1 + R2)**: все сущности (пользователи, темы аккаунтов, кэш LSS, личные журналы, квесты, бестиарий с серверной маскировкой неоткрытых существ, SRD/Homebrew-заклинания, дерево талантов и общий пул вдохновений) хранятся в SQLite на D1; иллюстрации загружаются в бакет R2 и раздаются через `/api/r2/:key`.
4. **Real-Time синхронизация (`workers/campaign-do.ts` — Durable Objects + WebSocket Hibernation API)**: один экземпляр `CampaignRoom` координирует всю кампанию, пробуждаясь при сообщениях и мгновенно рассылая изменения квестов, бестиария, заклинаний, талантов, вдохновений, тем и бросков кубиков LSS всем 4 участникам.
5. **Двухуровневая интеграция с Long Story Short (LSS)**:
   - Встраивание листа через `<iframe src="https://longstoryshort.app/iframe/characters/list/">` с `SHEET_IFRAME_SANDBOX` и `window.postMessage` мостом из официального `@longstoryshort/vtt-sdk` (`lss:roll`, `lss:manifest`, `dnd:health`) — строго в режиме чтения, без доступа к DOM iframe.
   - Серверный кэш и синхронизация `POST /api/player/:id/sync-lss` + периодический polling (`useLssSync`) и ручной импорт `.json` по схеме `https://longstoryshort.app/schema/v1/character.json` для полей вне `postMessage` (монеты, заметки, класс, лимит заклинаний).

---

## Seed-аккаунты при первом запуске

| Логин | Пароль | Роль | Персонаж |
|---|---|---|---|
| `dm` | `master123` | `dm` | Архитектор Бездны (полный доступ ко всем вкладкам и вкладке «Мастер») |
| `player1` | `player123` | `player` (`1`) | Аэлин Звёздный Шёпот (`Wizard`, 5 ур.) |
| `player2` | `player123` | `player` (`2`) | Каэл Железный Обет (`Cleric`, 5 ур.) |
| `player3` | `player123` | `player` (`3`) | Никс Тень Луны (`Warlock`, 5 ур.) |

---

## Локальный запуск

```bash
npm install

# 1. Применить миграции и seed-данные к локальной D1
npm run db:migrate:local

# 2. Собрать фронтенд
npm run build

# 3. Запустить воркер Durable Object (терминал 1)
npm run dev:do

# 4. Запустить Cloudflare Pages + Hono Functions + D1 + R2 (терминал 2)
npx wrangler pages dev dist --ip 0.0.0.0 --port 8788
```

---

## Деплой в Cloudflare Production

```bash
# 1. Создайте базу D1 и бакет R2 (один раз)
npx wrangler d1 create fraith-dnd-db
npx wrangler r2 bucket create fraith-dnd-assets
# Скопируйте полученный database_id в wrangler.toml -> [[d1_databases]]

# 2. Задеплойте воркер Durable Object (CampaignRoom с Hibernation API)
npm run deploy:do
# эквивалент: npx wrangler deploy -c wrangler.do.toml

# 3. Примените SQL-миграции и seed-данные на удалённую D1
npm run db:migrate:remote
# эквивалент: npx wrangler d1 migrations apply fraith-dnd-db --remote

# 4. Соберите и задеплойте Cloudflare Pages (фронтенд + /functions/api)
npm run deploy:pages
# эквивалент: npm run build && npx wrangler pages deploy dist --project-name fraith-system

# 5. Задайте продакшен-секрет для подписи JWT-куки
npx wrangler pages secret put JWT_SECRET --project-name fraith-system
```

---

## Автодеплой через GitHub Actions (`.github/workflows/deploy.yml`)

В репозитории настроен CI/CD пайплайн:
1. В настройках репозитория GitHub (**Settings → Secrets and variables → Actions**) добавьте два секрета:
   - `CLOUDFLARE_API_TOKEN` — API-токен Cloudflare с правами на *Cloudflare Pages (Edit)*, *Workers Scripts (Edit)*, *D1 (Edit)* и *R2 (Edit)*.
   - `CLOUDFLARE_ACCOUNT_ID` — ваш Account ID из панели Cloudflare.
2. Убедитесь, что в `wrangler.toml` прописан реальный `database_id` вашей D1-базы `fraith-dnd-db`.
3. При каждом слиянии в `main` (или ручном запуске **Run workflow** во вкладке Actions) GitHub автоматически проверит типы, соберёт `dist`, обновит Durable Object, применит миграции D1 и задеплоит сайт на Cloudflare Pages.

