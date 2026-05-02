// 🆕 ADR-0004: HostScreen 主控大螢幕端
//
// 路徑：/host/:sessionId?token={hostToken}
// 用途：投影機 / 大電視 / OBS 直播 source
//
// 行為：
//   - 無需 Firebase auth（hostToken 即身份）
//   - 自動全螢幕、深色背景
//   - 不顯示 PlayerBottomNav / FloatingHomeButton / PWAInstallPrompt
//   - 連 WS 後送 host_screen_register（role: 'host', hostToken）
//   - 收 host_screen_pulse（玩家動作）+ 廣播 host_screen_state（狀態同步）

import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, Tv } from "lucide-react";
import HostPageRenderer from "@/components/game/host/HostPageRenderer";
import type { Page } from "@shared/schema";

interface HostSessionInfo {
  sessionId: string;
  gameId: string;
  gameTitle: string;
  startedAt: string;
  expiresAt: string;
}

export default function HostScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL 取 token
  const hostToken = new URLSearchParams(window.location.search).get("token");

  const { data: info, isLoading } = useQuery<HostSessionInfo>({
    queryKey: ["/api/host-sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/host-sessions/${sessionId}`);
      if (!res.ok) throw new Error("session 不存在或已結束");
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

  // 找第一個 host_* pageType 的頁
  const hostPage = pages?.find((p) => p.pageType.startsWith("host_"));

  // 建立 WebSocket
  useEffect(() => {
    if (!sessionId || !hostToken) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({
        type: "host_screen_register",
        sessionId,
        hostToken,
        role: "host",
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "host_screen_error") {
          setError(msg.message);
          setWsConnected(false);
        }
        // 其他事件交給元件層處理（state 由元件 dispatch）
      } catch { /* ignore */ }
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setError("WebSocket 連線失敗");

    return () => {
      ws.close();
    };
  }, [sessionId, hostToken]);

  // 嘗試自動全螢幕（需使用者互動觸發 — 大螢幕模式 admin 應該主動點全螢幕）
  // 這裡只提供按鈕，不強制 fullscreen API（會被瀏覽器擋）

  if (!sessionId || !hostToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-700">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">缺少 host token</h1>
            <p className="text-sm text-zinc-400">
              請從 admin 後台「主控大螢幕」拿完整網址（含 ?token=...）
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-700">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">{error || "無法載入"}</h1>
            <p className="text-sm text-zinc-400">請通知 admin 重新發放網址</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase 1 W1：先顯示 placeholder（PollLive 等元件 W2 起逐個接入）
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 頂部狀態列 */}
      <div className="px-8 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Tv className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold">{info.gameTitle}</h1>
            <p className="text-xs text-zinc-400">主控大螢幕模式 · Session {sessionId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-zinc-600"}`} />
          {wsConnected ? "已連線" : "連線中..."}
        </div>
      </div>

      {/* 主舞台 */}
      <main className="flex-1 flex flex-col">
        {hostPage ? (
          // 有 host_* pageType → 渲染對應元件（PollLive / EmojiReact ...）
          <div className="flex-1 flex">
            <HostPageRenderer page={hostPage} />
          </div>
        ) : (
          // 沒有對應 pageType → 顯示等待畫面 + 玩家網址
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="max-w-2xl w-full bg-zinc-900 border-zinc-700">
              <CardContent className="p-12 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Tv className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-display font-bold">主控大螢幕已就緒</h2>
                <p className="text-zinc-400">
                  此 session 對應的遊戲沒有 host_* 頁面，請通知 admin 加入 host_poll_live 等頁面
                </p>
                <div className="bg-zinc-800/50 rounded-lg p-4 text-left text-sm space-y-2">
                  <p className="text-zinc-300">📺 玩家網址：</p>
                  <code className="text-emerald-400 break-all">
                    {window.location.origin}/play/{sessionId}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* 底部資訊 */}
      <div className="px-8 py-3 border-t border-zinc-800 text-xs text-zinc-500 text-center">
        ADR-0004 · HostScreen 軸線 · {new Date().toLocaleTimeString("zh-TW")}
      </div>
    </div>
  );
}
