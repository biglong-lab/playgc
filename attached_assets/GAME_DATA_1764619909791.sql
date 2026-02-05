-- ============================================
-- 賈村保衛戰 - 遊戲資料庫設定檔
-- ============================================
-- 此檔案包含完整的遊戲資料,可直接匯入資料庫
-- GPS 座標欄位保留為 NULL,可在現場實際測量後更新

-- ============================================
-- 1. 建立遊戲主檔
-- ============================================

INSERT INTO games (
  id,
  title,
  description,
  theme,
  difficulty,
  estimated_duration,
  max_players,
  min_players,
  is_active,
  cover_image_url,
  created_at
) VALUES (
  1,
  '賈村保衛戰:民兵特訓計畫',
  '1958年8月23日前夕,金門前線情勢緊張。玩家扮演新進民兵,必須完成15項特訓任務,學習戰地技能、探索基地設施、破解軍事密碼,最終取得「合格民兵」資格。',
  'military_history',
  'medium',
  180,
  50,
  1,
  true,
  '/images/games/jiachun-cover.jpg',
  NOW()
);

-- ============================================
-- 2. 建立 15 個遊戲地點/關卡
-- ============================================

-- 關卡 1: 新兵報到
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '新兵報到',
  '抵達賈村入口,接受訓練基地老班長的任務簡報,領取虛擬裝備開始特訓之旅。',
  'checkpoint',
  NULL,  -- 待現場設定
  NULL,  -- 待現場設定
  15.0,
  1,
  true,
  50,
  NULL,
  'JIACHUN_CHECKPOINT_01',
  NOW()
);

-- 關卡 2: 歸零射擊
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '歸零射擊',
  '學習基礎射擊技巧,完成歸零校準訓練。了解歸零射擊的原理與重要性。',
  'task',
  NULL,
  NULL,
  20.0,
  2,
  true,
  100,
  '{"required_locations": [1]}',
  'JIACHUN_SHOOTING_RANGE_01',
  NOW()
);

-- 關卡 3: 關公護佑
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '關公護佑',
  '探索賈村的精神寄託 - 關公廟,解開廟中的密碼謎題,獲得第一個情報碎片。',
  'puzzle',
  NULL,
  NULL,
  15.0,
  3,
  true,
  150,
  '{"required_locations": [2]}',
  'JIACHUN_TEMPLE_01',
  NOW()
);

-- 關卡 4: 地下秘道
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '地下秘道',
  '發現賈村的地下防禦系統,進入神秘的地下隧道入口。',
  'exploration',
  NULL,
  NULL,
  10.0,
  4,
  true,
  120,
  '{"required_locations": [3]}',
  'JIACHUN_TUNNEL_ENTRANCE',
  NOW()
);

-- 關卡 5: 隧道出口
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '隧道出口',
  '找到隧道的另一個出口,完成地下路線的探索,獲得第二個情報碎片。',
  'checkpoint',
  NULL,
  NULL,
  10.0,
  5,
  true,
  100,
  '{"required_locations": [4]}',
  'JIACHUN_TUNNEL_EXIT',
  NOW()
);

-- 關卡 6: 戰壕體驗
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '戰壕體驗',
  '體驗真實的戰壕環境,了解前線民兵的戰鬥生活,完成情境選擇挑戰。',
  'experience',
  NULL,
  NULL,
  15.0,
  6,
  true,
  150,
  '{"required_locations": [5]}',
  'JIACHUN_TRENCH_01',
  NOW()
);

-- 關卡 7: 補給站
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '補給站',
  '到達補給站,補充體力,了解後勤補給的重要性。可使用積分兌換虛擬道具。',
  'item',
  NULL,
  NULL,
  15.0,
  7,
  true,
  80,
  '{"required_locations": [6]}',
  'JIACHUN_SHOP_01',
  NOW()
);

-- 關卡 8: 手榴彈訓練
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '手榴彈訓練',
  '學習手榴彈投擲技巧,完成模擬訓練,獲得第三個情報碎片。',
  'task',
  NULL,
  NULL,
  20.0,
  8,
  true,
  150,
  '{"required_locations": [7]}',
  'JIACHUN_GRENADE_AREA',
  NOW()
);

