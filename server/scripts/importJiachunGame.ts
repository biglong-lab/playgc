import { db } from "../db";
import { games, locations, items, pages, achievements } from "@shared/schema";
import { sql } from "drizzle-orm";

const GAME_ID = "jiachun-defense-battle";

async function importJiachunGame() {
  console.log("Starting Jiachun Defense Battle game import...");

  try {
    const [existingGame] = await db.select().from(games).where(sql`${games.id} = ${GAME_ID}`);
    if (existingGame) {
      console.log("Game already exists, skipping import.");
      return;
    }

    console.log("Creating game...");
    await db.insert(games).values({
      id: GAME_ID,
      title: "賈村保衛戰:民兵特訓計畫",
      description: "1958年8月23日前夕,金門前線情勢緊張。玩家扮演新進民兵,必須完成15項特訓任務,學習戰地技能、探索基地設施、破解軍事密碼,最終取得「合格民兵」資格。",
      difficulty: "medium",
      estimatedTime: 180,
      maxPlayers: 50,
      status: "published",
      coverImageUrl: "/images/games/jiachun-cover.jpg",
    });

    console.log("Creating 15 game locations...");
    const locationData = [
      { name: "新兵報到", description: "抵達賈村入口,接受訓練基地老班長的任務簡報,領取虛擬裝備開始特訓之旅。", locationType: "checkpoint", radius: 15, points: 50, orderIndex: 1, qrCodeData: "JIACHUN_CHECKPOINT_01", isRequired: true },
      { name: "歸零射擊", description: "學習基礎射擊技巧,完成歸零校準訓練。了解歸零射擊的原理與重要性。", locationType: "task", radius: 20, points: 100, orderIndex: 2, qrCodeData: "JIACHUN_SHOOTING_RANGE_01", isRequired: true, unlockCondition: { required_locations: [1] } },
      { name: "關公護佑", description: "探索賈村的精神寄託 - 關公廟,解開廟中的密碼謎題,獲得第一個情報碎片。", locationType: "puzzle", radius: 15, points: 150, orderIndex: 3, qrCodeData: "JIACHUN_TEMPLE_01", isRequired: true, unlockCondition: { required_locations: [2] } },
      { name: "地下秘道", description: "發現賈村的地下防禦系統,進入神秘的地下隧道入口。", locationType: "exploration", radius: 10, points: 120, orderIndex: 4, qrCodeData: "JIACHUN_TUNNEL_ENTRANCE", isRequired: true, unlockCondition: { required_locations: [3] } },
      { name: "隧道出口", description: "找到隧道的另一個出口,完成地下路線的探索,獲得第二個情報碎片。", locationType: "checkpoint", radius: 10, points: 100, orderIndex: 5, qrCodeData: "JIACHUN_TUNNEL_EXIT", isRequired: true, unlockCondition: { required_locations: [4] } },
      { name: "戰壕體驗", description: "體驗真實的戰壕環境,了解前線民兵的戰鬥生活,完成情境選擇挑戰。", locationType: "experience", radius: 15, points: 150, orderIndex: 6, qrCodeData: "JIACHUN_TRENCH_01", isRequired: true, unlockCondition: { required_locations: [5] } },
      { name: "補給站", description: "到達補給站,補充體力,了解後勤補給的重要性。可使用積分兌換虛擬道具。", locationType: "item", radius: 15, points: 80, orderIndex: 7, qrCodeData: "JIACHUN_SHOP_01", isRequired: true, unlockCondition: { required_locations: [6] } },
      { name: "手榴彈訓練", description: "學習手榴彈投擲技巧,完成模擬訓練,獲得第三個情報碎片。", locationType: "task", radius: 20, points: 150, orderIndex: 8, qrCodeData: "JIACHUN_GRENADE_AREA", isRequired: true, unlockCondition: { required_locations: [7] } },
      { name: "毒氣防護", description: "了解化學武器防護知識,體驗毒氣室訓練,完成防護知識測驗。", locationType: "experience", radius: 15, points: 150, orderIndex: 9, qrCodeData: "JIACHUN_GAS_CHAMBER", isRequired: true, unlockCondition: { required_locations: [8] } },
      { name: "六號樓探索", description: "探索神秘的六號樓,解開建築中隱藏的秘密,獲得第四個情報碎片。", locationType: "puzzle", radius: 15, points: 150, orderIndex: 10, qrCodeData: "JIACHUN_BUILDING_06", isRequired: true, unlockCondition: { required_locations: [9] } },
      { name: "團隊協作", description: "需要多人協作完成的團隊挑戰,發揮團隊精神共同解決問題。", locationType: "team", radius: 20, points: 200, orderIndex: 11, qrCodeData: "JIACHUN_TEAM_CHALLENGE", isRequired: true, unlockCondition: { required_locations: [10], min_players: 2 } },
      { name: "夜間巡邏", description: "按照指定路線完成巡邏任務,依序通過3個檢查點,獲得第五個情報碎片。", locationType: "checkpoint", radius: 10, points: 150, orderIndex: 12, qrCodeData: "JIACHUN_PATROL_START", isRequired: true, unlockCondition: { required_locations: [11] } },
      { name: "密碼破譯", description: "收集5個情報碎片,破解最終密碼,解鎖賈村的歷史檔案。", locationType: "puzzle", radius: 15, points: 200, orderIndex: 13, qrCodeData: "JIACHUN_COMMAND_CENTER", isRequired: true, unlockCondition: { required_locations: [12], required_items: ["intel_1", "intel_2", "intel_3", "intel_4", "intel_5"] } },
      { name: "最終考驗", description: "綜合前面所學,完成最終的民兵資格考驗,通過綜合測驗與虛擬演練。", locationType: "task", radius: 20, points: 300, orderIndex: 14, qrCodeData: "JIACHUN_FINAL_TEST", isRequired: true, unlockCondition: { required_locations: [13] } },
      { name: "榮譽頒獎", description: "完成所有訓練,接受榮譽表彰,查看最終成績與排行榜。", locationType: "finish", radius: 15, points: 0, orderIndex: 15, qrCodeData: "JIACHUN_AWARD_CEREMONY", isRequired: true, unlockCondition: { required_locations: [14] } },
    ];

    for (const loc of locationData) {
      await db.insert(locations).values({
        gameId: GAME_ID,
        ...loc,
      });
    }

    console.log("Creating game items...");
    const itemData = [
      { name: "民兵識別證", description: "證明你是賈村民兵的身份證明", itemType: "equipment", iconUrl: "/images/items/id-card.png" },
      { name: "任務地圖", description: "顯示所有關卡位置的地圖", itemType: "equipment", iconUrl: "/images/items/map.png" },
      { name: "通訊器", description: "與指揮中心保持聯繫的通訊設備", itemType: "equipment", iconUrl: "/images/items/radio.png" },
      { name: "射擊徽章", description: "完成射擊訓練獲得的榮譽徽章", itemType: "badge", iconUrl: "/images/items/shooting-badge.png" },
      { name: "護身符", description: "關公廟獲得的護身符,保佑平安", itemType: "special", iconUrl: "/images/items/amulet.png" },
      { name: "手電筒", description: "探索地下隧道必備的照明工具", itemType: "equipment", iconUrl: "/images/items/flashlight.png" },
      { name: "指南針", description: "辨識方向的導航工具", itemType: "equipment", iconUrl: "/images/items/compass.png" },
      { name: "鋼盔", description: "戰壕體驗獲得的防護裝備", itemType: "equipment", iconUrl: "/images/items/helmet.png" },
      { name: "防毒面具", description: "化學武器防護裝備", itemType: "equipment", iconUrl: "/images/items/gas-mask.png" },
      { name: "六號樓鑰匙", description: "開啟六號樓秘密的鑰匙", itemType: "key", iconUrl: "/images/items/key.png" },
      { name: "團隊徽章", description: "完成團隊任務獲得的榮譽", itemType: "badge", iconUrl: "/images/items/team-badge.png" },
      { name: "巡邏日誌", description: "記錄巡邏路線的日誌", itemType: "document", iconUrl: "/images/items/patrol-log.png" },
      { name: "情報碎片 1/5", description: "關公廟獲得的情報碎片:19", itemType: "intel", iconUrl: "/images/items/intel-1.png", effect: { intel_code: "19" } },
      { name: "情報碎片 2/5", description: "隧道出口獲得的情報碎片:58", itemType: "intel", iconUrl: "/images/items/intel-2.png", effect: { intel_code: "58" } },
      { name: "情報碎片 3/5", description: "手榴彈區獲得的情報碎片:08", itemType: "intel", iconUrl: "/images/items/intel-3.png", effect: { intel_code: "08" } },
      { name: "情報碎片 4/5", description: "六號樓獲得的情報碎片:23", itemType: "intel", iconUrl: "/images/items/intel-4.png", effect: { intel_code: "23" } },
      { name: "情報碎片 5/5", description: "巡邏任務獲得的情報碎片:44", itemType: "intel", iconUrl: "/images/items/intel-5.png", effect: { intel_code: "44" } },
      { name: "提示卡", description: "提供解謎提示", itemType: "consumable", iconUrl: "/images/items/hint-card.png", effect: { type: "hint" } },
      { name: "時間延長卡", description: "延長遊戲時間30分鐘", itemType: "consumable", iconUrl: "/images/items/time-card.png", effect: { type: "time_extension", minutes: 30 } },
      { name: "能量補給包", description: "加速完成下一個任務", itemType: "consumable", iconUrl: "/images/items/energy-pack.png", effect: { type: "speed_boost" } },
      { name: "跳過卡", description: "跳過一個困難關卡(限用1次)", itemType: "consumable", iconUrl: "/images/items/skip-card.png", effect: { type: "skip", max_use: 1 } },
    ];

    for (const item of itemData) {
      await db.insert(items).values({
        gameId: GAME_ID,
        ...item,
      });
    }

    console.log("Creating game pages...");
    const pageData = [
      { pageOrder: 1, pageType: "text_card", config: { title: "新兵報到", text: "歡迎來到賈村民兵訓練基地!這裡是金門前線的重要據點,自1949年起就肩負著保衛家園的重任。", imageUrl: "/images/locations/entrance.jpg", audioUrl: "/audio/welcome.mp3" } },
      { pageOrder: 2, pageType: "dialogue", config: { speaker: "老班長", avatarUrl: "/images/characters/sergeant.png", text: "新兵,情勢緊急!敵軍可能在近日發動攻擊。你必須立即展開特訓,完成15項任務,才能成為一名合格的民兵。記住,每一個任務都很重要!", prompt: "選擇你的回應", buttons: [{ text: "是!保證完成任務!", rewardPoints: 10 }, { text: "我準備好了!", rewardPoints: 10 }] } },
      { pageOrder: 3, pageType: "button", config: { prompt: "領取你的裝備", buttons: [{ text: "領取民兵識別證", action: "grant_item", itemId: 1 }, { text: "領取任務地圖", action: "grant_item", itemId: 2 }, { text: "領取通訊器", action: "grant_item", itemId: 3 }, { text: "開始特訓", action: "complete_location" }] } },
      { pageOrder: 4, pageType: "text_card", config: { title: "歸零靶場", text: "歸零射擊是每位民兵必修的基本功。所謂「歸零」,就是校準槍械瞄準具與實際彈著點的偏差,確保每一發子彈都能精準命中目標。", imageUrl: "/images/locations/shooting-range.jpg" } },
      { pageOrder: 5, pageType: "video", config: { title: "射擊教學", videoUrl: "/videos/shooting-tutorial.mp4", duration: 120, thumbnailUrl: "/images/thumbnails/shooting-tutorial.jpg" } },
      { pageOrder: 6, pageType: "text_verify", config: { title: "射擊訓練", question: "完成虛擬射擊訓練,達到80分以上", correctAnswer: "complete", hint: "點擊螢幕上的靶心進行射擊", maxAttempts: 3 } },
      { pageOrder: 7, pageType: "text_card", config: { title: "關公廟的信仰", text: "在戰火頻仍的年代,信仰是民兵們的精神支柱。關公以忠義聞名,成為賈村民兵的守護神。廟中藏有重要的歷史線索...", imageUrl: "/images/locations/temple.jpg" } },
      { pageOrder: 8, pageType: "text_verify", config: { title: "破解密碼", question: "仔細觀察廟中的對聯、匾額、香爐,找出四位數密碼(提示:與823砲戰有關)", correctAnswer: "1958", hint: "對聯中藏有年份,匾額上的字數有玄機,香爐上的銘文是關鍵", maxAttempts: 3, onSuccess: { grantItem: 13, message: "恭喜!你獲得了情報碎片 1/5" } } },
      { pageOrder: 9, pageType: "text_card", config: { title: "化學武器防護", text: "毒氣室訓練是民兵必修課程之一。在這裡,民兵們學習如何正確佩戴防毒面具,如何在化學武器攻擊下保護自己和戰友。", imageUrl: "/images/locations/gas-chamber.jpg" } },
      { pageOrder: 10, pageType: "choice_verify", config: { title: "防護知識測驗", questions: [
        { question: "發現毒氣攻擊時,第一步應該做什麼?", options: ["立即佩戴防毒面具", "大聲呼喊", "尋找水源"], correctAnswer: 0 },
        { question: "防毒面具的密合測試方法是?", options: ["用手掌蓋住濾罐,吸氣測試", "用力呼氣", "搖晃頭部"], correctAnswer: 0 },
        { question: "毒氣的特性是?", options: ["比空氣重,會沉積在低處", "比空氣輕,會飄散到高處", "與空氣密度相同"], correctAnswer: 0 },
        { question: "在毒氣環境中,應該如何移動?", options: ["往高處移動,遠離低窪地", "往低處移動", "原地不動"], correctAnswer: 0 },
        { question: "防毒面具可以持續使用多久?", options: ["視濾罐類型,通常4-8小時", "無限期", "30分鐘"], correctAnswer: 0 },
      ], passingScore: 0.6, onSuccess: { grantItem: 9, message: "恭喜!你獲得了防毒面具" } } },
      { pageOrder: 11, pageType: "text_card", config: { title: "指揮中心", text: "這裡是賈村的大腦,所有重要決策都在此做出。你收集的情報碎片記錄了823砲戰期間,賈村民兵的英勇事蹟。", imageUrl: "/images/locations/command-center.jpg" } },
      { pageOrder: 12, pageType: "conditional_verify", config: { title: "組合情報", conditions: [
        { type: "has_item", itemId: 13, description: "情報碎片 1/5 (19)" },
        { type: "has_item", itemId: 14, description: "情報碎片 2/5 (58)" },
        { type: "has_item", itemId: 15, description: "情報碎片 3/5 (08)" },
        { type: "has_item", itemId: 16, description: "情報碎片 4/5 (23)" },
        { type: "has_item", itemId: 17, description: "情報碎片 5/5 (44)" },
      ], allRequired: true, successMessage: "你已收集完整5個情報碎片!", failureMessage: "你還沒有收集完整所有情報碎片" } },
      { pageOrder: 13, pageType: "text_verify", config: { title: "破解最終密碼", question: "將5個情報碎片組合,輸入最終密碼(8位數字:年份+日期)", correctAnswer: "19580823", hint: "1958年8月23日是823砲戰開始的日子", maxAttempts: 3, onSuccess: { message: "密碼正確!你解鎖了賈村的歷史檔案", unlockContent: "history_archive" } } },
      { pageOrder: 14, pageType: "text_card", config: { title: "頒獎典禮", text: "恭喜你完成了賈村民兵特訓計畫!你已經從一名新兵,成長為一名合格的民兵。", imageUrl: "/images/locations/award-ceremony.jpg" } },
      { pageOrder: 15, pageType: "video", config: { title: "回顧影片", videoUrl: "/videos/game-recap.mp4", duration: 180, thumbnailUrl: "/images/thumbnails/game-recap.jpg", description: "回顧你的特訓歷程" } },
      { pageOrder: 16, pageType: "button", config: { prompt: "查看你的成績", buttons: [{ text: "查看總積分", action: "show_score" }, { text: "查看排行榜", action: "show_leaderboard" }, { text: "下載證書", action: "download_certificate" }, { text: "分享成績", action: "share_score" }] } },
    ];

    for (const page of pageData) {
      await db.insert(pages).values({
        gameId: GAME_ID,
        ...page,
      });
    }

    console.log("Creating achievements...");
    const achievementData = [
      { name: "神槍手預備役", description: "完成射擊訓練", achievementType: "location", iconUrl: "/images/achievements/sharpshooter.png", points: 50, condition: { location_id: 2 } },
      { name: "地道探險家", description: "探索地下隧道", achievementType: "location", iconUrl: "/images/achievements/explorer.png", points: 50, condition: { location_id: 4 } },
      { name: "壕溝戰士", description: "完成戰壕體驗", achievementType: "location", iconUrl: "/images/achievements/trench-warrior.png", points: 50, condition: { location_id: 6 } },
      { name: "化武防護專家", description: "通過毒氣室訓練", achievementType: "location", iconUrl: "/images/achievements/cbrn-expert.png", points: 50, condition: { location_id: 9 } },
      { name: "同袍情誼", description: "完成團隊協作任務", achievementType: "special", iconUrl: "/images/achievements/teamwork.png", points: 100, condition: { location_id: 11 } },
      { name: "情報高手", description: "破解最終密碼", achievementType: "special", iconUrl: "/images/achievements/intelligence.png", points: 100, condition: { location_id: 13 } },
      { name: "民兵合格", description: "完成所有15項訓練", achievementType: "legendary", iconUrl: "/images/achievements/qualified.png", points: 200, condition: { all_locations_completed: true } },
      { name: "速度之星", description: "在2小時內完成所有任務", achievementType: "speed", iconUrl: "/images/achievements/speed.png", points: 150, condition: { completion_time_under_minutes: 120 } },
      { name: "完美主義者", description: "獲得所有道具", achievementType: "collection", iconUrl: "/images/achievements/collector.png", points: 100, condition: { all_items_collected: true } },
      { name: "歷史學家", description: "解鎖所有歷史檔案", achievementType: "exploration", iconUrl: "/images/achievements/historian.png", points: 100, condition: { unlock_all_archives: true } },
    ];

    for (const achievement of achievementData) {
      await db.insert(achievements).values({
        gameId: GAME_ID,
        ...achievement,
      });
    }

    console.log("Jiachun Defense Battle game imported successfully!");
    console.log(`Game ID: ${GAME_ID}`);
    console.log("15 locations, 21 items, 16 pages, 10 achievements created.");
  } catch (error) {
    console.error("Error importing game:", error);
    throw error;
  }
}

importJiachunGame();
