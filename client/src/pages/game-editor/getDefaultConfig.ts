// 各頁面類型的預設設定值

export function getDefaultConfig(pageType: string): Record<string, unknown> {
  switch (pageType) {
    case "text_card":
      return { title: "新標題", content: "在這裡輸入內容..." };
    case "dialogue":
      return {
        character: { name: "角色名稱" },
        messages: [{ text: "對話內容..." }]
      };
    case "button":
      return {
        prompt: "請選擇一個選項",
        buttons: [
          { text: "選項 1", nextPageId: undefined, rewardPoints: 0 },
          { text: "選項 2", nextPageId: undefined, rewardPoints: 0 }
        ]
      };
    case "text_verify":
      return { question: "問題?", answers: ["答案"] };
    case "choice_verify":
      return {
        question: "問題?",
        options: [
          { text: "選項 A", correct: true },
          { text: "選項 B", correct: false },
        ]
      };
    case "conditional_verify":
      return {
        title: "碎片收集",
        instruction: "收集所有碎片，組成正確的密碼",
        fragmentType: "numbers",
        fragmentCount: 4,
        fragments: [
          { id: "f1", label: "碎片 1/4", value: "1", order: 1 },
          { id: "f2", label: "碎片 2/4", value: "2", order: 2 },
          { id: "f3", label: "碎片 3/4", value: "3", order: 3 },
          { id: "f4", label: "碎片 4/4", value: "4", order: 4 },
        ],
        targetCode: "1234",
        verificationMode: "order_matters",
        rewardPoints: 30
      };
    case "shooting_mission":
      return { requiredHits: 5, timeLimit: 60 };
    case "photo_mission":
      return { instruction: "請拍攝..." };
    case "gps_mission":
      return {
        targetLocation: { lat: 25.033, lng: 121.565 },
        radius: 50,
        instruction: "前往目標位置"
      };
    case "qr_scan":
      return { qrCodeId: "QR-001" };
    case "time_bomb":
      return {
        title: "拆彈任務",
        timeLimit: 60,
        tasks: [
          { type: "tap", question: "快速點擊按鈕!", targetCount: 10 }
        ]
      };
    case "lock":
      return {
        title: "密碼鎖",
        lockType: "number",
        combination: "1234",
        digits: 4,
        maxAttempts: 5
      };
    case "motion_challenge":
      return {
        title: "體感挑戰",
        challengeType: "shake",
        targetValue: 20,
        timeLimit: 30
      };
    case "vote":
      return {
        title: "隊伍投票",
        question: "請選擇你的答案",
        options: [
          { text: "選項一" },
          { text: "選項二" }
        ],
        showResults: true,
        anonymousVoting: true
      };
    default:
      return {};
  }
}
