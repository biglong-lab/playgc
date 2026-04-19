// 教育學習系新模組（科學探險、歷史穿越）
import type { GameModule } from "../game-modules";

// ============================================================================
// 科學探險小隊
// ============================================================================
const scienceExplorerSquad: GameModule = {
  id: "science_explorer_squad",
  name: "科學探險小隊",
  description: "結合影片導覽、展館 GPS、互動展品 QR 的博物館/科教館知識遊戲",
  icon: "flask",
  estimatedTime: 50,
  maxPlayers: 25,
  difficulty: "easy",
  tags: ["教育", "科普", "博物館", "展館"],
  category: "education",
  scenario: "適合科學教育館、校外教學、親子學習、科普推廣活動",
  highlights: [
    "科學家影片開場引發好奇",
    "GPS + QR 引導至展品互動點",
    "科學原理問答結合展覽內容",
    "填空題加深專有名詞記憶",
    "分支讓學生選擇主題（物理/化學/生物）",
  ],
  flowDescription: "歡迎 → 科學家影片 → GPS 到展區 → QR 互動展品 → 原理問答 → 實驗名稱填空 → 展品自拍 → 選主題 → 結業",
  coverEmoji: "🔬",
  pages: [
    {
      pageType: "text_card",
      title: "探險小隊集合",
      config: {
        title: "科學探險小隊報到",
        text: "歡迎來到科學館！今天你將走訪各展區、破解科學謎題，成為合格的小小科學家。",
      },
    },
    {
      pageType: "video",
      title: "科學家的話",
      config: {
        title: "館長開場",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // TODO: 管理員請改成實際影片
        skipEnabled: true,
        description: "先來聽聽館長介紹今日的探險路線",
      },
    },
    {
      pageType: "gps_mission",
      title: "前往物理展區",
      config: {
        instruction: "依指示前往物理互動展區",
        targetLocation: { lat: 25.101, lng: 121.534 },
        radius: 15,
      },
    },
    {
      pageType: "qr_scan",
      title: "互動展品打卡",
      config: {
        instruction: "掃描展品旁的 QR Code 觸發互動",
        expectedCode: "SCIENCE-EXHIBIT-01",
      },
    },
    {
      pageType: "choice_verify",
      title: "科學原理問答",
      config: {
        question: "水的沸點在一大氣壓下是幾度？",
        options: [
          { text: "50°C", correct: false },
          { text: "75°C", correct: false },
          { text: "100°C", correct: true },
          { text: "150°C", correct: false },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "實驗名稱填空",
      config: {
        question: "測量電壓、電流、電阻關係的經典定律叫什麼定律？",
        correctAnswer: "歐姆定律",
        hint: "發明者姓氏為 Ohm",
      },
    },
    {
      pageType: "photo_mission",
      title: "展品自拍",
      config: {
        prompt: "在你覺得最有趣的展品前拍一張自拍",
      },
    },
    {
      pageType: "button",
      title: "選擇進階主題",
      config: {
        prompt: "你想繼續探索哪個領域？",
        buttons: [
          { text: "物理力學", rewardPoints: 10 },
          { text: "化學反應", rewardPoints: 10 },
          { text: "生物演化", rewardPoints: 10 },
        ],
      },
    },
    {
      pageType: "text_card",
      title: "結業證書",
      config: {
        title: "恭喜完成科學探險",
        text: "今天你觀察了展品、回答了問題，你已經是一位小小科學家。繼續保持好奇心，科學的路還很長！",
      },
    },
  ],
};

// ============================================================================
// 歷史穿越大冒險
// ============================================================================
const historyTimeTravel: GameModule = {
  id: "history_time_travel",
  name: "歷史穿越大冒險",
  description: "以穿越古代為主軸的歷史問答遊戲，對話古人、年份挑戰、文物收集",
  icon: "scroll",
  estimatedTime: 30,
  maxPlayers: 30,
  difficulty: "medium",
  tags: ["教育", "歷史", "穿越", "劇情"],
  category: "education",
  scenario: "適合歷史課程延伸、古蹟教學、文化導覽、博物館學習單",
  highlights: [
    "穿越劇情開場沉浸感滿分",
    "與古人對話理解歷史脈絡",
    "年份/人物問答檢驗歷史知識",
    "朝代選擇決定探險路線",
    "收集三件文物完成冒險",
  ],
  flowDescription: "穿越開場 → 古人對話 → 歷史事件年份 → 歷史人物填空 → 古蹟自拍 → 選朝代 → 收集三文物 → 回到現代",
  coverEmoji: "📜",
  pages: [
    {
      pageType: "text_card",
      title: "穿越的一瞬",
      config: {
        title: "歷史穿越大冒險",
        text: "你不小心碰到博物館裡的神秘文物，眼前一閃—你穿越回古代！想回到現代，你必須完成這段歷史任務。",
      },
    },
    {
      pageType: "dialogue",
      title: "遇見古人",
      config: {
        character: { name: "古代文人" },
        messages: [
          { text: "來人，汝從何處而來？" },
          { text: "既已穿越，便需依循古道，解此三試方能歸還。" },
          { text: "第一試，問汝歷史知識。" },
        ],
      },
    },
    {
      pageType: "choice_verify",
      title: "歷史事件年份",
      config: {
        question: "中華民國成立於哪一年？",
        options: [
          { text: "1909 年", correct: false },
          { text: "1911 年", correct: false },
          { text: "1912 年", correct: true },
          { text: "1919 年", correct: false },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "歷史人物填空",
      config: {
        question: "被尊稱為「國父」的人物姓名是？",
        correctAnswer: "孫中山",
        hint: "本名孫文，號逸仙",
      },
    },
    {
      pageType: "photo_mission",
      title: "古蹟自拍",
      config: {
        prompt: "在任何一座古蹟或仿古場景前拍張自拍，證明你真的來到了古代",
      },
    },
    {
      pageType: "button",
      title: "選擇朝代繼續探險",
      config: {
        prompt: "你想進一步探訪哪個朝代？",
        buttons: [
          { text: "唐朝盛世", rewardPoints: 10 },
          { text: "宋朝文風", rewardPoints: 10 },
          { text: "清朝末年", rewardPoints: 10 },
        ],
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集三件文物",
      config: {
        instruction: "返回現代前，請收集 3 件重要文物",
        demoMode: true,
        verificationMode: "all_collected",
        fragmentType: "custom",
        fragmentCount: 3,
        fragments: [
          { id: "r1", label: "青瓷瓶", value: "1", order: 1 },
          { id: "r2", label: "竹簡書卷", value: "2", order: 2 },
          { id: "r3", label: "古代銅錢", value: "3", order: 3 },
        ],
      },
    },
    {
      pageType: "text_card",
      title: "回到現代",
      config: {
        title: "穿越冒險完成",
        text: "你成功通過古人的三試，獲得穿越回現代的資格。這段歷史之旅，也讓你對過去有了更多敬意。",
      },
    },
  ],
};

export const EDUCATION_MODULES: GameModule[] = [
  scienceExplorerSquad,
  historyTimeTravel,
];
