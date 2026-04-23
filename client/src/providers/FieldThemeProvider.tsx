// 🎨 場域主題 Provider
//
// 職責：進入 app 時載入當前場域的主題，把色系/版面/字體注入 document
// 來源優先序：
//   0. URL path 是 / 或 /f → CHITO 平台頁（不套任何場域主題，用系統預設）
//   1. URL query ?themePreview=<base64> — 管理員即時預覽
//   2. URL path /f/:fieldCode — 場域專屬路徑
//   3. admin session 的 fieldCode（管理者進後台→看自己場域主題）
//   4. localStorage 的 "lastFieldCode"（玩家上次進入的場域）
//   5. 環境變數 VITE_DEFAULT_FIELD_CODE（fallback）
//   6. 最後回到 "JIACHUN"（系統預設）
//
// 不依賴 AuthProvider（因為 admin 和玩家驗證不同），自己獨立查 session
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyTheme } from "@/lib/themeUtils";
import type { FieldTheme, FieldHighlight } from "@shared/schema";

/** 場域模組開關 — 決定 Landing / Home 要不要顯示對戰入口等 */
export interface FieldModules {
  shooting: boolean;
  battle: boolean;
  chapters: boolean;
  photo: boolean;
  gps: boolean;
  team: boolean;
  competitive: boolean;
}

export interface FieldThemePayload {
  fieldId: string;
  code: string;
  name: string;
  logoUrl: string | null;
  welcomeMessage: string | null;
  /** 🆕 場域短 slogan（後台可設定） */
  tagline: string | null;
  /** 🆕 場域亮點列表（後台可設定，Landing Feature Section 用） */
  highlights: FieldHighlight[];
  /** 🆕 模組開關（控制對戰入口、射擊任務等是否顯示） */
  modules: FieldModules;
  theme: FieldTheme;
}

/** 給其他元件拿當前場域 payload 用（name / logo / coverImage / welcome 訊息） */
export function useCurrentField(): FieldThemePayload | null {
  const fieldCode = (() => {
    // 使用跟 Provider 同樣的 fieldCode 決策：但此 hook 在 Provider 內部，用 query 共享快取
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached && /^[A-Z0-9_-]{2,50}$/i.test(cached)) return cached;
    } catch { /* ignore */ }
    return DEFAULT_FIELD_CODE;
  })();

  const { data } = useQuery<FieldThemePayload>({
    queryKey: ["/api/fields", fieldCode, "theme"],
    enabled: false, // 已由 Provider 觸發，這 hook 只讀快取
    staleTime: 5 * 60_000,
  });
  return data || null;
}

const DEFAULT_FIELD_CODE =
  import.meta.env.VITE_DEFAULT_FIELD_CODE || "JIACHUN";
const STORAGE_KEY = "lastFieldCode";
/** URL query key，由管理端設定頁產生 */
export const PREVIEW_QUERY_KEY = "themePreview";

/** 取得當前場域 code — 用於決定要套哪個主題 */
function resolveFieldCode(): string {
  // 試著從 localStorage 取上次記錄的
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && /^[A-Z0-9_-]{2,50}$/i.test(cached)) return cached;
  } catch {
    /* 沒有 localStorage 也沒差 */
  }
  return DEFAULT_FIELD_CODE;
}

/** 記住使用者進入的場域，下次開啟直接套 */
export function setCurrentFieldCode(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code.toUpperCase());
  } catch {
    /* ignore */
  }
}

/** URL-safe base64 → theme 物件（只接受已知欄位） */
function decodePreviewTheme(encoded: string): FieldTheme | null {
  try {
    // URL-safe base64 → standard base64
    const std = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = std.length % 4 ? "=".repeat(4 - (std.length % 4)) : "";
    const decoded = atob(std + pad);
    const parsed = JSON.parse(decoded) as FieldTheme;
    // 驗證：只允許已知欄位
    const safe: FieldTheme = {};
    const hexRE = /^#[0-9a-f]{6}$/i;
    if (parsed.primaryColor && hexRE.test(parsed.primaryColor)) safe.primaryColor = parsed.primaryColor;
    if (parsed.accentColor && hexRE.test(parsed.accentColor)) safe.accentColor = parsed.accentColor;
    if (parsed.backgroundColor && hexRE.test(parsed.backgroundColor)) safe.backgroundColor = parsed.backgroundColor;
    if (parsed.textColor && hexRE.test(parsed.textColor)) safe.textColor = parsed.textColor;
    if (["classic", "card", "fullscreen", "minimal"].includes(parsed.layoutTemplate || "")) {
      safe.layoutTemplate = parsed.layoutTemplate;
    }
    if (["default", "serif", "mono", "display"].includes(parsed.fontFamily || "")) {
      safe.fontFamily = parsed.fontFamily;
    }
    // 圖片 URL 只允許 https
    if (parsed.coverImageUrl && /^https:\/\//i.test(parsed.coverImageUrl)) {
      safe.coverImageUrl = parsed.coverImageUrl;
    }
    if (parsed.brandingLogoUrl && /^https:\/\//i.test(parsed.brandingLogoUrl)) {
      safe.brandingLogoUrl = parsed.brandingLogoUrl;
    }
    return safe;
  } catch {
    return null;
  }
}

