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
    default:
      return {};
  }
}
