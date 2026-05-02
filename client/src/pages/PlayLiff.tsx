// 📱 PlayLiff — LINE LIFF 玩家入口（W14 D1）
//
// 路徑：/liff/play/:sessionId
// 用途：玩家從 LINE 訊息 / Bot 點開後直接進入遊戲（不離開 LINE）
//
// 流程：
//   1. 載入 LIFF SDK
//   2. 自動取 LINE 使用者 profile（displayName / userId）
//   3. 把 profile 傳給原 /play/:sessionId 頁面（用 query / state）
//
// 不在 LINE 環境（桌機瀏覽器）→ fallback 到 /play/:sessionId
// LIFF ID 需在 .env：VITE_LIFF_ID_PLAY

import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { initLiff, triggerLineLogin } from "@/lib/liff";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MessageCircle } from "lucide-react";

const LIFF_ID = import.meta.env.VITE_LIFF_ID_PLAY as string | undefined;

export default function PlayLiff() {
  const [, params] = useRoute("/liff/play/:sessionId");
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "login_required" | "ok" | "error" | "not_configured">("loading");
  const [error, setError] = useState<string>("");
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null);

  const sessionId = params?.sessionId;

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError("缺少 sessionId");
      return;
    }

    if (!LIFF_ID) {
      console.warn("[PlayLiff] VITE_LIFF_ID_PLAY 未設定、fallback 到 /play");
      setStatus("not_configured");
      return;
    }

    initLiff(LIFF_ID)
      .then((result) => {
        if (!result.isLoggedIn) {
          setStatus("login_required");
          // 自動觸發登入（LINE app 內會自動完成）
          triggerLineLogin(result.sdk);
          return;
        }
        if (result.profile) {
          setProfile({ userId: result.profile.userId, displayName: result.profile.displayName });
          setStatus("ok");
        } else {
          setStatus("error");
          setError("無法取得 LINE 使用者資料");
        }
      })
      .catch((err) => {
        console.error("[PlayLiff] init 失敗:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "LIFF 初始化失敗");
      });
  }, [sessionId]);

  // 自動跳轉到 /play 並帶 LINE profile
  useEffect(() => {
    if (status === "ok" && profile && sessionId) {
      const params = new URLSearchParams({
        line_user_id: profile.userId,
        line_display_name: profile.displayName,
      });
      const target = `/play/${sessionId}?${params.toString()}`;
      // 用 replace 不留 history（避免按返回回到 LIFF 中繼頁）
      window.location.replace(target);
    }
  }, [status, profile, sessionId]);

  // not_configured → 直接跳 /play（fallback）
  useEffect(() => {
    if (status === "not_configured" && sessionId) {
      navigate(`/play/${sessionId}`);
    }
  }, [status, sessionId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-emerald-50">
      <Card className="max-w-sm w-full">
        <CardContent className="p-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-emerald-600 animate-spin" />
              <p className="text-sm text-muted-foreground">透過 LINE 連線中...</p>
            </>
          )}

          {status === "login_required" && (
            <>
              <MessageCircle className="w-12 h-12 mx-auto text-emerald-600" />
              <p className="text-sm">請先登入 LINE</p>
              <Button onClick={() => location.reload()}>重試</Button>
            </>
          )}

          {status === "ok" && profile && (
            <>
              <div className="text-2xl">👋</div>
              <h2 className="font-display font-bold">歡迎 {profile.displayName}！</h2>
              <p className="text-sm text-muted-foreground">進入遊戲中...</p>
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
              <h2 className="font-display font-bold">無法進入</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              {sessionId && (
                <Button onClick={() => navigate(`/play/${sessionId}`)} variant="outline">
                  改用一般網頁
                </Button>
              )}
            </>
          )}

          {status === "not_configured" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-emerald-600 animate-spin" />
              <p className="text-sm text-muted-foreground">轉跳一般網頁...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
