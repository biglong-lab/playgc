// 📻 玩家端浮動對講機
//
// 流程：
//   0. 展開時先看是否已有加入的語音群組 → 有 → 直接進通話模式
//   1. 若無，顯示三個選項：建立群組 / 加入群組 / 跟隊友（有 teamId 才啟用）
//   2. 選定後拿 token 連 LiveKit → PTT 介面
//
// 退出條件：按 ✕ 收合面板（但群組身份保留，重開時自動恢復）
//          按「離開群組」才真正退出 walkie_groups 成員資格

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Radio, Mic, MicOff, X, Users, AlertTriangle,
  Plus, UserPlus, Copy, LogOut, Check, QrCode, Camera,
  Share2,
} from "lucide-react";
import { useWalkieRoom } from "@/hooks/useWalkieRoom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WalkieQRCode, buildWalkieShareUrl } from "./WalkieQRCode";
import { WalkieQRScanner } from "./WalkieQRScanner";

interface WalkieFloatingButtonProps {
  /** 當前遊戲 session（可選，沒有就只能用群組模式）*/
  sessionId?: string | null;
  /** 當前遊戲 ID（建群時帶入）*/
  gameId?: string | null;
  /** 是否顯示 */
  enabled?: boolean;
}

interface WalkieGroup {
  id: string;
  accessCode: string;
  displayName?: string | null;
  expiresAt?: string | null;
}

type ViewMode = "menu" | "create" | "join" | "in-group" | "in-session";

