// 📊 管理者即時遊戲狀態儀表板
//
// 功能：
//   - 即時顯示正在遊戲的人數（5 秒自動 refresh）
//   - 依隊伍分組顯示
//   - 「🔊 全場廣播」按鈕：按住 PTT 對所有 active team 廣播
//   - 顯示哪些 team 的對講機在線

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Users, Radio, Mic, MicOff, AlertTriangle, Megaphone,
  RefreshCcw, CheckCircle2, XCircle, BarChart3, TrendingUp, Trophy,
} from "lucide-react";
import { Room, RoomEvent, ConnectionState } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";

interface LiveStatsTeam {
  teamId: string | null;
  teamName: string;
  sessionIds: string[];
  gameIds: string[];
  memberCount: number;
  walkieOnline: number;
  hasWalkie: boolean;
}

interface LiveStatsResponse {
  totalPlaying: number;
  teams: LiveStatsTeam[];
  sessionCount: number;
  liveKitEnabled: boolean;
  refreshedAt: string;
}

interface BroadcastToken {
  roomName: string;
  token: string;
  memberCount: number;
}

interface BroadcastTokensResponse {
  tokens: BroadcastToken[];
  wsUrl: string;
  broadcasterName: string;
}

export default function AdminLive() {
  const { toast } = useToast();
  const [broadcasting, setBroadcasting] = useState<BroadcastTokensResponse | null>(
    null,
  );
  // 🆕 選中的 teamId 清單（勾選廣播模式）
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  // 即時統計（5 秒自動 refresh）
  const { data: stats, refetch } = useQuery<LiveStatsResponse>({
    queryKey: ["/api/admin/walkie/live-stats"],
    queryFn: () => fetchWithAdminAuth("/api/admin/walkie/live-stats"),
    refetchInterval: 5000,
    staleTime: 4000,
  });

  /** 統一的廣播啟動 helper */
  const startBroadcast = useCallback(
    async (payload: Record<string, unknown>, label: string) => {
      try {
        const res = await apiRequest(
          "POST",
          "/api/admin/walkie/broadcast-tokens",
          payload,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "取得廣播 token 失敗");
        }
        const data = (await res.json()) as BroadcastTokensResponse;
        if (data.tokens.length === 0) {
          toast({
            title: "沒有可廣播對象",
            description: `${label}目前沒有玩家在遊戲中`,
            variant: "destructive",
          });
          return;
        }
        setBroadcasting(data);
      } catch (err) {
        toast({
          title: "無法開始廣播",
          description: err instanceof Error ? err.message : "未知錯誤",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleBroadcastAll = useCallback(() => {
    startBroadcast({ target: "all" }, "全場");
  }, [startBroadcast]);

  const handleBroadcastSingle = useCallback(
    (teamId: string, teamName: string) => {
      startBroadcast(
        { target: "selected", teamIds: [teamId] },
        `${teamName} `,
      );
    },
    [startBroadcast],
  );

  const handleBroadcastSelected = useCallback(() => {
    if (selectedTeamIds.length === 0) return;
    startBroadcast(
      { target: "selected", teamIds: selectedTeamIds },
      `已勾選 ${selectedTeamIds.length} 隊`,
    );
  }, [selectedTeamIds, startBroadcast]);

  /** Checkbox toggle */
  const toggleTeamSelection = useCallback((teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  }, []);

  /** 勾選的隊伍人數合計 */
  const selectedMemberCount = (stats?.teams ?? [])
    .filter((t) => t.teamId && selectedTeamIds.includes(t.teamId))
    .reduce((sum, t) => sum + t.memberCount, 0);

  return (
    <UnifiedAdminLayout
      title="📊 即時遊戲狀態"
      actions={
        <Button
          onClick={() => refetch()}
          size="sm"
          variant="outline"
          className="gap-1"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          立即刷新
        </Button>
      }
    >
      <div className="p-6 space-y-6">
        {/* 上方大數字統計卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="正在遊戲"
            value={stats?.totalPlaying ?? 0}
            suffix="人"
            color="bg-emerald-500"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="活躍隊伍"
            value={stats?.teams?.length ?? 0}
            suffix="隊"
            color="bg-blue-500"
          />
          <StatCard
            icon={<Radio className="w-5 h-5" />}
            label="對講機在線"
            value={
              stats?.teams?.reduce((sum, t) => sum + t.walkieOnline, 0) ?? 0
            }
            suffix="人"
            color="bg-orange-500"
          />
          <StatCard
            icon={<Mic className="w-5 h-5" />}
            label="Session 數"
            value={stats?.sessionCount ?? 0}
            suffix="場"
            color="bg-purple-500"
          />
        </div>

        {/* 全場廣播按鈕（大） */}
        {stats?.liveKitEnabled === false && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="flex items-start gap-2 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-700 dark:text-amber-400">
                  對講機服務未啟用
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  請確認伺服器的 LIVEKIT_API_KEY 環境變數已設定
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.liveKitEnabled && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    全場廣播
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    對目前所有在遊戲中的玩家（{stats?.totalPlaying ?? 0} 人）發送語音通知
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleBroadcastAll}
                  disabled={!stats?.totalPlaying}
                  className="gap-2"
                >
                  <Megaphone className="w-5 h-5" />
                  開始全場廣播
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 隊伍清單 — 支援勾選多隊 + 單隊廣播 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>隊伍清單</CardTitle>
              {/* 🆕 勾選模式的快速動作 */}
              {selectedTeamIds.length > 0 && stats?.liveKitEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    已選 {selectedTeamIds.length} 隊（{selectedMemberCount} 人）
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTeamIds([])}
                  >
                    清除
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBroadcastSelected}
                    className="gap-1"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    廣播給已選隊伍
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!stats?.teams || stats.teams.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                目前沒有隊伍在遊戲中
              </p>
            ) : (
              <div className="space-y-2">
                {stats.teams.map((team) => {
                  const checkboxId = team.teamId;
                  const isChecked =
                    !!checkboxId && selectedTeamIds.includes(checkboxId);
                  return (
                  <div
                    key={team.teamId || team.sessionIds[0]}
                    className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg hover:bg-accent/50 transition-colors ${
                      isChecked ? "ring-1 ring-primary bg-primary/5" : ""
                    }`}
                  >
                    {/* 🆕 checkbox（無 teamId 的不可勾，如個人模式 session） */}
                    {checkboxId ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTeamSelection(checkboxId)}
                        className="shrink-0 w-4 h-4"
                        data-testid={`team-checkbox-${checkboxId}`}
                      />
                    ) : (
                      <span className="w-4 h-4 shrink-0" />
                    )}
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {team.teamName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Session: {team.sessionIds.length} · 遊戲: {team.gameIds.length}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {team.memberCount} 人
                    </Badge>
                    <Badge
                      variant={team.hasWalkie ? "default" : "outline"}
                      className={`shrink-0 gap-1 ${
                        team.hasWalkie ? "bg-emerald-500 hover:bg-emerald-500/90" : ""
                      }`}
                    >
                      {team.hasWalkie ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          {team.walkieOnline} 在對講
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          無人連線
                        </>
                      )}
                    </Badge>
                    {/* 🆕 單獨廣播此隊按鈕（僅有 teamId + 有玩家時啟用） */}
                    {checkboxId && stats?.liveKitEnabled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 shrink-0"
                        onClick={() =>
                          handleBroadcastSingle(checkboxId, team.teamName)
                        }
                        disabled={team.memberCount === 0}
                        title={`廣播給 ${team.teamName}`}
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span className="hidden md:inline text-xs">廣播</span>
                      </Button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最後刷新時間 */}
        {stats?.refreshedAt && (
          <p className="text-xs text-muted-foreground text-right">
            最後刷新：{new Date(stats.refreshedAt).toLocaleTimeString("zh-TW")}
          </p>
        )}
      </div>

      {/* 廣播 Modal */}
      <AnimatePresence>
        {broadcasting && (
          <BroadcastModal
            data={broadcasting}
            onClose={() => setBroadcasting(null)}
          />
        )}
      </AnimatePresence>
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {value}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {suffix}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Broadcast Modal — 按住 PTT 對多 room 同時 publish
// ============================================================================

function BroadcastModal({
  data,
  onClose,
}: {
  data: BroadcastTokensResponse;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const totalMembers = data.tokens.reduce((sum, t) => sum + t.memberCount, 0);

  // 同時連接多個 room
  useEffect(() => {
    let cancelled = false;
    const connected: Room[] = [];

    (async () => {
      try {
        for (const t of data.tokens) {
          const room = new Room({
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          room.on(RoomEvent.ConnectionStateChanged, (state) => {
            if (state === ConnectionState.Disconnected && !cancelled) {
              console.warn(`[broadcast] room ${t.roomName} disconnected`);
            }
          });
          await room.connect(data.wsUrl, t.token);
          // 預設靜音（只在 PTT 按下時開）
          await room.localParticipant.setMicrophoneEnabled(false);
          connected.push(room);
          if (cancelled) break;
        }
        if (!cancelled) {
          setRooms(connected);
          setConnecting(false);
        }
      } catch (err) {
        console.error("[broadcast] connect failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "連線失敗");
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const r of connected) {
        r.disconnect();
      }
    };
  }, [data]);

  const startTalking = useCallback(
    async (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      try {
        await Promise.all(
          rooms.map((r) => r.localParticipant.setMicrophoneEnabled(true)),
        );
        setIsTransmitting(true);
      } catch (err) {
        toast({
          title: "開麥失敗",
          description: err instanceof Error ? err.message : "請確認麥克風權限",
          variant: "destructive",
        });
      }
    },
    [rooms, toast],
  );

  const stopTalking = useCallback(
    async (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      await Promise.all(
        rooms.map((r) => r.localParticipant.setMicrophoneEnabled(false)),
      );
      setIsTransmitting(false);
    },
    [rooms],
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-card rounded-xl p-6 w-full max-w-md shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              全場廣播中
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              連線至 {data.tokens.length} 個隊伍 · 共 {totalMembers} 位玩家
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {connecting && (
          <p className="text-center text-sm text-muted-foreground py-4">
            正在連線所有隊伍...
          </p>
        )}

        {/* PTT 按鈕 */}
        {!connecting && !error && rooms.length > 0 && (
          <>
            <button
              onMouseDown={startTalking}
              onMouseUp={stopTalking}
              onMouseLeave={stopTalking}
              onTouchStart={startTalking}
              onTouchEnd={stopTalking}
              className={`w-full py-6 rounded-xl font-bold text-lg transition-all select-none touch-none ${
                isTransmitting
                  ? "bg-red-500 text-white shadow-xl scale-95"
                  : "bg-primary text-primary-foreground hover:scale-[1.01]"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <div className="flex items-center justify-center gap-3">
                {isTransmitting ? (
                  <>
                    <Mic className="w-7 h-7 animate-pulse" />
                    <span>🔴 廣播中...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-7 h-7" />
                    <span>按住說話（廣播）</span>
                  </>
                )}
              </div>
            </button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              所有玩家都聽得到您的聲音（您聽不到玩家回應）
            </p>
          </>
        )}

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <MicOff className="w-4 h-4 mr-2" />
            結束廣播
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
