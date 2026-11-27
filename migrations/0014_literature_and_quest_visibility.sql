-- Личные квесты: список user.id, которым мастер открыл квест.
-- Пустой список ('[]') = квест виден всем игрокам.
--
-- Таблица «Литература»: PDF / DOCX / TXT / PNG и прочие файлы мастера.
-- Файлы лежат в R2 (ключ file_key), а если R2 не подключён — чанками в media_blobs.

ALTER TABLE quests ADD COLUMN visible_user_ids TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS literature_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- ключ в R2 либо префикс чанков в media_blobs
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_ext TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('pdf', 'docx', 'doc', 'text', 'image', 'other')),
  -- список user.id, которым файл открыт; '[]' = виден всем игрокам
  visible_user_ids TEXT NOT NULL DEFAULT '[]',
  uploaded_by INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_literature_sort ON literature_files(sort_order ASC, id DESC);
