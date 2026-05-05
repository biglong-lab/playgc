// 🧪 TestImpersonate — 用 customToken 自動登入測試玩家
//
// 路徑：/test-impersonate?token=xxx
// 流程：admin /admin/dev-tools 點「開新分頁」→ 開此頁 → signInWithCustomToken → 跳 /home

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { signInWithCustomToken } from "@/lib/firebase";

export default function TestImpersonate() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("缺少 token");
      return;
    }
    (async () => {
      try {
        await signInWithCustomToken(token);
        // 移除 token 避免分享 URL 誤洩
        window.history.replaceState({}, "", "/home");
        setLocation("/home");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "登入失敗";
        setError(`登入失敗：${msg}`);
      }
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center space-y-3">
          {error ? (
            <>
              <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
              <p className="text-sm font-medium">無法登入測試玩家</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">
                請回到 /admin/dev-tools 重新點「開新分頁」（customToken 1 小時有效）
              </p>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <p className="text-sm font-medium">登入測試玩家中...</p>
              <p className="text-xs text-muted-foreground">很快就好</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
