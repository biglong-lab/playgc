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
    case "gps_mission":
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
      return {
        title: "隊伍投票",
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
    default:
      return {};
  }
}
