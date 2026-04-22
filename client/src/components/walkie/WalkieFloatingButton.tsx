// 📻 玩家端浮動對講機按鈕
//
// 位置：遊戲頁面右下角（類似 chat 按鈕）
// 收合：60px 圓形按鈕（紅點表示有連線 + 點狀動畫提示有人在說話）
// 展開：280px 面板顯示隊友列表 + PTT 按鈕

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Radio, Mic, MicOff, X, Users, AlertTriangle } from "lucide-react";
import { useWalkieRoom } from "@/hooks/useWalkieRoom";

interface WalkieFloatingButtonProps {
  sessionId: string;
  /** 是否顯示（離開遊戲頁時關閉）*/
  enabled?: boolean;
}

export function WalkieFloatingButton({
  sessionId,
  enabled = true,
}: WalkieFloatingButtonProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    isConnected,
    error,
    participants,
    isTransmitting,
    startTalking,
    stopTalking,
  } = useWalkieRoom({ sessionId, enabled });

  const remoteSpeaking = participants.filter(
    (p) => !p.isLocal && p.isSpeaking,
  );
  const hasActiveSpeaker = remoteSpeaking.length > 0;

  // PTT 事件：同時支援 touch + mouse
  const onPressStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startTalking();
    },
    [startTalking],
  );

  const onPressEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      stopTalking();
    },
    [stopTalking],
  );

  // 防止手機拖曳捲動時卡著「持續開麥」
  useEffect(() => {
    const handleLeave = () => stopTalking();
    window.addEventListener("blur", handleLeave);
    return () => window.removeEventListener("blur", handleLeave);
  }, [stopTalking]);

  if (!enabled) return null;

  return (
    <>
      {/* 🎙️ 浮動按鈕（收合狀態） */}
      <AnimatePresence>
        {!expanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={() => setExpanded(true)}
            className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
            data-testid="walkie-open"
          >
            <Radio className="w-6 h-6" />

            {/* 連線狀態小點 */}
            {isConnected && (
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            )}

            {/* 有人在說話 → 紅色 pulse */}
            {hasActiveSpeaker && (
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-red-500"
                animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* 📻 展開面板 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-20 right-4 z-40 w-72 bg-card border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">隊伍對講機</span>
                {isConnected ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-muted-foreground hover:text-foreground"
                data-testid="walkie-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 錯誤提示 */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 隊員清單 */}
            <div className="px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {participants.length === 0 && isConnected && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  等待隊員加入...
                </p>
              )}
              {participants.length === 0 && !isConnected && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  連線中...
                </p>
              )}
              {participants.map((p) => (
                <div
                  key={p.identity}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="relative">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    {p.isSpeaking && (
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-emerald-500"
                        animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <span className={p.isLocal ? "font-medium" : ""}>
                    {p.name}
                    {p.isLocal && (
                      <span className="text-xs text-muted-foreground ml-1">（我）</span>
                    )}
                  </span>
                  {p.isSpeaking && (
                    <span className="text-xs text-emerald-600">🟢 說話中</span>
                  )}
                </div>
              ))}
            </div>

            {/* PTT 按鈕 */}
            <div className="px-3 pb-3">
              <button
                disabled={!isConnected}
                onMouseDown={onPressStart}
                onMouseUp={onPressEnd}
                onMouseLeave={onPressEnd}
                onTouchStart={onPressStart}
                onTouchEnd={onPressEnd}
                className={`w-full py-3 rounded-lg font-medium transition-all select-none touch-none ${
                  isTransmitting
                    ? "bg-red-500 text-white shadow-lg scale-95"
                    : isConnected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                style={{ touchAction: "manipulation" }}
                data-testid="walkie-ptt"
              >
                <div className="flex items-center justify-center gap-2">
                  {isTransmitting ? (
                    <>
                      <Mic className="w-5 h-5 animate-pulse" />
                      <span>🔴 傳送中...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>按住講話</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span>連線中...</span>
                    </>
                  )}
                </div>
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                本對話不儲存
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
