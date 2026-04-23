// 🔀 SmartRedirect — 把 legacy 路徑（/home /leaderboard /me /purchases）
// 自動轉到當前場域的對應 /f/{code}/<path>
//
// 邏輯：
//   1. 讀 localStorage.lastFieldCode → 有就導 /f/{code}{to}
//   2. 沒有 → 導 /f（讓使用者先選場域）
//
// 使用場景：App.tsx 把舊路徑套上這個元件，保持 URL 一致性
import { useEffect } from "react";
import { useLocation } from "wouter";

/** 同步讀取上次場域 code */
function readLastFieldCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem("lastFieldCode");
    if (v && /^[A-Z0-9_-]{2,50}$/i.test(v)) return v.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

interface SmartRedirectProps {
  /** legacy path，例如 "/home" / "/leaderboard" / "/me" */
  readonly to: string;
}

/**
 * 將 legacy 路徑轉為場域路徑（/f/{code}{to}），沒場域時導 /f
 * 用 replace 避免 back button 又跳回來。
 */
export default function SmartRedirect({ to }: SmartRedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const code = readLastFieldCode();
    // 保留原本的 query string 和 hash（例如 ?replay=true）
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const target = code ? `/f/${code}${to}${search}${hash}` : "/f";
    setLocation(target, { replace: true });
  }, [to, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">導向中...</p>
      </div>
    </div>
  );
}