-- 關卡 9: 毒氣防護
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '毒氣防護',
  '了解化學武器防護知識,體驗毒氣室訓練,完成防護知識測驗。',
  'experience',
  NULL,
  NULL,
  15.0,
  9,
  true,
  150,
  '{"required_locations": [8]}',
  'JIACHUN_GAS_CHAMBER',
  NOW()
);

-- 關卡 10: 六號樓探索
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '六號樓探索',
  '探索神秘的六號樓,解開建築中隱藏的秘密,獲得第四個情報碎片。',
  'puzzle',
  NULL,
  NULL,
  15.0,
  10,
  true,
  150,
  '{"required_locations": [9]}',
  'JIACHUN_BUILDING_06',
  NOW()
);

-- 關卡 11: 團隊協作
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '團隊協作',
  '需要多人協作完成的團隊挑戰,發揮團隊精神共同解決問題。',
  'team',
  NULL,
  NULL,
  20.0,
  11,
  true,
  200,
  '{"required_locations": [10], "min_players": 2}',
  'JIACHUN_TEAM_CHALLENGE',
  NOW()
);

-- 關卡 12: 夜間巡邏
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '夜間巡邏',
  '按照指定路線完成巡邏任務,依序通過3個檢查點,獲得第五個情報碎片。',
  'checkpoint',
  NULL,
  NULL,
  10.0,
  12,
  true,
  150,
  '{"required_locations": [11]}',
  'JIACHUN_PATROL_START',
  NOW()
);

-- 關卡 13: 密碼破譯
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '密碼破譯',
  '收集5個情報碎片,破解最終密碼,解鎖賈村的歷史檔案。',
  'puzzle',
  NULL,
  NULL,
  15.0,
  13,
  true,
  200,
  '{"required_locations": [12], "required_items": ["intel_1", "intel_2", "intel_3", "intel_4", "intel_5"]}',
  'JIACHUN_COMMAND_CENTER',
  NOW()
);

-- 關卡 14: 最終考驗
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '最終考驗',
  '綜合前面所學,完成最終的民兵資格考驗,通過綜合測驗與虛擬演練。',
  'task',
  NULL,
  NULL,
  20.0,
  14,
  true,
  300,
  '{"required_locations": [13]}',
  'JIACHUN_FINAL_TEST',
  NOW()
);

-- 關卡 15: 榮譽頒獎
INSERT INTO locations (
  game_id,
  name,
  description,
  type,
  latitude,
  longitude,
  trigger_radius,
  order_index,
  is_required,
  points_reward,
  unlock_condition,
  qr_code_data,
  created_at
) VALUES (
  1,
  '榮譽頒獎',
  '完成所有訓練,接受榮譽表彰,查看最終成績與排行榜。',
  'finish',
  NULL,
  NULL,
  15.0,
  15,
  true,
  0,
  '{"required_locations": [14]}',
  'JIACHUN_AWARD_CEREMONY',
  NOW()
);

-- ============================================
-- 3. 建立虛擬道具
-- ============================================

-- 必需道具
INSERT INTO items (
  game_id,
  name,
  description,
  type,
  rarity,
  image_url,
  is_consumable,
  effect,
  created_at
) VALUES
(1, '民兵識別證', '證明你是賈村民兵的身份證明', 'equipment', 'common', '/images/items/id-card.png', false, NULL, NOW()),
(1, '任務地圖', '顯示所有關卡位置的地圖', 'equipment', 'common', '/images/items/map.png', false, NULL, NOW()),
(1, '通訊器', '與指揮中心保持聯繫的通訊設備', 'equipment', 'common', '/images/items/radio.png', false, NULL, NOW());

