-- GPS 地圖導航系統 - 資料庫 Schema
-- 建立所有必要的資料表與索引

-- ==================== 地點/任務點資料表 ====================

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  icon VARCHAR(50),
  radius INTEGER DEFAULT 10,
  unlock_condition JSONB,
  reward JSONB,
  status VARCHAR(20) DEFAULT 'active',
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT chk_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT chk_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT chk_radius CHECK (radius > 0),
  CONSTRAINT chk_location_type CHECK (location_type IN ('task', 'checkpoint', 'item', 'start', 'finish', 'custom')),
  CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'completed'))
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_game_locations ON locations(game_id);
CREATE INDEX IF NOT EXISTS idx_location_type ON locations(location_type);
CREATE INDEX IF NOT EXISTS idx_location_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_location_coords ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_location_order ON locations(game_id, order_index);

-- 建立註解
COMMENT ON TABLE locations IS '地點/任務點資料表';
COMMENT ON COLUMN locations.game_id IS '遊戲 ID';
COMMENT ON COLUMN locations.name IS '地點名稱';
COMMENT ON COLUMN locations.description IS '地點描述';
COMMENT ON COLUMN locations.latitude IS '緯度 (WGS84)';
COMMENT ON COLUMN locations.longitude IS '經度 (WGS84)';
COMMENT ON COLUMN locations.location_type IS '地點類型: task(任務), checkpoint(檢查點), item(道具), start(起點), finish(終點), custom(自訂)';
COMMENT ON COLUMN locations.icon IS '圖示名稱';
COMMENT ON COLUMN locations.radius IS '觸發半徑 (公尺)';
COMMENT ON COLUMN locations.unlock_condition IS '解鎖條件 (JSON)';
COMMENT ON COLUMN locations.reward IS '獎勵資訊 (JSON)';
COMMENT ON COLUMN locations.status IS '狀態: active(啟用), inactive(停用), completed(已完成)';
COMMENT ON COLUMN locations.order_index IS '順序索引';

-- ==================== 玩家位置追蹤資料表 ====================

