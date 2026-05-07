// 各頁面類型的預設設定值
// 對齊 shared/schema/games.ts 的最新 Config 型別，補齊本輪擴充的欄位

export function getDefaultConfig(pageType: string): Record<string, unknown> {
  switch (pageType) {
    case "text_card":
      return {
        title: "新標題",
        content: "在這裡輸入內容...",
        layout: "center",
        animation: "fade_in",
        fontSize: "medium",
        rewardPoints: 0,
      };
    case "dialogue":
      return {
        character: { name: "角色名稱" },
        messages: [{ text: "對話內容...", emotion: "neutral" }],
        typingSpeed: 30,
        autoAdvance: false,
        bubbleAnimation: true,
        showEmotionIndicator: false,
        rewardPoints: 0,
      };
    case "video":
      return {
        videoUrl: "",
        autoPlay: true,
        skipEnabled: true,
        forceWatch: false,
        autoCompleteOnEnd: false,
        rewardPoints: 0,
      };
    case "button":
      return {
        prompt: "請選擇一個選項",
        buttons: [
          { text: "選項 1", nextPageId: undefined, rewardPoints: 0 },
          { text: "選項 2", nextPageId: undefined, rewardPoints: 0 },
        ],
        randomizeOrder: false,
      };
    case "text_verify":
      return {
        question: "問題?",
        answers: ["答案"],
        inputType: "text",
        caseSensitive: false,
        maxAttempts: 5,
        rewardPoints: 10,
      };
    case "choice_verify":
      return {
        question: "問題?",
        options: [
          { text: "選項 A", correct: true },
          { text: "選項 B", correct: false },
        ],
        randomizeOptions: false,
        multiple: false,
        showExplanation: false,
        rewardPerQuestion: 10,
      };
    case "choice_verify_race": // 多人搶答（用 questions[] 多題模式）
      return {
        title: "隊伍搶答",
        questions: [
          {
            question: "範例題目（請編輯）",
            options: ["選項 A", "選項 B", "選項 C", "選項 D"],
            correctAnswer: 0,
          },
        ],
        rewardPerQuestion: 10,
        timeLimit: 30,
      };
    case "conditional_verify":
      return {
        title: "碎片收集",
        instruction: "收集所有碎片，組成正確的密碼",
        fragmentType: "numbers",
        fragmentCount: 0,
        // 預設不產生碎片 — 避免管理員漏填 sourceItemId 造成裸破關
        // 管理員需手動調整 fragmentCount 並為每個 fragment 綁定 sourceItemId
        fragments: [],
        targetCode: "",
        verificationMode: "order_matters",
        conditions: [],
        allRequired: true,
        rewardPoints: 30,
      };
    case "shooting_mission":
    case "shooting_team": // 多人版共用 config schema
      return {
        requiredHits: 5,
        timeLimit: 60,
        allowSimulation: false,
      };
    case "photo_mission":
      return {
        instruction: "請拍攝...",
        aiVerify: false,
      };
    case "photo_ocr":
      return {
        title: "招牌辨識任務",
        description: "拍下指定招牌",
        ocrConfig: {
          expectedTexts: [],
          fuzzyThreshold: 0.7,
          instruction: "請靠近招牌拍攝，確保文字清晰",
          allowRetryOnFail: true,
          maxRetries: 3,
        },
        rewardPoints: 30,
      };
    case "gps_mission":
    case "gps_team_mission": // 多人版共用 config schema
      return {
        targetLocation: { lat: 25.033, lng: 121.565 },
        radius: 50,
        instruction: "前往目標位置",
        hotZoneHints: true,
        proximitySound: false,
        showMap: false,
        qrFallback: false,
      };
    case "qr_scan":
      return {
        qrCodeId: "QR-001",
        primaryCode: "QR-001",
        validationMode: "case_insensitive",
      };
    case "time_bomb":
      return {
        title: "拆彈任務",
        timeLimit: 60,
        tasks: [{ type: "tap", question: "快速點擊按鈕!", targetCount: 10 }],
        rewardPoints: 50,
        penaltySeconds: 0,
      };
    case "lock":
      return {
        title: "密碼鎖",
        lockType: "number",
        combination: "1234",
        digits: 4,
        maxAttempts: 5,
        rewardPoints: 20,
      };
    case "motion_challenge":
      return {
        title: "體感挑戰",
        challengeType: "shake",
        targetValue: 20,
        timeLimit: 30,
        rewardPoints: 15,
      };
    // 🆕 2026-05-07：手電筒元件
    case "flashlight":
      return {
        title: "點亮手電筒",
        description: "請點亮手電筒、看清楚周圍環境",
        requiredOnSeconds: 0, // 0 = 點一下就完成
        rewardPoints: 5,
      };
    case "vote":
    case "vote_team": // 多人版共用 config schema
      return {
        title: pageType === "vote_team" ? "隊伍投票（即時同步）" : "投票",
        question: "請選擇你的答案",
        options: [{ text: "選項一" }, { text: "選項二" }],
        showResults: true,
        anonymousVoting: true,
        nextPageStrategy: "winner",
        autoAdvanceSeconds: 5,
      };
    case "flow_router":
      return {
        mode: "conditional",
        routes: [],
      };
    // 互動模組庫（2026-05-06）— 21 個跨情境通用元件
    // 共用 config schema：title (標題) + prompt (引導語)
    case "spot_vote":
      return { title: "現場投票", prompt: "你的選擇是？" };
    case "team_dream":
      return { title: "團隊願景", prompt: "寫下你心中的團隊未來藍圖" };
    case "group_nickname":
      return { title: "隊伍命名", prompt: "為你們的隊伍取一個有故事的名字" };
    case "activity_memo":
      return { title: "活動筆記", prompt: "今天最有印象的事是什麼？" };
    case "peer_praise":
      return { title: "同伴讚美", prompt: "把讚美送給今天打動你的夥伴" };
    case "scale_check":
      return { title: "心情尺度", prompt: "現在的你，狀態是幾分？" };
    case "venue_rating":
      return { title: "場地評分", prompt: "今天的場地給你什麼感受？" };
    case "micro_commit":
      return { title: "微承諾", prompt: "今天回家後，你願意做的一件小事是？" };
    case "closing_thought":
      return { title: "結語", prompt: "用一句話帶走今天的收穫" };
    case "gift_to_team":
      return { title: "給隊伍的禮物", prompt: "你想留給隊伍的一份禮物是什麼？" };
    case "ability_badge":
      return { title: "能力徽章", prompt: "為夥伴頒一枚最適合的能力徽章" };
    case "wedding_vow":
      return { title: "婚禮祝福卡", prompt: "送給新人最真誠的祝福" };
    case "birthday_candle":
      return { title: "生日許願", prompt: "為壽星點一根蠟燭，許下最美的心願" };
    case "award_ceremony":
      return { title: "頒獎典禮", prompt: "今天最該被表揚的人是？" };
    case "gratitude_tree":
      return { title: "感恩之樹", prompt: "把感謝寫成一片葉子，掛上感恩之樹" };
    case "dinner_table":
      return { title: "餐桌話題", prompt: "選一個今晚想聊的話題" };
    case "high_low_card":
      return { title: "高低時刻", prompt: "今天的高峰與低谷分別是？" };
    case "role_board":
      return { title: "角色板", prompt: "你在隊伍中扮演什麼角色？" };
    case "discovery_card":
      return { title: "發現卡", prompt: "今天的最大發現是什麼？" };
    case "flag_design":
      return { title: "隊旗設計", prompt: "為你們的隊伍設計一面旗幟" };
    case "party_menu":
      return { title: "派對選單", prompt: "選出今晚最想要的派對元素" };
    // 階段 B 精選互動工具（2026-05-06）— 30 個
    case "jigsaw_puzzle":
      return { title: "拼圖協作", pieces: 9, timeLimit: 300 };
    case "treasure_hunt":
      return { title: "尋寶任務", clues: [], timeLimit: 600 };
    case "gps_cascade":
      return { title: "GPS 連鎖", checkpoints: [], radius: 30 };
    case "collective_score":
      return { title: "集體分數", goal: 100, mode: "additive" };
    case "role_assign":
      return { title: "角色分派", roles: ["隊長", "記錄", "計時", "發言"] };
    case "never_have_i_ever":
      return { title: "我從沒...", prompt: "輪流說出一件你沒做過、可能別人做過的事" };
    case "would_you_rather":
      return { title: "你會選哪個", optionA: "選項 A", optionB: "選項 B" };
    case "two_truths":
      return { title: "兩真一假", prompt: "說三件事，其中一件是假的，讓夥伴猜" };
    case "check_in":
      return { title: "簽到", prompt: "用一個詞描述現在的你" };
    case "speed_networking":
      return { title: "快速交誼", prompt: "兩分鐘認識一位新夥伴", roundSeconds: 120 };
    case "kpt_retro":
      return { title: "KPT 回顧", prompt: "Keep（持續）／Problem（問題）／Try（嘗試）" };
    case "four_ls":
      return { title: "4Ls 回顧", prompt: "Liked／Lacked／Learned／Longed for" };
    case "rose_bud_thorn":
      return { title: "玫瑰花苞刺", prompt: "玫瑰（亮點）／花苞（潛能）／刺（挑戰）" };
    case "team_pact":
      return { title: "團隊公約", prompt: "我們約定好的工作方式" };
    case "team_health_check":
      return { title: "團隊健康檢查", prompt: "為各面向打分數" };
    case "team_radar":
      return { title: "團隊雷達圖", prompt: "標出團隊在各維度的能量" };
    case "safety_check":
      return { title: "心理安全檢查", prompt: "你在這個團隊中感到安全嗎？" };
    case "energy_map":
      return { title: "能量地圖", prompt: "標出此刻你的能量水位" };
    case "wish_wall":
      return { title: "許願牆", prompt: "把你的願望貼上牆" };
    case "idea_wall":
      return { title: "點子牆", prompt: "拋出你最想實現的點子" };
    case "story_wall":
      return { title: "故事牆", prompt: "分享一個值得被記住的故事" };
    case "brain_dump":
      return { title: "腦力傾倒", prompt: "三分鐘盡可能寫下所有相關想法" };
    case "dot_vote":
      return { title: "圓點投票", prompt: "把你的點貼到最喜歡的選項上", dotsPerPerson: 3 };
    case "rank_choice":
      return { title: "排序投票", prompt: "依優先順序排列你的選擇" };
    case "multi_vote":
      return { title: "多選投票", prompt: "選出你支持的所有選項" };
    case "scaled_feedback":
      return { title: "量表回饋", prompt: "在量表上標出你的看法", scaleMin: 1, scaleMax: 10 };
    case "thinking_hats":
      return { title: "六頂思考帽", prompt: "白／紅／黑／黃／綠／藍 不同角度思考" };
    case "host_word_cloud":
      return { title: "文字雲", prompt: "輸入你心中浮現的詞彙" };
    case "mad_libs":
      return { title: "填詞遊戲", prompt: "依提示填入詞彙，組成有趣的句子", template: "" };
    case "quest_chain":
      return { title: "任務鏈", prompt: "依序完成連鎖任務", quests: [] };

    // 📺 HostScreen 軸線元件 default config（2026-05-07 補）
    // schema 來源：client/src/components/game/host/*Config interface
    // 設計原則：所有欄位都給合理 default、admin 拖入後不需立即設定也能用
    case "host_poll_live":
      return {
        question: "請投票選一個",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
        ],
        durationSec: 60,
      };
    case "host_emoji_react":
      return {
        title: "Emoji 反應",
        subtitle: "點擊送出 emoji",
        emojis: ["❤️", "👏", "😂", "🔥", "🎉"],
        maxFlyingOnScreen: 50,
      };
    case "host_wave_response":
      return {
        title: "舉手熱力",
        buttonLabel: "我在！",
      };
    case "host_crowd_gather":
      return {
        title: "簽到熱場",
        targetCount: 10,
        celebrationText: "🎉 全員到齊！",
      };
    case "host_trivia_showdown":
      return {
        title: "搶答秀",
        questions: [],
        scoreByRank: [100, 75, 50, 25],
      };
    case "host_live_leaderboard":
      return {
        title: "即時排行榜",
        topN: 10,
        acceptPlayerPulse: false,
      };
    case "host_team_battle_score":
      return {
        title: "隊伍對戰",
        teams: [
          { id: "team-a", name: "A 隊", score: 0 },
          { id: "team-b", name: "B 隊", score: 0 },
        ],
        targetScore: 100,
        mode: "first_to_target",
        showRecentEvents: true,
        acceptPlayerPulse: false,
      };
    case "host_progress_quest":
      return {
        title: "進度任務",
        totalTasks: 100,
        milestones: [25, 50, 75, 100],
        celebrationLevel: "auto",
      };
    case "host_polaroid_collage":
      return {
        title: "拍立得紀念牆",
        maxOnScreen: 50,
        emojis: ["❤️", "🥂", "🎉", "💐"],
      };
    case "host_guestbook_digital":
      return {
        title: "數位簽名簿",
        maxEntries: 200,
      };
    case "host_blessing_wall":
      return {
        title: "祝福牆",
        theme: "default",
        emojis: ["❤️", "🎉", "🥂"],
        maxLength: 30,
      };
    case "host_knowledge_map":
      return {
        title: "場域全景圖",
        points: [],
        allowMessage: true,
        marqueeLimit: 8,
        maxVisits: 200,
      };
    case "host_scoreboard_announcement":
      return {
        title: "跑馬燈宣告",
        maxEntries: 50,
        displayDurationMs: 8000,
      };
    case "host_lottery_wheel":
      return {
        title: "抽獎轉盤",
        items: [],
        spinDurationMs: 5000,
        allowJoin: true,
      };
    case "host_bingo_board":
      return {
        title: "賓果牆",
        rows: 5,
        cols: 5,
        tasks: Array.from({ length: 25 }, (_, i) => ({
          id: `task-${i + 1}`,
          label: i === 12 ? "自由" : `任務 ${i + 1}`,
        })),
        freeCellLabel: "自由",
      };
    case "host_micro_qa":
      return {
        title: "Q&A 微提問",
        maxLength: 140,
        allowAnonymous: true,
      };

    default:
      return {};
  }
}