-- 收集道具
INSERT INTO items (
  game_id,
  name,
  description,
  type,
  rarity,
  image_url,
  is_consumable,
  effect,
  created_at
) VALUES
(1, '射擊徽章', '完成射擊訓練獲得的榮譽徽章', 'badge', 'uncommon', '/images/items/shooting-badge.png', false, NULL, NOW()),
(1, '護身符', '關公廟獲得的護身符,保佑平安', 'special', 'rare', '/images/items/amulet.png', false, NULL, NOW()),
(1, '手電筒', '探索地下隧道必備的照明工具', 'equipment', 'common', '/images/items/flashlight.png', false, NULL, NOW()),
(1, '指南針', '辨識方向的導航工具', 'equipment', 'common', '/images/items/compass.png', false, NULL, NOW()),
(1, '鋼盔', '戰壕體驗獲得的防護裝備', 'equipment', 'uncommon', '/images/items/helmet.png', false, NULL, NOW()),
(1, '防毒面具', '化學武器防護裝備', 'equipment', 'uncommon', '/images/items/gas-mask.png', false, NULL, NOW()),
(1, '六號樓鑰匙', '開啟六號樓秘密的鑰匙', 'key', 'rare', '/images/items/key.png', false, NULL, NOW()),
(1, '團隊徽章', '完成團隊任務獲得的榮譽', 'badge', 'rare', '/images/items/team-badge.png', false, NULL, NOW()),
(1, '巡邏日誌', '記錄巡邏路線的日誌', 'document', 'uncommon', '/images/items/patrol-log.png', false, NULL, NOW());

-- 情報碎片
INSERT INTO items (
  game_id,
  name,
  description,
  type,
  rarity,
  image_url,
  is_consumable,
  effect,
  created_at
) VALUES
(1, '情報碎片 1/5', '關公廟獲得的情報碎片:19', 'intel', 'epic', '/images/items/intel-1.png', false, '{"intel_code": "19"}', NOW()),
(1, '情報碎片 2/5', '隧道出口獲得的情報碎片:58', 'intel', 'epic', '/images/items/intel-2.png', false, '{"intel_code": "58"}', NOW()),
(1, '情報碎片 3/5', '手榴彈區獲得的情報碎片:08', 'intel', 'epic', '/images/items/intel-3.png', false, '{"intel_code": "08"}', NOW()),
(1, '情報碎片 4/5', '六號樓獲得的情報碎片:23', 'intel', 'epic', '/images/items/intel-4.png', false, '{"intel_code": "23"}', NOW()),
(1, '情報碎片 5/5', '巡邏任務獲得的情報碎片:44', 'intel', 'epic', '/images/items/intel-5.png', false, '{"intel_code": "44"}', NOW());

-- 消耗道具
INSERT INTO items (
  game_id,
  name,
  description,
  type,
  rarity,
  image_url,
  is_consumable,
  effect,
  price_points,
  created_at
) VALUES
(1, '提示卡', '提供解謎提示', 'consumable', 'common', '/images/items/hint-card.png', true, '{"type": "hint"}', 50, NOW()),
(1, '時間延長卡', '延長遊戲時間30分鐘', 'consumable', 'uncommon', '/images/items/time-card.png', true, '{"type": "time_extension", "minutes": 30}', 100, NOW()),
(1, '能量補給包', '加速完成下一個任務', 'consumable', 'common', '/images/items/energy-pack.png', true, '{"type": "speed_boost"}', 80, NOW()),
(1, '跳過卡', '跳過一個困難關卡(限用1次)', 'consumable', 'rare', '/images/items/skip-card.png', true, '{"type": "skip", "max_use": 1}', 200, NOW());

-- ============================================
-- 4. 建立遊戲頁面內容
-- ============================================

-- 關卡 1 的頁面
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
-- 歡迎頁面
(1, 1, 'story', '新兵報到', '{
  "text": "歡迎來到賈村民兵訓練基地!這裡是金門前線的重要據點,自1949年起就肩負著保衛家園的重任。",
  "image_url": "/images/locations/entrance.jpg",
  "audio_url": "/audio/welcome.mp3"
}', 1, NOW()),

-- 任務說明
(1, 1, 'dialogue', '老班長的叮嚀', '{
  "speaker": "老班長",
  "avatar_url": "/images/characters/sergeant.png",
  "text": "新兵,情勢緊急!敵軍可能在近日發動攻擊。你必須立即展開特訓,完成15項任務,才能成為一名合格的民兵。記住,每一個任務都很重要!",
  "choices": [
    {"text": "是!保證完成任務!", "next_page": 3},
    {"text": "我準備好了!", "next_page": 3}
  ]
}', 2, NOW()),

