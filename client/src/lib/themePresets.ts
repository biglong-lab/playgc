// 🎨 預設主題 — 5 套可一鍵套用的場域主題
//
// 設計原則：
// 1. 每套主題都是完整配色（主/輔/背景/文字）+ 建議版面 + 字體
// 2. 對比度都符合 WCAG AA（避免低對比看不清）
// 3. 管理員點一下即套用，不用調色
//
// 參考自賈村（經典橘黑）衍生，搭配後浦小鎮等不同氛圍的場域需求

import type { FieldTheme } from "@shared/schema";

export interface ThemePreset {
  /** 唯一 id，用 snake_case */
  id: string;
  /** 顯示名稱 */
  label: string;
  /** 一句話描述情境 */
  description: string;
  /** emoji 當圖示 */
  icon: string;
  /** 套用的主題設定 */
  theme: FieldTheme;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "classic_orange",
    label: "經典橘黑",
    description: "軍事戰術風 — 深黑底配軍橘，穩重有力（賈村預設）",
    icon: "🔥",
    theme: {
      colorScheme: "dark",
      primaryColor: "#d97706",
      accentColor: "#374151",
      backgroundColor: "#111827",
      textColor: "#e5e5e5",
      layoutTemplate: "classic",
      fontFamily: "default",
    },
  },
  {
    id: "literary_teal",
    label: "文藝青綠",
    description: "文青小鎮風 — 米底配綠松，適合文化景點（后浦小鎮推薦）",
    icon: "🌿",
    theme: {
      colorScheme: "light",
      primaryColor: "#0d9488",
      accentColor: "#ca8a04",
      backgroundColor: "#fefce8",
      textColor: "#1c1917",
      layoutTemplate: "card",
      fontFamily: "serif",
    },
  },
  {
    id: "tech_blue",
    label: "科技深藍",
    description: "電競科技風 — 深藍配電光藍，賽博龐克感",
    icon: "⚡",
    theme: {
      colorScheme: "dark",
      primaryColor: "#3b82f6",
      accentColor: "#06b6d4",
      backgroundColor: "#0f172a",
      textColor: "#f1f5f9",
      layoutTemplate: "fullscreen",
      fontFamily: "mono",
    },
  },
  {
    id: "arcade_pink",
    label: "霓虹遊戲廳",
    description: "街機夜店風 — 桃紅配紫，活力爆棚（適合年輕族群）",
    icon: "🎮",
    theme: {
      colorScheme: "dark",
      primaryColor: "#ec4899",
      accentColor: "#a855f7",
      backgroundColor: "#18122b",
      textColor: "#fdf4ff",
      layoutTemplate: "card",
      fontFamily: "display",
    },
  },
  {
    id: "minimal_mono",
    label: "極簡白淨",
    description: "純白極簡風 — 黑白灰無彩，強調內容本身",
    icon: "◽",
    theme: {
      colorScheme: "light",
      primaryColor: "#171717",
      accentColor: "#737373",
      backgroundColor: "#fafafa",
      textColor: "#171717",
      layoutTemplate: "minimal",
      fontFamily: "default",
    },
  },
];

/** 根據主題比對最相近的 preset id（便於顯示「目前套用 xx」） */
export function findMatchingPreset(theme: FieldTheme | undefined): string | null {
  if (!theme?.primaryColor) return null;
  const normalize = (c: string) => c.toLowerCase();
  for (const p of THEME_PRESETS) {
    if (
      normalize(p.theme.primaryColor || "") === normalize(theme.primaryColor) &&
      normalize(p.theme.backgroundColor || "") ===
        normalize(theme.backgroundColor || "")
    ) {
      return p.id;
    }
  }
  return null;
}