CREATE TABLE IF NOT EXISTS player_locations (
  id SERIAL PRIMARY KEY,
  game_session_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  altitude DECIMAL(8, 2),
  speed DECIMAL(6, 2),
  heading DECIMAL(5, 2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT chk_player_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT chk_player_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT chk_accuracy CHECK (accuracy >= 0),
  CONSTRAINT chk_speed CHECK (speed >= 0),
  CONSTRAINT chk_heading CHECK (heading >= 0 AND heading < 360)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_session_player ON player_locations(game_session_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_timestamp ON player_locations(player_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timestamp ON player_locations(timestamp DESC);

-- 建立註解
COMMENT ON TABLE player_locations IS '玩家位置追蹤資料表';
COMMENT ON COLUMN player_locations.game_session_id IS '遊戲場次 ID';
COMMENT ON COLUMN player_locations.player_id IS '玩家 ID';
COMMENT ON COLUMN player_locations.latitude IS '緯度';
COMMENT ON COLUMN player_locations.longitude IS '經度';
COMMENT ON COLUMN player_locations.accuracy IS '精度 (公尺)';
COMMENT ON COLUMN player_locations.altitude IS '海拔 (公尺)';
COMMENT ON COLUMN player_locations.speed IS '速度 (公尺/秒)';
COMMENT ON COLUMN player_locations.heading IS '方向 (度, 0-360)';
COMMENT ON COLUMN player_locations.timestamp IS '時間戳記';

-- ==================== 地點造訪記錄資料表 ====================

CREATE TABLE IF NOT EXISTS location_visits (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  game_session_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  distance_from_center DECIMAL(6, 2),
  duration INTEGER,
  completed BOOLEAN DEFAULT false,
  
  CONSTRAINT fk_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  CONSTRAINT chk_distance CHECK (distance_from_center >= 0),
  CONSTRAINT chk_duration CHECK (duration >= 0)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_location_visits ON location_visits(location_id, game_session_id);
CREATE INDEX IF NOT EXISTS idx_player_visits ON location_visits(player_id, game_session_id);
CREATE INDEX IF NOT EXISTS idx_visit_time ON location_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_visits ON location_visits(player_id, completed);

-- 建立註解
COMMENT ON TABLE location_visits IS '地點造訪記錄資料表';
COMMENT ON COLUMN location_visits.location_id IS '地點 ID';
COMMENT ON COLUMN location_visits.game_session_id IS '遊戲場次 ID';
COMMENT ON COLUMN location_visits.player_id IS '玩家 ID';
COMMENT ON COLUMN location_visits.visited_at IS '造訪時間';
COMMENT ON COLUMN location_visits.distance_from_center IS '距離中心點的距離 (公尺)';
COMMENT ON COLUMN location_visits.duration IS '停留時間 (秒)';
COMMENT ON COLUMN location_visits.completed IS '是否完成';

-- ==================== 導航路徑資料表 ====================

CREATE TABLE IF NOT EXISTS navigation_paths (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  name VARCHAR(100),
  path_data JSONB NOT NULL,
  distance DECIMAL(8, 2),
  estimated_time INTEGER,
  difficulty VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT chk_distance_positive CHECK (distance >= 0),
  CONSTRAINT chk_time_positive CHECK (estimated_time >= 0),
  CONSTRAINT chk_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_game_paths ON navigation_paths(game_id);
CREATE INDEX IF NOT EXISTS idx_path_difficulty ON navigation_paths(difficulty);

-- 建立註解
COMMENT ON TABLE navigation_paths IS '導航路徑資料表';
COMMENT ON COLUMN navigation_paths.game_id IS '遊戲 ID';
COMMENT ON COLUMN navigation_paths.name IS '路徑名稱';
COMMENT ON COLUMN navigation_paths.path_data IS '路徑資料 (JSON)';
COMMENT ON COLUMN navigation_paths.distance IS '總距離 (公尺)';
COMMENT ON COLUMN navigation_paths.estimated_time IS '預估時間 (秒)';
COMMENT ON COLUMN navigation_paths.difficulty IS '難度: easy(簡單), medium(中等), hard(困難)';

-- ==================== 自動更新 updated_at 的觸發器 ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==================== 範例資料 (賈村競技體驗場) ====================

-- 插入範例遊戲 (假設 games 表已存在)
-- INSERT INTO games (id, name, description) VALUES (1, '賈村競技挑戰', '賈村競技體驗場的實境遊戲');

-- 插入範例地點 (賈村競技體驗場座標: 24.4324, 118.3786)
INSERT INTO locations (game_id, name, description, latitude, longitude, location_type, icon, radius, order_index, reward) VALUES
(1, '入口集合點', '遊戲開始的地方,領取裝備與任務說明', 24.4324, 118.3786, 'start', 'flag', 15, 1, '{"points": 0, "items": []}'),
(1, '射擊訓練場', '完成射擊訓練,命中3次靶心', 24.4328, 118.3790, 'task', 'target', 20, 2, '{"points": 100, "items": [1]}'),
(1, '檢查點 Alpha', '通過第一個檢查點', 24.4332, 118.3795, 'checkpoint', 'checkpoint', 10, 3, '{"points": 50}'),
(1, '補給站', '領取補給道具', 24.4336, 118.3800, 'item', 'gift', 15, 4, '{"points": 0, "items": [2, 3]}'),
(1, '戰術挑戰區', '完成戰術挑戰任務', 24.4340, 118.3805, 'task', 'target', 25, 5, '{"points": 150, "items": [4]}'),
(1, '檢查點 Bravo', '通過第二個檢查點', 24.4344, 118.3810, 'checkpoint', 'checkpoint', 10, 6, '{"points": 50}'),
(1, '終點頒獎區', '完成所有任務,領取獎勵', 24.4348, 118.3815, 'finish', 'trophy', 20, 7, '{"points": 200, "items": [5]}')
ON CONFLICT DO NOTHING;

-- ==================== 效能優化建議 ====================

-- 1. 定期清理舊的位置追蹤資料 (保留最近 30 天)
-- DELETE FROM player_locations WHERE timestamp < NOW() - INTERVAL '30 days';

-- 2. 分析查詢效能
-- EXPLAIN ANALYZE SELECT * FROM locations WHERE game_id = 1 AND status = 'active';

-- 3. 更新統計資訊
-- ANALYZE locations;
-- ANALYZE player_locations;
-- ANALYZE location_visits;

-- ==================== 安全性設定 (Row Level Security) ====================

-- 啟用 RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_visits ENABLE ROW LEVEL SECURITY;

-- 範例 RLS 政策 (需根據實際認證系統調整)
-- CREATE POLICY "玩家可查看自己的位置" ON player_locations
--   FOR SELECT
--   USING (player_id = current_user_id());

-- CREATE POLICY "玩家可更新自己的位置" ON player_locations
--   FOR INSERT
--   WITH CHECK (player_id = current_user_id());

-- ==================== 完成 ====================

-- 顯示所有資料表
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('locations', 'player_locations', 'location_visits', 'navigation_paths')
ORDER BY table_name;

-- 顯示資料表統計
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('locations', 'player_locations', 'location_visits', 'navigation_paths')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
