-- Типографика доски: пресет шрифтов (все шрифты поддерживают кириллицу и латиницу).
ALTER TABLE board_settings ADD COLUMN font_preset TEXT NOT NULL DEFAULT 'classic';

-- Цвет фона холста доски (пустая строка = цвет темы приложения).
ALTER TABLE board_settings ADD COLUMN bg_color TEXT NOT NULL DEFAULT '';