-- 領取裝備
(1, 1, 'button', '領取裝備', '{
  "buttons": [
    {
      "text": "領取民兵識別證",
      "action": "grant_item",
      "params": {"item_id": 1},
      "image_url": "/images/items/id-card.png"
    },
    {
      "text": "領取任務地圖",
      "action": "grant_item",
      "params": {"item_id": 2},
      "image_url": "/images/items/map.png"
    },
    {
      "text": "領取通訊器",
      "action": "grant_item",
      "params": {"item_id": 3},
      "image_url": "/images/items/radio.png"
    },
    {
      "text": "開始特訓",
      "action": "complete_location",
      "params": {"location_id": 1}
    }
  ]
}', 3, NOW());

-- 關卡 2 的頁面 (歸零射擊)
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
(1, 2, 'story', '歸零靶場', '{
  "text": "歸零射擊是每位民兵必修的基本功。所謂「歸零」,就是校準槍械瞄準具與實際彈著點的偏差,確保每一發子彈都能精準命中目標。",
  "image_url": "/images/locations/shooting-range.jpg",
  "audio_url": "/audio/shooting-range-intro.mp3"
}', 1, NOW()),

(1, 2, 'video', '射擊教學', '{
  "video_url": "/videos/shooting-tutorial.mp4",
  "duration": 120,
  "thumbnail_url": "/images/thumbnails/shooting-tutorial.jpg"
}', 2, NOW()),

(1, 2, 'text_verify', '射擊訓練', '{
  "question": "完成虛擬射擊訓練,達到80分以上",
  "correct_answer": "complete",
  "hint": "點擊螢幕上的靶心進行射擊",
  "max_attempts": 3
}', 3, NOW());

-- 關卡 3 的頁面 (關公廟)
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
(1, 3, 'story', '關公廟的信仰', '{
  "text": "在戰火頻仍的年代,信仰是民兵們的精神支柱。關公以忠義聞名,成為賈村民兵的守護神。廟中藏有重要的歷史線索...",
  "image_url": "/images/locations/temple.jpg",
  "audio_url": "/audio/temple-intro.mp3"
}', 1, NOW()),

(1, 3, 'text_verify', '破解密碼', '{
  "question": "仔細觀察廟中的對聯、匾額、香爐,找出四位數密碼(提示:與823砲戰有關)",
  "correct_answer": "1958",
  "hint": "對聯中藏有年份,匾額上的字數有玄機,香爐上的銘文是關鍵",
  "max_attempts": 3,
  "on_success": {
    "grant_item": 11,
    "message": "恭喜!你獲得了情報碎片 1/5"
  }
}', 2, NOW());

-- 關卡 9 的頁面 (毒氣防護)
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
(1, 9, 'story', '化學武器防護', '{
  "text": "毒氣室訓練是民兵必修課程之一。在這裡,民兵們學習如何正確佩戴防毒面具,如何在化學武器攻擊下保護自己和戰友。",
  "image_url": "/images/locations/gas-chamber.jpg",
  "audio_url": "/audio/gas-chamber-intro.mp3"
}', 1, NOW()),

(1, 9, 'choice_verify', '防護知識測驗', '{
  "questions": [
    {
      "question": "發現毒氣攻擊時,第一步應該做什麼?",
      "options": ["立即佩戴防毒面具", "大聲呼喊", "尋找水源"],
      "correct_answer": 0
    },
    {
      "question": "防毒面具的密合測試方法是?",
      "options": ["用手掌蓋住濾罐,吸氣測試", "用力呼氣", "搖晃頭部"],
      "correct_answer": 0
    },
    {
      "question": "毒氣的特性是?",
      "options": ["比空氣重,會沉積在低處", "比空氣輕,會飄散到高處", "與空氣密度相同"],
      "correct_answer": 0
    },
    {
      "question": "在毒氣環境中,應該如何移動?",
      "options": ["往高處移動,遠離低窪地", "往低處移動", "原地不動"],
      "correct_answer": 0
    },
    {
      "question": "防毒面具可以持續使用多久?",
      "options": ["視濾罐類型,通常4-8小時", "無限期", "30分鐘"],
      "correct_answer": 0
    }
  ],
  "passing_score": 0.6,
  "on_success": {
    "grant_item": 10,
    "message": "恭喜!你獲得了防毒面具"
  }
}', 2, NOW());

