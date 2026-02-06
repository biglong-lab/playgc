// 遊戲模板定義 - 從 shared 重新匯出
// 確保前後端使用相同的模板定義

export {
  GAME_TEMPLATES,
  getTemplateById,
  type GameTemplate,
  type TemplatePageConfig,
} from "@shared/schema";

// 取得模板圖示對應的 Lucide 圖示名稱
export const TEMPLATE_ICONS: Record<string, string> = {
  map: "Map",
  puzzle: "Puzzle",
  "help-circle": "HelpCircle",
  target: "Target",
  users: "Users",
  plus: "Plus",
};
