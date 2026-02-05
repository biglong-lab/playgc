import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Send, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";

interface ChatPanelProps {
  sessionId: string;
  userId: string;
  userName: string;
  onClose: () => void;
}

export default function ChatPanel({ sessionId, userId, userName, onClose }: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", sessionId],
    refetchInterval: wsRef.current ? false : 5000,
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

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
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
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (e) {
      console.error("Failed to create WebSocket connection:", e);
    }
  }, [sessionId, userId, userName]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        sessionId,
        userId,
        userName,
        message: message.trim(),
      }));
    }

    sendMessageMutation.mutate(message.trim());
    setMessage("");
  }, [message, sessionId, userId, userName, sendMessageMutation]);

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
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
                      {getInitial(userName)}
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