-- 關卡 13 的頁面 (密碼破譯)
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
(1, 13, 'story', '指揮中心', '{
  "text": "這裡是賈村的大腦,所有重要決策都在此做出。你收集的情報碎片記錄了823砲戰期間,賈村民兵的英勇事蹟。",
  "image_url": "/images/locations/command-center.jpg",
  "audio_url": "/audio/command-center-intro.mp3"
}', 1, NOW()),

(1, 13, 'condition_verify', '組合情報', '{
  "conditions": [
    {"type": "has_item", "item_id": 11, "description": "情報碎片 1/5 (19)"},
    {"type": "has_item", "item_id": 12, "description": "情報碎片 2/5 (58)"},
    {"type": "has_item", "item_id": 13, "description": "情報碎片 3/5 (08)"},
    {"type": "has_item", "item_id": 14, "description": "情報碎片 4/5 (23)"},
    {"type": "has_item", "item_id": 15, "description": "情報碎片 5/5 (44)"}
  ],
  "all_required": true,
  "success_message": "你已收集完整5個情報碎片!",
  "failure_message": "你還沒有收集完整所有情報碎片"
}', 2, NOW()),

(1, 13, 'text_verify', '破解最終密碼', '{
  "question": "將5個情報碎片組合,輸入最終密碼(8位數字:年份+日期)",
  "correct_answer": "19580823",
  "hint": "1958年8月23日是823砲戰開始的日子",
  "max_attempts": 3,
  "on_success": {
    "message": "密碼正確!你解鎖了賈村的歷史檔案",
    "unlock_content": "history_archive"
  }
}', 3, NOW());

-- 關卡 15 的頁面 (榮譽頒獎)
INSERT INTO pages (
  game_id,
  location_id,
  type,
  title,
  content,
  order_index,
  created_at
) VALUES
(1, 15, 'story', '頒獎典禮', '{
  "text": "恭喜你完成了賈村民兵特訓計畫!你已經從一名新兵,成長為一名合格的民兵。",
  "image_url": "/images/locations/award-ceremony.jpg",
  "audio_url": "/audio/award-ceremony.mp3"
}', 1, NOW()),

(1, 15, 'video', '回顧影片', '{
  "video_url": "/videos/game-recap.mp4",
  "duration": 180,
  "thumbnail_url": "/images/thumbnails/game-recap.jpg",
  "description": "回顧你的特訓歷程"
}', 2, NOW()),

(1, 15, 'button', '查看成績', '{
  "buttons": [
    {
      "text": "查看總積分",
      "action": "show_score",
      "params": {}
    },
    {
      "text": "查看排行榜",
      "action": "show_leaderboard",
      "params": {}
    },
    {
      "text": "下載證書",
      "action": "download_certificate",
      "params": {}
    },
    {
      "text": "分享成績",
      "action": "share_score",
      "params": {}
    }
  ]
}', 3, NOW());

-- ============================================
-- 5. 建立成就系統
-- ============================================

INSERT INTO achievements (
  game_id,
  name,
  description,
  type,
  icon_url,
  points_reward,
  condition,
  created_at
) VALUES
(1, '神槍手預備役', '完成射擊訓練', 'location', '/images/achievements/sharpshooter.png', 50, '{"location_id": 2}', NOW()),
(1, '地道探險家', '探索地下隧道', 'location', '/images/achievements/explorer.png', 50, '{"location_id": 4}', NOW()),
(1, '壕溝戰士', '完成戰壕體驗', 'location', '/images/achievements/trench-warrior.png', 50, '{"location_id": 6}', NOW()),
(1, '化武防護專家', '通過毒氣室訓練', 'location', '/images/achievements/cbrn-expert.png', 50, '{"location_id": 9}', NOW()),
(1, '同袍情誼', '完成團隊協作任務', 'special', '/images/achievements/teamwork.png', 100, '{"location_id": 11}', NOW()),
(1, '情報高手', '破解最終密碼', 'special', '/images/achievements/intelligence.png', 100, '{"location_id": 13}', NOW()),
(1, '賈村衛士', '完成最終考驗', 'special', '/images/achievements/guardian.png', 150, '{"location_id": 14}', NOW()),
(1, '金門衛士', '以最高榮譽完成遊戲', 'legendary', '/images/achievements/kinmen-guardian.png', 300, '{"total_points": 2000, "time_limit": 7200}', NOW()),
(1, '完美民兵', '所有關卡滿分', 'legendary', '/images/achievements/perfect.png', 500, '{"all_locations_perfect": true}', NOW()),
(1, '收藏家', '收集所有道具', 'collection', '/images/achievements/collector.png', 200, '{"all_items_collected": true}', NOW()),
(1, '速度之星', '2小時內完成遊戲', 'speed', '/images/achievements/speedster.png', 200, '{"time_limit": 7200}', NOW()),
(1, '探索者', '到訪所有地點', 'exploration', '/images/achievements/explorer-master.png', 150, '{"all_locations_visited": true}', NOW());

