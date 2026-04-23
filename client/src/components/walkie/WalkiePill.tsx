// 🎤 對講機 Pill — 收合狀態的小膠囊
//
// 核心訴求（來自使用者）：
//   1. 縮小到不擋畫面
//   2. 不展開就能 PTT（按住講話，真實對講機行為）
//   3. 可拖動避開互動熱區
//   4. 無互動時淡出，不干擾遊戲視覺
//
// Pointer 行為：
//   - PointerDown → 等待 300ms 判斷「長按 PTT」or「點擊展開」
//   - 若 drag 距離 > 8px → 改為拖動模式（不觸發 PTT）
//   - 長按 → startTalking；放開 → stopTalking
//   - 短點擊（<300ms） → onClick 展開面板
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, QrCode } from "lucide-react";

interface WalkiePillProps {
  /** 是否已連到 LiveKit room */
  connected: boolean;
  /** 目前在線人數（含自己） */
  participantCount: number;
  /** 遠端有人在講話 */
  hasActiveSpeaker: boolean;
  /** 自己正在傳送（PTT 按住中） */
  isTransmitting: boolean;
  /** 是否顯示「邀請朋友」動畫（未加群組 + 遊戲中） */
  hasInvitePulse: boolean;
  /** 長按開始（PTT 開麥） — Pill 主體唯一功能 */
  onStartTalk: () => void;
  /** 放開結束（PTT 收麥） */
  onStopTalk: () => void;
  /**
   * 點擊 QR / 設定小按鈕 → 展開設定面板（QR + 代碼 + 成員 + 退出 + 啟用音訊）
   * 這是「所有設定 / 次功能」的唯一入口，實踐單一功能原則
   * 未加群組時傳 undefined（小按鈕不出現，只有 PTT 無法使用）
   */
  onOpenPanel?: () => void;
}

const STORAGE_POS = "walkie_pill_pos";
const DRAG_THRESHOLD_PX = 8;
const LONGPRESS_MS = 250;
const IDLE_FADE_MS = 3000;
const PILL_W = 96;
const PILL_H = 40;
const MARGIN = 16;

interface Pos {
  x: number; // 距右邊 px（right-based）
  y: number; // 距底部 px（bottom-based）
}

