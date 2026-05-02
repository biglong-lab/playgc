// 🆕 ADR-0004: HostScreen 玩家手機端
//
// 路徑：/play/:sessionId
// 用途：玩家手機進入後跟主控大螢幕互動
//
// 行為：
//   - 可匿名（不強制登入）
//   - 連 WS 後送 host_screen_register（role: 'player'，不需 token）
//   - 收 host_screen_state（大螢幕廣播狀態）
//   - 送 host_screen_pulse（投票、emoji、按鈕觸發）

import { useEffect, useState, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, Smartphone } from "lucide-react";
import HostPageRenderer from "@/components/game/host/HostPageRenderer";
import type { Page } from "@shared/schema";

/**
 * W14 D2: 從 URL query 讀 LINE profile 並存 localStorage
 * Query 來自 LIFF 中繼頁（/liff/play/...）跳轉時帶的：
 *   ?line_user_id=...&line_display_name=...
 * 既有 Page 元件可從 localStorage `chitoUserName` 讀取
 */
function useLineProfileFromQuery(): string {
  const [name, setName] = useState<string>(() => {
    return localStorage.getItem("chitoUserName") || "";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lineName = params.get("line_display_name");
    if (lineName) {
      const cleaned = lineName.slice(0, 30);
      localStorage.setItem("chitoUserName", cleaned);
      setName(cleaned);
    }
  }, []);

  return name;
}

interface HostSessionInfo {
  sessionId: string;
  gameId: string;
  gameTitle: string;
}

export default function HostPlay() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myUserName = useLineProfileFromQuery();

  const { data: info, isLoading } = useQuery<HostSessionInfo>({
    queryKey: ["/api/host-sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/host-sessions/${sessionId}`);
      if (!res.ok) throw new Error("活動已結束或網址錯誤");
      return res.json();
    },
    enabled: !!sessionId,
  });

  // 載入該 game 的 pages（取第一個 host_* pageType 渲染）
  const { data: pages } = useQuery<Page[]>({
    queryKey: ["/api/games", info?.gameId, "pages"],
    queryFn: async () => {
      const res = await fetch(`/api/games/${info!.gameId}/pages`);
      if (!res.ok) throw new Error("無法載入 game pages");
      return res.json();
    },
    enabled: !!info?.gameId,
  });

  const hostPage = pages?.find((p) => p.pageType.startsWith("host_"));

  useEffect(() => {
    if (!sessionId) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({
        type: "host_screen_register",
        sessionId,
        role: "player",
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "host_screen_error") {
          setError(msg.message);
          setWsConnected(false);
        }
        // 元件層會自己訂閱 host_screen_state（之後 PollLive 等元件實作）
      } catch { /* ignore */ }
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setError("連線失敗");

    return () => {
      ws.close();
    };
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 safe-top safe-bottom">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">{error || "無法載入"}</h1>
            <p className="text-sm text-muted-foreground">活動已結束或主辦方未開啟，請通知主辦方</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-bottom-nav md:pb-0">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm">{info.gameTitle}</h1>
              <p className="text-xs text-muted-foreground">主控活動 · 互動中</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {myUserName && (
              <span className="text-emerald-600 font-medium" data-testid="header-line-name">
                👋 {myUserName}
              </span>
            )}
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-zinc-400"}`} />
            {wsConnected ? "已連線" : "連線中"}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-md">
        {hostPage ? (
          // 有 host_* pageType → 渲染對應元件玩家版（W14 D2 帶 LINE 名字）
          <HostPageRenderer page={hostPage} myUserName={myUserName || undefined} />
        ) : (
          // 沒有 → 等待畫面
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold">準備好了！</h2>
            <p className="text-sm text-muted-foreground">
              主辦方啟動互動元件後（投票、emoji、搶答等），這裡會出現對應的操作介面。
            </p>
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
              💡 看大螢幕跟著互動，遊戲體驗最佳
            </div>
          </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
}
