// 🎨 場域主題 Provider
//
// 職責：進入 app 時載入當前場域的主題，把色系/版面/字體注入 document
// 來源優先序：
//   1. admin session 的 fieldCode（管理者進後台→看自己場域主題）
//   2. localStorage 的 "lastFieldCode"（玩家上次進入的場域）
//   3. 環境變數 VITE_DEFAULT_FIELD_CODE（fallback）
//   4. 最後回到 "JIACHUN"（系統預設）
//
// 不依賴 AuthProvider（因為 admin 和玩家驗證不同），自己獨立查 session
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyTheme } from "@/lib/themeUtils";
import type { FieldTheme } from "@shared/schema";

interface FieldThemePayload {
  fieldId: string;
  code: string;
  name: string;
  logoUrl: string | null;
  theme: FieldTheme;
}

const DEFAULT_FIELD_CODE =
  import.meta.env.VITE_DEFAULT_FIELD_CODE || "JIACHUN";
const STORAGE_KEY = "lastFieldCode";

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

export function FieldThemeProvider({ children }: { children: React.ReactNode }) {
  // 1. 先拿 admin session（若有）
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
  });

  const adminFieldCode = adminSession?.admin?.fieldCode;
  const fieldCode = adminFieldCode || resolveFieldCode();

  // 2. 拿主題
  const { data: themePayload } = useQuery<FieldThemePayload>({
    queryKey: ["/api/fields", fieldCode, "theme"],
    queryFn: async () => {
      const res = await fetch(
        `/api/fields/${encodeURIComponent(fieldCode)}/theme`,
      );
      if (!res.ok) throw new Error("field theme not found");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // 3. 套到 document
  useEffect(() => {
    if (!themePayload?.theme) return;
    // 記住當前場域（下次不用重新判斷）
    if (themePayload.code) setCurrentFieldCode(themePayload.code);
    // 套主題，unmount 時還原（若 HMR / 路由變）
    const revert = applyTheme(themePayload.theme);
    return revert;
  }, [themePayload]);

  return <>{children}</>;
}
