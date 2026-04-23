// 🏠 CHITO 平台智能入口（根路由 /）
//
// 邏輯：
//   1. localStorage 有上次場域 code → 直接 redirect 到 /f/{code}
//   2. 沒有 → 渲染 FieldEntry（CHITO 品牌首頁 + 場域列表）
//
// 好處：
//   - 回訪玩家不必再選場域，直接進上次玩的場域
//   - 新訪客看到 CHITO 品牌介紹，理解平台定位
//   - 避免 FieldThemeProvider 默默 fallback 到 JIACHUN 導致新訪客誤看到特定場域
import { useEffect } from "react";
import { useLocation } from "wouter";
import FieldEntry from "./FieldEntry";

const STORAGE_KEY = "lastFieldCode";

/** 同步讀取 localStorage 的上次場域 code（避免 useEffect 導致閃爍） */
function readLastFieldCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && /^[A-Z0-9_-]{2,50}$/i.test(v)) return v.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

export default function PlatformHome() {
  const [, setLocation] = useLocation();
  const cachedCode = readLastFieldCode();

  useEffect(() => {
    if (cachedCode) {
      // 用 replace 避免「回上一頁」又回到 /
      setLocation(`/f/${cachedCode}`, { replace: true });
    }
  }, [cachedCode, setLocation]);

  // 正在 redirect → 不 render 任何東西（避免閃 CHITO 首頁再跳走）
  if (cachedCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">進入場域中...</p>
        </div>
      </div>
    );
  }

  // 新訪客 → 顯示 CHITO 平台首頁
  return <FieldEntry />;
}
