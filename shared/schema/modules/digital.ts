// 數位互動系新模組（都市怪談調查員）
import type { GameModule } from "../game-modules";

// ============================================================================
// 都市怪談調查員
// ============================================================================
const urbanLegendInvestigator: GameModule = {
  id: "urban_legend_investigator",
  name: "都市怪談調查員",
  description: "結合影片證言、對話推理、線索收集、暗號破解的線上推理遊戲",
  icon: "ghost",
  estimatedTime: 35,
  maxPlayers: 15,
  difficulty: "hard",
  tags: ["線上", "推理", "怪談", "解謎"],
  category: "digital",
  scenario: "適合遠端團建、線上讀書會、萬聖節主題活動、雨天備案",
  highlights: [
    "影片目擊證言營造懸疑氛圍",
    "當事人對話推進劇情",
    "蒐集三件關鍵線索通關",
    "暗號文字破解考驗腦力",
    "分支推理增加重玩價值",
  ],
  flowDescription: "神秘委託 → 目擊者證言影片 → 當事人對話 → 收集三線索 → 辨認兇手 → 破解暗號 → 選擇推理方向 → 結案",
  coverEmoji: "👻",
  pages: [
    {
      pageType: "text_card",
      title: "神秘委託",
      config: {
        title: "都市怪談調查開始",
        text: "接獲市民委託：近期網路盛傳「午夜電梯」都市怪談，已有人失蹤。你的任務是調查事件真相。",
      },
    },
    {
      pageType: "video",
      title: "目擊者證言",
      config: {
        title: "監視器畫面",
        videoUrl: "",
        description: "觀看大樓監視器畫面，注意電梯內的異狀",
      },
    },
    {
      pageType: "dialogue",
      title: "訪談當事人",
      config: {
        character: { name: "鄰居王小姐" },
        messages: [
          { text: "那天晚上我聽到電梯發出奇怪的聲音。" },
          { text: "隔天就聽說有人不見了，電梯也停用了。" },
          { text: "調查員，你千萬要小心，這地方不太對勁。" },
        ],
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集關鍵線索",
      config: {
        instruction: "在案件資料中找出 3 件關鍵線索",
        requiredFragments: 3,
        fragments: ["大樓門禁紀錄", "電梯維修紀錄", "當晚社群貼文"],
      },
    },
    {
      pageType: "choice_verify",
      title: "辨認嫌疑人",
      config: {
        question: "綜合監視器與證人證詞，以下哪個說法最可能是真的？",
        options: ["電梯真的鬧鬼", "失蹤者自導自演", "大樓管理員涉案", "對面鄰居惡作劇"],
        correctIndex: 1,
      },
    },
    {
      pageType: "text_verify",
      title: "破解暗號",
      config: {
        question: "失蹤者在社群發了一則訊息：「WUHDO」（每字母後移一位）。解密後是什麼？",
        correctAnswer: "TRUCN",
        hint: "W 的前一個字母是 V... 仔細檢查方向",
      },
    },
    {
      pageType: "button",
      title: "選擇結案方向",
      config: {
        prompt: "你打算如何結案？",
        buttons: [
          { text: "寫成都市傳說報導", rewardPoints: 15 },
          { text: "提交警方調查", rewardPoints: 15 },
          { text: "私下找失蹤者家屬說明", rewardPoints: 15 },
        ],
      },
    },
    {
      pageType: "text_card",
      title: "結案報告",
      config: {
        title: "都市怪談調查結案",
        text: "你抽絲剝繭找出了真相：原來「午夜電梯」只是失蹤者自導自演的網路炒作。你的理性思考，拆穿了這場虛構的怪談。",
      },
    },
  ],
};

export const DIGITAL_MODULES: GameModule[] = [
  urbanLegendInvestigator,
];
