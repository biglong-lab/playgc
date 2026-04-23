-- ═══ JIACHUN 賈村競技場：全部模組啟用 + 射擊/戰術 highlights ═══
UPDATE fields SET settings = settings || jsonb_build_object(
  'enableShootingMission', true,
  'enableBattleArena', true,
  'enableChapters', true,
  'enablePhotoMission', true,
  'enableGpsMission', true,
  'enableTeamMode', true,
  'enableCompetitiveMode', true,
  'tagline', '金門賈村 · 戰術沉浸式體驗',
  'highlights', jsonb_build_array(
    jsonb_build_object('icon', 'Target', 'title', '射擊挑戰', 'description', '使用實體靶機進行射擊任務'),
    jsonb_build_object('icon', 'MapPin', 'title', 'GPS 導航', 'description', '跟隨地圖指引探索場域'),
    jsonb_build_object('icon', 'Camera', 'title', '拍照任務', 'description', '用相機記錄你的發現'),
    jsonb_build_object('icon', 'Users', 'title', '團隊協作', 'description', '與隊友即時溝通完成任務'),
    jsonb_build_object('icon', 'Swords', 'title', '水彈對戰', 'description', '多人 PK 擂台，排名爭霸')
  )
) WHERE code = 'JIACHUN';

-- ═══ HPSPACE 後浦金城：人文歷史模組（不啟用射擊/對戰）═══
UPDATE fields SET settings = settings || jsonb_build_object(
  'enableShootingMission', false,
  'enableBattleArena', false,
  'enableChapters', true,
  'enablePhotoMission', true,
  'enableGpsMission', true,
  'enableTeamMode', true,
  'enableCompetitiveMode', true,
  'tagline', '金門後浦 · 人文歷史走讀',
  'highlights', jsonb_build_array(
    jsonb_build_object('icon', 'Landmark', 'title', '歷史巡禮', 'description', '走訪後浦老街的古厝與史蹟'),
    jsonb_build_object('icon', 'Compass', 'title', '巷弄探索', 'description', 'GPS 導引深入在地巷弄'),
    jsonb_build_object('icon', 'Camera', 'title', '拍照打卡', 'description', '記錄古城的光影與風情'),
    jsonb_build_object('icon', 'Puzzle', 'title', '解謎任務', 'description', '結合史料的實境推理')
  )
) WHERE code = 'HPSPACE';
