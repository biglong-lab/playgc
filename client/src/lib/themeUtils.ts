// 🎨 場域主題工具 — hex → HSL 轉換 + CSS 變數注入
//
// shadcn/ui 用 HSL 格式（不帶 `hsl()` 包裝），例如 "220 14% 7%"
// 所以要把 admin 設定的 hex 色轉成這個格式才能塞 CSS 變數

import type { FieldTheme } from "@shared/schema";

/** 把 `#rrggbb` 轉成 "H S% L%" 字串；格式錯回 null */
export function hexToHSL(hex: string): string | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** 反向：把 shadcn HSL 字串轉回 hex，用於初始化 color picker */
export function hslToHex(hsl: string): string | null {
  const m = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!m) return null;
  const h = parseInt(m[1]) / 360;
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number): string => {
    const n = Math.round(x * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 套用主題到 document.documentElement（可回滾：呼叫時回傳清除函式） */
export function applyTheme(theme: FieldTheme): () => void {
  const root = document.documentElement;
  const reverts: Array<() => void> = [];

  const setVar = (name: string, value: string) => {
    const prev = root.style.getPropertyValue(name);
    root.style.setProperty(name, value);
    reverts.push(() => {
      if (prev) root.style.setProperty(name, prev);
      else root.style.removeProperty(name);
    });
  };

  if (theme.primaryColor) {
    const hsl = hexToHSL(theme.primaryColor);
    if (hsl) setVar("--primary", hsl);
  }
  if (theme.accentColor) {
    const hsl = hexToHSL(theme.accentColor);
    if (hsl) setVar("--accent", hsl);
  }
  if (theme.backgroundColor) {
    const hsl = hexToHSL(theme.backgroundColor);
    if (hsl) setVar("--background", hsl);
  }
  if (theme.textColor) {
    const hsl = hexToHSL(theme.textColor);
    if (hsl) setVar("--foreground", hsl);
  }

  // 版面模板 → body data attribute
  const prevLayout = document.body.dataset.layout;
  if (theme.layoutTemplate) {
    document.body.dataset.layout = theme.layoutTemplate;
  }
  reverts.push(() => {
    if (prevLayout) document.body.dataset.layout = prevLayout;
    else delete document.body.dataset.layout;
  });

  // 字體風格 → body class
  const fontClassMap: Record<NonNullable<FieldTheme["fontFamily"]>, string> = {
    default: "",
    serif: "font-serif",
    mono: "font-mono",
    display: "font-display",
  };
  if (theme.fontFamily) {
    const cls = fontClassMap[theme.fontFamily];
    if (cls) {
      document.body.classList.add(cls);
      reverts.push(() => document.body.classList.remove(cls));
    }
  }

  // 回傳 revert 函式
  return () => {
    for (const r of reverts.reverse()) r();
  };
}