function loadPos(): Pos {
  try {
    const saved = localStorage.getItem(STORAGE_POS);
    if (saved) {
      const p = JSON.parse(saved) as Pos;
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch { /* ignore */ }
  // 預設：右下角（與原本位置相容）
  return { x: MARGIN, y: 80 };
}

function savePos(pos: Pos) {
  try {
    localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
  } catch { /* ignore */ }
}

export function WalkiePill({
  connected,
  participantCount,
  hasActiveSpeaker,
  isTransmitting,
  hasInvitePulse,
  onStartTalk,
  onStopTalk,
  onOpenPanel,
}: WalkiePillProps) {
  const [pos, setPos] = useState<Pos>(loadPos);
  const [dragging, setDragging] = useState(false);
  const [idle, setIdle] = useState(false);

  // refs 用於區分 tap / longpress / drag
  const pressStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const talkingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🛑 清 idle timer
  const resetIdle = useCallback(() => {
    setIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_FADE_MS);
  }, []);

  // 初次 + 狀態變化時重置 idle 計時
  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle, connected, hasActiveSpeaker, isTransmitting]);

  // 有人講話/自己講話時強制亮起
  const forceVisible = hasActiveSpeaker || isTransmitting || dragging;

  const stopTalkingSafe = useCallback(() => {
    if (talkingRef.current) {
      talkingRef.current = false;
      onStopTalk();
    }
  }, [onStopTalk]);

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pressStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      draggingRef.current = false;
      resetIdle();

      // 先起 LongPress 計時：到時間且沒拖動就觸發 PTT
      longPressTimerRef.current = setTimeout(() => {
        if (!draggingRef.current && pressStartRef.current) {
          talkingRef.current = true;
          onStartTalk();
        }
      }, LONGPRESS_MS);
    },
    [onStartTalk, resetIdle],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pressStartRef.current) return;
      const dx = e.clientX - pressStartRef.current.x;
      const dy = e.clientY - pressStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (!draggingRef.current && dist > DRAG_THRESHOLD_PX) {
        // 進入拖動模式 → 取消 longpress
        draggingRef.current = true;
        setDragging(true);
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        // 若已開始講話（超快的 longpress），拖動時也停止
        stopTalkingSafe();
      }

      if (draggingRef.current) {
        // right/bottom 值 = 螢幕寬高 - 滑鼠座標 - pill 尺寸/2
        const newX = window.innerWidth - e.clientX - PILL_W / 2;
        const newY = window.innerHeight - e.clientY - PILL_H / 2;
        // 邊界限制
        const clampedX = Math.max(
          MARGIN,
          Math.min(window.innerWidth - PILL_W - MARGIN, newX),
        );
        const clampedY = Math.max(
          MARGIN,
          Math.min(window.innerHeight - PILL_H - MARGIN, newY),
        );
        setPos({ x: clampedX, y: clampedY });
      }
    },
    [stopTalkingSafe],
  );

  const handlePointerUp = useCallback(() => {
    pressStartRef.current = null;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 狀態 1：拖動結束 → 存位置
    if (draggingRef.current) {
      draggingRef.current = false;
      setDragging(false);
      savePos(pos);
      resetIdle();
      return;
    }

    // 狀態 2：長按講話中 → 放開停止
    if (talkingRef.current) {
      stopTalkingSafe();
      resetIdle();
      return;
    }

    // 狀態 3：短點擊 → 不做任何事（單一功能原則：Pill 主體只負責 PTT）
    // 展開設定請透過右上 QR 小按鈕
    resetIdle();
  }, [pos, stopTalkingSafe, resetIdle]);

  const handlePointerCancel = useCallback(() => {
    // iOS 滑走 / 系統中斷 → 安全收尾
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    stopTalkingSafe();
    if (draggingRef.current) {
      draggingRef.current = false;
      setDragging(false);
      savePos(pos);
    }
    pressStartRef.current = null;
  }, [pos, stopTalkingSafe]);

  // 卸載時安全收尾
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      stopTalkingSafe();
    };
  }, [stopTalkingSafe]);

  // 色系 / 邊框狀態
  const bgClass = isTransmitting
    ? "bg-red-500 text-white"
    : hasActiveSpeaker
      ? "bg-emerald-600 text-white"
      : connected
        ? "bg-primary text-primary-foreground"
        : "bg-card text-foreground border";

  const opacity = dragging ? 1 : idle && !forceVisible ? 0.35 : 1;

  // 設定按鈕（QR icon）事件處理 — stopPropagation 避免觸發 Pill 的 onPointerDown
  const handleQrPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);
  const handleQrClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      resetIdle();
      onOpenPanel?.();
    },
    [onOpenPanel, resetIdle],
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.2 } }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`fixed select-none touch-none rounded-full shadow-lg flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${bgClass} ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={{
        right: pos.x,
        bottom: pos.y,
        width: PILL_W,
        height: PILL_H,
        touchAction: "none",
        // 🔒 inline zIndex 最大保險：不依賴 Tailwind JIT，絕對覆蓋任何 CSS 繼承
        zIndex: 2147483647, // int32 max — 不可能被超過
      }}
      data-testid="walkie-pill"
      title={
        connected
          ? "長按講話 · 點擊展開 · 拖動換位"
          : "點擊展開"
      }
    >
      {/* 麥克風 icon — 自己講話時脈動 */}
      {isTransmitting ? (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="shrink-0"
        >
          <Mic className="w-5 h-5" />
        </motion.div>
      ) : (
        <Mic className="w-5 h-5 shrink-0" />
      )}

      {/* 文字區塊 */}
      <div className="flex items-center gap-0.5 text-xs font-medium">
        {connected ? (
          <>
            <span className="tabular-nums font-number">{participantCount}</span>
            <span>人</span>
          </>
        ) : (
          <span>對講</span>
        )}
      </div>

      {/* 邀請朋友脈動提示（未加群組 + 有遊戲中） */}
      {hasInvitePulse && !connected && (
        <span
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-background animate-pulse"
          title="可邀請朋友"
        />
      )}

      {/* 有人講話時綠脈動邊框 */}
      {hasActiveSpeaker && !isTransmitting && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-emerald-400 pointer-events-none"
          animate={{ opacity: [0.7, 0.2, 0.7] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* 自己講話時紅脈動邊框 */}
      {isTransmitting && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-red-300 pointer-events-none"
          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* 🆕 QR 快捷按鈕（只在已加群組 + 有 onShowQR 時顯示） */}
      {connected && onShowQR && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          onPointerDown={handleQrPointerDown}
          onClick={handleQrClick}
          className="absolute -right-2 -top-2 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform"
          style={{ touchAction: "manipulation" }}
          title="顯示 QR 邀請朋友"
          data-testid="walkie-pill-qr-btn"
          aria-label="顯示 QR Code"
        >
          <QrCode className="w-4 h-4 text-primary" />
        </motion.button>
      )}
    </motion.div>
  );
}