export function WalkieFloatingButton({
  sessionId,
  gameId,
  enabled = true,
}: WalkieFloatingButtonProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ViewMode>("menu");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [useSessionMode, setUseSessionMode] = useState(false); // 使用者選「跟 session 隊友」時
  const [showQR, setShowQR] = useState(true);                  // in-group 時預設顯示 QR（比代碼直覺）
  const [scanning, setScanning] = useState(false);             // 掃碼模式

  // 取得目前已加入的群組
  const { data: myGroupData, refetch: refetchMyGroup } = useQuery<{ group: WalkieGroup | null }>({
    queryKey: ["/api/walkie/groups/my"],
    enabled,
  });

  const myGroup = myGroupData?.group ?? null;

  // 若已有群組 → 自動進入 in-group 模式
  useEffect(() => {
    if (myGroup && view === "menu") {
      setView("in-group");
    }
  }, [myGroup, view]);

  // 決定連線參數
  const connectParams = (() => {
    if (view === "in-group" && myGroup) {
      return { groupId: myGroup.id, sessionId: null };
    }
    if (view === "in-session" || useSessionMode) {
      return { groupId: null, sessionId: sessionId ?? null };
    }
    return { groupId: null, sessionId: null };
  })();

  const {
    isConnected,
    error,
    participants,
    isTransmitting,
    canPlaybackAudio,
    startTalking,
    stopTalking,
    startAudio,
  } = useWalkieRoom({
    sessionId: connectParams.sessionId,
    groupId: connectParams.groupId,
    enabled: enabled && (!!connectParams.groupId || !!connectParams.sessionId),
  });

  const remoteSpeaking = participants.filter((p) => !p.isLocal && p.isSpeaking);
  const hasActiveSpeaker = remoteSpeaking.length > 0;

  // 建組
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/walkie/groups", { gameId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "建立群組失敗");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/walkie/groups/my"] });
      refetchMyGroup();
      setView("in-group");
      toast({ title: "✅ 語音群組已建立" });
    },
    onError: (err: Error) => {
      toast({
        title: "建立失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 加組
  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/walkie/groups/join", {
        accessCode: code,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "加入失敗");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/walkie/groups/my"] });
      refetchMyGroup();
      setView("in-group");
      setJoinCode("");
      toast({ title: "✅ 已加入語音群組" });
    },
    onError: (err: Error) => {
      toast({
        title: "加入失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 離組
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!myGroup) return;
      await apiRequest("POST", `/api/walkie/groups/${myGroup.id}/leave`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/walkie/groups/my"] });
      refetchMyGroup();
      setView("menu");
      setUseSessionMode(false);
      toast({ title: "已離開群組" });
    },
  });

  const onPressStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      // 🔊 每次 PTT 按下也順手 startAudio（iOS Safari 音訊啟用保險）
      startAudio();
      startTalking();
    },
    [startAudio, startTalking],
  );

  const onPressEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      stopTalking();
    },
    [stopTalking],
  );

  const handleCopyCode = () => {
    if (!myGroup) return;
    navigator.clipboard.writeText(myGroup.accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /** 實際觸發分享動作（原生 share sheet + 複製 fallback）*/
  const shareGroupLink = useCallback(
    async (accessCode: string) => {
      const shareUrl = buildWalkieShareUrl(accessCode);
      const shareData = {
        title: "對講機邀請",
        text: `來加入我的語音群組一起玩！代碼 ${accessCode}`,
        url: shareUrl,
      };
      // 優先 Web Share API（iOS / Android 原生 share sheet）
      if (typeof navigator.share === "function") {
        try {
          await navigator.share(shareData);
        } catch (err) {
          // 使用者取消 → silent；其他錯誤 → 印 log
          if (err instanceof Error && err.name !== "AbortError") {
            console.warn("[walkie] share failed:", err);
          }
        }
        return;
      }
      // Fallback：複製連結
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "已複製邀請連結",
          description: "貼給朋友就能加入",
        });
      } catch {
        toast({
          title: "無法分享",
          description: "請手動複製代碼",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  /** 分享現有群組（in-group 時用）*/
  const handleShare = useCallback(() => {
    if (!myGroup) return;
    shareGroupLink(myGroup.accessCode);
  }, [myGroup, shareGroupLink]);

  /**
   * 🌟 Stage 3 核心：一鍵「邀請朋友」
   * 若未在群組：自動建組 → 立刻跳分享 sheet
   * 若已在群組：直接分享
   */
  const handleInviteFriends = useCallback(async () => {
    if (myGroup) {
      // 已有群組 → 直接分享
      await shareGroupLink(myGroup.accessCode);
      return;
    }
    try {
      const res = await apiRequest("POST", "/api/walkie/groups", { gameId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "建立群組失敗");
      }
      const newGroup = (await res.json()) as WalkieGroup;
      queryClient.invalidateQueries({ queryKey: ["/api/walkie/groups/my"] });
      refetchMyGroup();
      setView("in-group");
      // ⚠️ 關鍵：建組成功「立刻」呼叫 share（仍在 user gesture 內，iOS Safari 允許）
      await shareGroupLink(newGroup.accessCode);
      toast({
        title: "✅ 已建立並分享",
        description: `代碼 ${newGroup.accessCode}`,
      });
    } catch (err) {
      toast({
        title: "邀請失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    }
  }, [myGroup, gameId, shareGroupLink, refetchMyGroup, toast]);

  useEffect(() => {
    const handleLeave = () => stopTalking();
    window.addEventListener("blur", handleLeave);
    return () => window.removeEventListener("blur", handleLeave);
  }, [stopTalking]);

  if (!enabled) return null;

  const showingInRoom = view === "in-group" || view === "in-session";

  return (
    <>
      {/* 浮動按鈕（收合） */}
      <AnimatePresence>
        {!expanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={() => setExpanded(true)}
            className="fixed bottom-20 right-4 z-[1100] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
            data-testid="walkie-open"
          >
            <Radio className="w-6 h-6" />
            {/* 已連線群組：綠色狀態點 */}
            {showingInRoom && isConnected && (
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            )}
            {/* 未加群組但遊戲進行中：暗示可邀請朋友的小發光 */}
            {!showingInRoom && !myGroup && sessionId && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-background animate-pulse" title="可邀請朋友" />
            )}
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

      {/* 展開面板 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-20 right-4 z-[1100] w-80 bg-card border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">隊伍對講機</span>
                {showingInRoom && isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-muted-foreground hover:text-foreground"
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

            {/* === View: MENU（選擇入口）=== */}
            {view === "menu" && (
              <div className="p-3 space-y-2">
                {/* 🌟 Stage 3 主按鈕：邀請朋友（自動建組 + 立刻分享）*/}
                <button
                  onClick={handleInviteFriends}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-left shadow-sm"
                  data-testid="walkie-invite"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">📤 邀請朋友一起玩</div>
                    <div className="text-xs opacity-90">
                      一鍵分享 LINE / Messages，朋友點連結就加入
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground">
                    或加入朋友的群組
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* 📷 掃碼加入（次要）*/}
                <button
                  onClick={() => setScanning(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-accent transition-colors text-left"
                  data-testid="walkie-scan-qr"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">📷 掃朋友的 QR</div>
                  </div>
                </button>

                {/* 輸入代碼（收合為小選項）*/}
                <button
                  onClick={() => setView("join")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left text-xs text-muted-foreground"
                  data-testid="walkie-join-group"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>或手動輸入 6 碼</span>
                </button>

                {sessionId && (
                  <button
                    onClick={() => {
                      setUseSessionMode(true);
                      setView("in-session");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left text-xs text-muted-foreground"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>跟遊戲隊友對講（若有組隊）</span>
                  </button>
                )}

                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  本對話不儲存
                </p>
              </div>
            )}

            {/* === View: JOIN（輸入代碼）=== */}
            {view === "join" && (
              <div className="p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  輸入朋友分享的 6 碼
                </p>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例：AB3FX2"
                  maxLength={8}
                  className="h-11 text-center text-lg tracking-widest font-mono uppercase"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setView("menu")}
                  >
                    返回
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => joinMutation.mutate(joinCode.trim())}
                    disabled={joinCode.trim().length < 4 || joinMutation.isPending}
                  >
                    加入
                  </Button>
                </div>
              </div>
            )}

            {/* === View: IN-GROUP / IN-SESSION（連線中，共用 UI）=== */}
            {showingInRoom && (
              <>
                {/* 🔊 iOS Safari 擋了自動播放 → 提示用戶點按啟用 */}
                {!canPlaybackAudio && isConnected && (
                  <button
                    onClick={startAudio}
                    className="w-full px-3 py-2 bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-600"
                  >
                    🔊 點此啟用音訊播放
                  </button>
                )}

                {/* 群組資訊（只有 in-group 顯示）*/}
                {view === "in-group" && myGroup && (
                  <div className="px-3 py-3 bg-primary/5 border-b space-y-2">
                    {/* 🆕 主動分享按鈕（原生 share sheet：LINE/iMessage/AirDrop）*/}
                    <Button
                      onClick={handleShare}
                      className="w-full gap-2"
                      size="sm"
                      data-testid="walkie-share-btn"
                    >
                      <Share2 className="w-4 h-4" />
                      分享邀請連結給朋友
                    </Button>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {showQR ? "或讓朋友掃 QR 加入 👇" : "或給代碼"}
                      </span>
                      <div className="flex gap-1 text-[10px]">
                        <button
                          onClick={() => setShowQR(true)}
                          className={`px-2 py-0.5 rounded ${
                            showQR
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          QR
                        </button>
                        <button
                          onClick={() => setShowQR(false)}
                          className={`px-2 py-0.5 rounded ${
                            !showQR
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          代碼
                        </button>
                      </div>
                    </div>

                    {showQR ? (
                      /* QR 顯示（預設）*/
                      <div className="flex flex-col items-center gap-2">
                        <WalkieQRCode code={myGroup.accessCode} size={180} />
                        <div className="text-[11px] text-muted-foreground font-mono tracking-widest">
                          {myGroup.accessCode}
                        </div>
                      </div>
                    ) : (
                      /* 代碼模式（每格獨立，避免 M/N 誤認）*/
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {myGroup.accessCode.split("").map((ch, i) => (
                              <div
                                key={i}
                                className="flex-1 h-9 flex items-center justify-center rounded border-2 border-primary/30 bg-background font-bold text-lg font-mono text-primary"
                              >
                                {ch}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={handleCopyCode}
                            className="p-2 rounded hover:bg-primary/10 text-primary shrink-0"
                            title="複製"
                          >
                            {copied ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          複製貼給朋友，避免手動輸入打錯字
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* 參與者列表 */}
                <div className="px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
                  {participants.length === 0 && isConnected && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      等待其他人加入...
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
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={p.isLocal ? "font-medium" : ""}>
                        {p.name}
                        {p.isLocal && (
                          <span className="text-xs text-muted-foreground ml-1">
                            （我）
                          </span>
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

                  {/* 離開按鈕 */}
                  <button
                    onClick={() => {
                      if (view === "in-group") {
                        leaveMutation.mutate();
                      } else {
                        setUseSessionMode(false);
                        setView("menu");
                      }
                    }}
                    className="w-full mt-2 py-1.5 text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    {view === "in-group" ? "離開群組" : "切換模式"}
                  </button>

                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    本對話不儲存
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📷 QR 掃描器（全螢幕 overlay，掃到自動加入）*/}
      <AnimatePresence>
        {scanning && (
          <WalkieQRScanner
            onDetect={(code) => {
              setScanning(false);
              joinMutation.mutate(code);
            }}
            onClose={() => setScanning(false)}
            onSwitchToManual={() => {
              setScanning(false);
              setExpanded(true);
              setView("join");
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
