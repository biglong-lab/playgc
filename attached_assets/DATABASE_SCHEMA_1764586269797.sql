```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. games (遊戲)
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  difficulty VARCHAR(20), -- easy, medium, hard
  estimated_time INTEGER, -- 預估完成時間(分鐘)
  max_players INTEGER DEFAULT 6,
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  creator_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. pages (頁面)
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  page_order INTEGER NOT NULL,
  page_type VARCHAR(50) NOT NULL, -- text_card, dialogue, video, button, text_verify, etc.
  config JSONB NOT NULL, -- 頁面配置(JSON格式)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. items (道具)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  item_type VARCHAR(50), -- consumable, equipment, quest_item, collectible
  effect JSONB, -- 道具效果配置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. events (搜索事件)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- qrcode, gps, photo, arduino
  trigger_config JSONB NOT NULL, -- 觸發條件配置
  reward_config JSONB, -- 獎勵配置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. game_sessions (遊戲場次)
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  team_name VARCHAR(100),
  player_count INTEGER,
  status VARCHAR(20) DEFAULT 'playing', -- playing, completed, abandoned
  score INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. player_progress (玩家進度)
CREATE TABLE player_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  current_page_id UUID REFERENCES pages(id),
  inventory JSONB DEFAULT '[]'::jsonb, -- 持有道具
  variables JSONB DEFAULT '{}'::jsonb, -- 遊戲變數
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. chat_messages (即時聊天)
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. arduino_devices (Arduino設備)
CREATE TABLE arduino_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50), -- shooting_target, sensor, light_control
  mqtt_topic VARCHAR(200) UNIQUE,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, maintenance
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. shooting_records (射擊記錄)
CREATE TABLE shooting_records (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id),
  device_id UUID REFERENCES arduino_devices(id),
  user_id UUID REFERENCES auth.users(id),
  hit_score INTEGER,
  hit_position VARCHAR(50), -- 命中位置
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. leaderboard (排行榜)
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  session_id UUID REFERENCES game_sessions(id),
  team_name VARCHAR(100),
  total_score INTEGER,
  completion_time_seconds INTEGER, -- 完成時間(秒)
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pages_game_id ON pages(game_id);
CREATE INDEX idx_pages_order ON pages(game_id, page_order);
CREATE INDEX idx_sessions_status ON game_sessions(status, started_at);
CREATE INDEX idx_leaderboard_game ON leaderboard(game_id, total_score DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at DESC);
CREATE INDEX idx_shooting_records_session ON shooting_records(session_id);

-- Enable Realtime on tables
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE player_progress REPLICA IDENTITY FULL;
ALTER TABLE game_sessions REPLICA IDENTITY FULL;

-- RLS Policies

-- Games
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published games" ON games FOR SELECT USING (status = 'published');
CREATE POLICY "Users can manage their own games" ON games FOR ALL USING (creator_id = auth.uid());

-- Game Sessions
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their own sessions" ON game_sessions FOR SELECT USING (id IN (SELECT session_id FROM player_progress WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all sessions" ON game_sessions FOR ALL USING ((SELECT rolname FROM pg_roles WHERE oid = session_user::regrole) = 'service_role');

-- Player Progress
ALTER TABLE player_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can manage their own progress" ON player_progress FOR ALL USING (user_id = auth.uid());

-- Chat Messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can access chat in their session" ON chat_messages FOR ALL USING (session_id IN (SELECT session_id FROM player_progress WHERE user_id = auth.uid()));

-- Storage Policies

-- Allow user to upload to their own folder in 'game-uploads'
CREATE POLICY "Allow user uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'game-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow user to read their own uploaded files
CREATE POLICY "Allow user reads" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'game-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

```