/** 編碼主題為 URL-safe base64（給管理端用） */
export function encodePreviewTheme(theme: FieldTheme): string {
  const json = JSON.stringify(theme);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 從 URL 讀出預覽主題（優先級最高） */
function readPreviewFromUrl(): FieldTheme | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(PREVIEW_QUERY_KEY);
    if (!encoded) return null;
    return decodePreviewTheme(encoded);
  } catch {
    return null;
  }
}

/** 把當前 URL 的預覽 query 移除（點「離開預覽」時用） */
export function clearPreviewQuery() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(PREVIEW_QUERY_KEY);
    window.history.replaceState({}, "", url.toString());
    // 強制重新載入讓 provider 回到正常主題
    window.location.reload();
  } catch {
    /* ignore */
  }
}

/** 小 hook：暴露當前是否處於預覽模式 */
export function usePreviewTheme(): FieldTheme | null {
  const [theme, setTheme] = useState<FieldTheme | null>(() => readPreviewFromUrl());

  useEffect(() => {
    // 監聽 popstate 與自訂事件，讓 query 變化時同步
    const update = () => setTheme(readPreviewFromUrl());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return theme;
}

/** 從 URL path 擷取 /f/:fieldCode 中的 code（若當前頁是場域路由） */
function readFieldCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/f\/([A-Z0-9_-]{2,50})(?:\/|$)/i);
  return match ? match[1].toUpperCase() : null;
}

/** 判斷目前 URL 是否是 CHITO 平台頁（/ 或 /f，不屬於任何場域） */
function isOnPlatformPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p === "/" || /^\/f\/?$/.test(p);
}

export function FieldThemeProvider({ children }: { children: React.ReactNode }) {
  // 0. 讀 URL preview（優先級最高，管理員即時預覽）
  const previewTheme = useMemo(() => readPreviewFromUrl(), []);

  // 0.5 🆕 URL path 場域（/f/:fieldCode）優先於 admin session / localStorage
  //     同時追蹤是否在「CHITO 平台頁」(/、/f)，這時候不套任何場域主題
  //     監聽 popstate + 500ms polling 讓 SPA 導航也能觸發更新
  const [urlFieldCode, setUrlFieldCode] = useState(() => readFieldCodeFromUrl());
  const [isPlatformPage, setIsPlatformPage] = useState(() => isOnPlatformPath());
  useEffect(() => {
    const update = () => {
      setUrlFieldCode(readFieldCodeFromUrl());
      setIsPlatformPage(isOnPlatformPath());
    };
    window.addEventListener("popstate", update);
    const interval = setInterval(update, 500);
    return () => {
      window.removeEventListener("popstate", update);
      clearInterval(interval);
    };
  }, []);

  // 1. 拿 admin session（若有）— 平台頁不 fetch（避免干擾）
  const { data: adminSession } = useQuery<{
    authenticated: boolean;
    admin?: { fieldCode?: string };
  }>({
    queryKey: ["/api/admin/session"],
    queryFn: async () => {
      const res = await fetch("/api/admin/session", {
        credentials: "include",
      });
      if (!res.ok) return { authenticated: false };
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !previewTheme && !urlFieldCode && !isPlatformPage,
  });

  const adminFieldCode = adminSession?.admin?.fieldCode;
  // 🆕 平台頁 → null（不套任何場域主題）
  //     其他路徑 → URL > admin session > localStorage > 預設
  const fieldCode = isPlatformPage
    ? null
    : (urlFieldCode || adminFieldCode || resolveFieldCode());

  // 2. 拿主題（預覽模式 / 平台頁時跳過）
  const { data: themePayload } = useQuery<FieldThemePayload>({
    queryKey: ["/api/fields", fieldCode, "theme"],
    queryFn: async () => {
      const res = await fetch(
        `/api/fields/${encodeURIComponent(fieldCode!)}/theme`,
      );
      if (!res.ok) throw new Error("field theme not found");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !previewTheme && !!fieldCode,
  });

  // 3. 套到 document
  useEffect(() => {
    // 預覽模式：直接套 URL 來的主題，不寫 localStorage
    if (previewTheme) {
      const revert = applyTheme(previewTheme);
      return revert;
    }

    // 🆕 平台頁（/、/f）：不套任何主題，用系統預設
    //    這個 effect 不 return cleanup，但前次 effect 的 cleanup 會把先前套的 field theme revert
    if (isPlatformPage) {
      return;
    }

    // 正常模式
    if (!themePayload?.theme) return;
    if (themePayload.code) setCurrentFieldCode(themePayload.code);
    const revert = applyTheme(themePayload.theme);
    return revert;
  }, [previewTheme, themePayload, isPlatformPage]);

  return <>{children}</>;
}
