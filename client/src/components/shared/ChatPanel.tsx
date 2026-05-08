import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Send, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
// 🌐 Phase 2 (2026-05-08)：改用全域 WS Provider（feature flag 控）
import { useWebSocket } from "@/contexts/WebSocketContext";

// Phase 2 feature flag — 與 useTeamWebSocket 同 flag
const USE_GLOBAL_WS_PROVIDER = (import.meta.env.VITE_USE_GLOBAL_WS as string | undefined) === "true";

interface ChatPanelProps {
  sessionId: string;
  userId: string;
  userName: string;
  onClose: () => void;
}

export default function ChatPanel({ sessionId, userId, userName, onClose }: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isWsConnectedLegacy, setIsWsConnectedLegacy] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 🌐 Phase 2：Provider 版用 context state；Legacy 版用本地 state
  // (條件 hook 但 USE_GLOBAL_WS_PROVIDER 為 module 常數、不會變動 → 安全)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const wsProvider = USE_GLOBAL_WS_PROVIDER ? useWebSocket() : null;
  const isWsConnected = USE_GLOBAL_WS_PROVIDER ? (wsProvider?.isConnected ?? false) : isWsConnectedLegacy;

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", sessionId],
    // 用 state 而非 ref（ref 變更不觸發 render → query 永遠拿首次 ref 值 5000）
    refetchInterval: isWsConnected ? false : 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/chat/${sessionId}`, {
        message: content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", sessionId] });
    },
  });

  // 🌐 Phase 2：Provider 版 — 用 ensureConnected + registerOnConnect + subscribe
  useEffect(() => {
    if (!USE_GLOBAL_WS_PROVIDER || !wsProvider) return;
    const release = wsProvider.ensureConnected();
    const releaseJoin = wsProvider.registerOnConnect(`chat:${sessionId}:${userId}`, (ws) => {
      ws.send(
        JSON.stringify({
          type: "join",
          sessionId,
          userId,
          userName,
        }),
      );
    });
    const unsubscribe = wsProvider.subscribe((data) => {
      const d = data as { type?: string; sessionId?: string };
      if (d.type === "chat" && d.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat", sessionId] });
      }
    });
    return () => {
      releaseJoin();
      unsubscribe();
      release();
    };
  }, [sessionId, userId, userName, wsProvider]);

  // ↓↓↓ Legacy 版（feature flag = false）：原 new WebSocket 實作
  useEffect(() => {
    if (USE_GLOBAL_WS_PROVIDER) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsWsConnectedLegacy(true);
        ws.send(JSON.stringify({
          type: "join",
          sessionId,
          userId,
          userName,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat" && data.sessionId === sessionId) {
            queryClient.invalidateQueries({ queryKey: ["/api/chat", sessionId] });
          }
        } catch {
          // WebSocket 訊息解析失敗
        }
      };

      ws.onerror = () => {
        // WebSocket 錯誤已處理
      };

      ws.onclose = () => {
        setIsWsConnectedLegacy(false);
      };

      wsRef.current = ws;

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setIsWsConnectedLegacy(false);
      };
    } catch {
      // WebSocket 連線建立失敗
    }
  }, [sessionId, userId, userName]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    // 只走 REST（有 isAuthenticated + chatLimiter）；server 寫 DB 後 broadcast 給 WS 訂閱端
    // 移除原本「同時送 WS + REST」造成的雙寫 DB + 權限繞過問題（2026-05-03 P0 修）
    sendMessageMutation.mutate(message.trim());
    setMessage("");
  }, [message, sendMessageMutation]);

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // 訊息發送者頭像顯示：自己用 userName 首字、其他人用 userId 末 4 碼首字（暫時、未來補 user join 取真實名）
  const getMessageInitial = (msg: ChatMessage): string => {
    if (msg.userId === userId) return getInitial(userName);
    if (!msg.userId) return "?";
    return getInitial(msg.userId.slice(-4));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold">團隊聊天</h2>
            <p className="text-xs text-muted-foreground">
              {messages.length} 則訊息
            </p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          data-testid="button-close-chat"
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>還沒有訊息</p>
            <p className="text-sm">開始和隊友聊天吧!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isOwn = msg.userId === userId;
              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                  data-testid={`chat-message-${index}`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}>
                      {getMessageInitial(msg)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                    <div className={`rounded-lg px-3 py-2 ${
                      isOwn 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border border-border rounded-tl-none"
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="輸入訊息..."
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button 
            type="submit"
            size="icon"
            disabled={!message.trim() || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