-- ============================================
-- 6. 建立導覽內容
-- ============================================

INSERT INTO location_guides (
  location_id,
  title,
  content,
  audio_url,
  duration,
  language,
  created_at
) VALUES
-- 關卡 1 導覽
(1, '賈村民兵訓練基地簡介', '歡迎來到賈村民兵訓練基地!這裡是金門前線的重要據點,自1949年起就肩負著保衛家園的重任。在接下來的訓練中,你將體驗真實的民兵生活,學習戰地技能。記住,每一個任務都很重要,它們將決定你是否能成為一名合格的民兵。現在,讓我們開始你的特訓之旅!', '/audio/guides/location-01.mp3', 60, 'zh-TW', NOW()),

-- 關卡 2 導覽
(2, '歸零靶場的故事', '歸零射擊是每位民兵必修的基本功。所謂「歸零」,就是校準槍械瞄準具與實際彈著點的偏差,確保每一發子彈都能精準命中目標。在戰場上,一發子彈的偏差可能就是生與死的差別。這座靶場建於1960年代,見證了無數民兵的成長。牆上的彈孔,是歷史的印記,也是前輩們留下的訓練痕跡。', '/audio/guides/location-02.mp3', 60, 'zh-TW', NOW()),

-- 關卡 3 導覽
(3, '關公廟的信仰', '在戰火頻仍的年代,信仰是民兵們的精神支柱。關公以忠義聞名,成為賈村民兵的守護神。每次出任務前,民兵們都會來此祈求平安。這座廟建於1952年,由當時的民兵們親手搭建。廟中的香火從未間斷,見證了賈村70年的歷史。仔細觀察廟中的細節,你會發現許多歷史的線索...', '/audio/guides/location-03.mp3', 60, 'zh-TW', NOW()),

-- 關卡 4 導覽
(4, '地下防禦網絡', '賈村的地下隧道系統是冷戰時期的重要防禦工事。這些隧道縱橫交錯,連接各個重要據點,可在砲擊時提供掩護,也能作為快速移動的通道。隧道內冬暖夏涼,但環境潮濕陰暗。當年的民兵們在這裡度過無數個緊張的夜晚,隨時準備應對突發狀況。', '/audio/guides/location-04.mp3', 60, 'zh-TW', NOW()),

-- 關卡 5 導覽
(5, '戰略要地', '這個出口的位置經過精心設計,既隱蔽又便於觀察。從這裡可以快速到達多個重要據點,是整個防禦體系的關鍵節點。在緊急狀況下,民兵們可以從這裡迅速部署到各個防禦位置。出口的朝向也有講究,能最大程度地減少被發現的風險。', '/audio/guides/location-05.mp3', 45, 'zh-TW', NOW()),

-- 關卡 6 導覽
(6, '壕溝中的生活', '這些蜿蜒的壕溝是前線民兵的第二個家。在砲擊最激烈的日子裡,民兵們可能要在這裡待上數天。壕溝提供了基本的掩護,但環境艱苦 - 夏天悶熱,冬天濕冷,隨時要警戒敵情。壕溝的設計呈之字形,這樣即使敵人攻入,也無法直接射擊整條壕溝。每一個轉角都可能是生死關頭。', '/audio/guides/location-06.mp3', 60, 'zh-TW', NOW()),

