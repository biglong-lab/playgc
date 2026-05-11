-- 🎵 games.bgm_volume — 整場 BGM 音量（2026-05-12 / 業主 #11）
--
-- 用途：遊戲基本設定 admin UI 加「BGM 大小聲」slider
--   - 0  = 靜音
--   - 50 = 預設（中等音量）
--   - 100 = 最大

ALTER TABLE games ADD COLUMN IF NOT EXISTS bgm_volume INTEGER DEFAULT 50;