-- 關卡 7 導覽
(7, '後勤的重要性', '「兵馬未動,糧草先行」,補給是戰爭勝負的關鍵。這間商店在當年是民兵們的重要補給點,提供食物、飲水、彈藥等必需品。在物資匱乏的年代,每一份補給都彌足珍貴。民兵們學會了節約、互助,確保每個人都能得到基本的生存保障。', '/audio/guides/location-07.mp3', 45, 'zh-TW', NOW()),

-- 關卡 8 導覽
(8, '手榴彈投擲訓練', '手榴彈是步兵的重要武器,特別是在近距離作戰中。正確的投擲技巧不僅能提高命中率,更能確保自身安全。投擲要領:拉環、甩臂、出手、臥倒。每一個動作都要精準流暢,容不得半點馬虎。這個訓練場見證了無數民兵從生疏到熟練的過程。', '/audio/guides/location-08.mp3', 50, 'zh-TW', NOW()),

-- 關卡 9 導覽
(9, '化學武器防護', '毒氣室訓練是民兵必修課程之一。在這裡,民兵們學習如何正確佩戴防毒面具,如何在化學武器攻擊下保護自己和戰友。訓練過程雖然艱苦,但卻能救命。防毒面具的每一個步驟都不能錯 - 檢查、佩戴、密合測試、呼吸調整。在真實戰場上,這些知識就是生存的保障。', '/audio/guides/location-09.mp3', 60, 'zh-TW', NOW()),

-- 關卡 10 導覽
(10, '六號樓的秘密', '六號樓是賈村最具代表性的建築之一,建於1960年代。這棟樓曾是指揮中心,也是民兵們的宿舍。牆上的彈孔、斑駁的標語,都訴說著那段烽火歲月。據說六號樓裡藏有一份重要的歷史文件,記錄了823砲戰時賈村民兵的英勇事蹟。只有破解建築中的密碼,才能找到這份珍貴的資料...', '/audio/guides/location-10.mp3', 60, 'zh-TW', NOW());

-- ============================================
-- 7. 更新 GPS 座標的 SQL 範例
-- ============================================

-- 當您在現場測量完座標後,可以使用以下 SQL 更新:

-- UPDATE locations SET 
--   latitude = 24.432400, 
--   longitude = 118.378600 
-- WHERE id = 1;  -- 關卡 1: 新兵報到

-- UPDATE locations SET 
--   latitude = 24.432500, 
--   longitude = 118.378700 
-- WHERE id = 2;  -- 關卡 2: 歸零射擊

-- ... 依此類推更新所有關卡的座標

-- ============================================
-- 8. 建立遊戲設定
-- ============================================

INSERT INTO game_settings (
  game_id,
  key,
  value,
  description,
  created_at
) VALUES
(1, 'time_limit', '10800', '遊戲時間限制(秒),3小時', NOW()),
(1, 'enable_hints', 'true', '是否啟用提示功能', NOW()),
(1, 'enable_skip', 'true', '是否允許跳過關卡', NOW()),
(1, 'max_skip_count', '1', '最多可跳過的關卡數', NOW()),
(1, 'enable_team_mode', 'true', '是否啟用團隊模式', NOW()),
(1, 'min_team_size', '1', '最小團隊人數', NOW()),
(1, 'max_team_size', '10', '最大團隊人數', NOW()),
(1, 'enable_leaderboard', 'true', '是否啟用排行榜', NOW()),
(1, 'enable_achievements', 'true', '是否啟用成就系統', NOW()),
(1, 'enable_photo_tasks', 'true', '是否啟用拍照任務', NOW()),
(1, 'enable_qr_scan', 'true', '是否啟用QR Code掃描', NOW()),
(1, 'gps_accuracy_threshold', '20', 'GPS精度閾值(公尺)', NOW()),
(1, 'location_update_interval', '5', '位置更新間隔(秒)', NOW());

-- ============================================
-- 完成!
-- ============================================

-- 此檔案包含完整的遊戲資料
-- GPS 座標可在現場測量後使用 UPDATE 語句更新
-- 所有關卡、道具、頁面、成就、導覽內容都已建立
-- 可直接匯入 Supabase 或其他 PostgreSQL 資料庫
