// 🗺️ GpsTeamMissionPage — GpsTeamMission 元件的容器
//
// 角色：
//   - GpsTeamMission（純 UI）的容器層
//   - 從 gameId 自動找隊伍 + 隊員清單
//   - 用 useStableGeolocation 取自己位置
//   - 用 useTeamWebSocket 廣播自己位置 + 接隊友位置
//   - 組合成 teammates 陣列傳給 GpsTeamMission
//
// GamePageRenderer 用此元件對應 pageType="gps_team_mission"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.4

import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useStableGeolocation } from "@/lib/geolocation";
import GpsTeamMission, {
  type TeammateLocation,
  type GpsTriggerMode,
} from "./GpsTeamMission";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { GpsMissionConfig } from "@shared/schema";

export interface GpsTeamMissionPageProps {
  config: GpsMissionConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  /** 🆕 2026-05-07 A3：頁面 ID（持久化 reachedUserIds 用）*/
  pageId: string;
}

/**
 * 🆕 2026-05-07 A3：GpsTeamMission 持久化狀態
 * reachedUserIds 用陣列存（JSON 友好、Set 不能直接序列化）
 */
interface GpsTeamMissionPersistState extends Record<string, unknown> {
  reachedUserIds: string[];
}

const DEFAULT_GPS_TEAM_STATE: GpsTeamMissionPersistState = {
  reachedUserIds: [],
};

interface MyTeamResponse {
  id: string;
  members: Array<{
    userId: string;
    user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string };
  }>;
}

/** 從 user 物件取顯示名（fallback 鏈：firstName+lastName / email / userId） */
function deriveDisplayName(
  member: MyTeamResponse["members"][number],
): string {
  const u = member.user;
  if (!u) return member.userId.slice(0, 8);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (u.email) return u.email.split("@")[0];
  return u.id.slice(0, 8);
}

/** 廣播位置間隔（每 2 秒一次，跟 useTeamGpsFusion 一致） */
const LOCATION_BROADCAST_INTERVAL_MS = 2000;

export default function GpsTeamMissionPage({
  config,
  onComplete,
  gameId,
  sessionId,
  pageId,
}: GpsTeamMissionPageProps) {
  const { user } = useAuth();

  // 取隊伍
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });

  const teamId = myTeam?.id;
  const myUserId = user?.id ?? "";

  // 🆕 2026-05-07 A3：團隊持久化 reachedUserIds（解 R4：戶外活動重整不丟進度）
  const persistence = useTeamPagePersistence<GpsTeamMissionPersistState>({
    teamId: teamId ?? "",
    sessionId,
    pageId,
    componentType: "gps_team_mission",
    defaultState: DEFAULT_GPS_TEAM_STATE,
    enabled: !!teamId && !!user,
  });

  // 🆕 包裝 onComplete：完成時把 myUserId 加進 reachedUserIds（DB 持久化）
  // 玩家手機重整 → 載入 reachedUserIds → 不從零再跑一次
  const handleComplete = useCallback(
    (
      reward?: { points?: number; items?: string[] },
      nextPageId?: string,
    ) => {
      if (myUserId && persistence.isLoaded) {
        const current = persistence.state.reachedUserIds ?? [];
        if (!current.includes(myUserId)) {
          void persistence.updateState({
            reachedUserIds: [...current, myUserId],
          });
        }
      }
      onComplete(reward, nextPageId);
    },
    [myUserId, persistence, onComplete],
  );
  const myDisplayName = useMemo(() => {
    if (!user) return "我";
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
    if (user.email) return user.email.split("@")[0];
    return user.id.slice(0, 8);
  }, [user]);

  // 自己的位置（多採樣 + Kalman 穩定化）
  const { position: myPosition } = useStableGeolocation({
    enabled: !!teamId && !!user,
  });

  // 連 WebSocket 接隊友位置
  const { memberLocations, sendLocation } = useTeamWebSocket({
    teamId,
    userId: myUserId,
    userName: myDisplayName,
  });

  // 🆕 多人元件入場時提示玩家「建議開啟對講機」（同 session + 同 team 只一次）
  useWalkieSuggestion({ teamId });

  // 廣播自己位置給隊友（每 2 秒一次）
  useEffect(() => {
    if (!myPosition || !teamId) return;
    const intervalId = setInterval(() => {
      sendLocation(myPosition.lat, myPosition.lng, myPosition.accuracy);
    }, LOCATION_BROADCAST_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [myPosition, teamId, sendLocation]);

  // 組合 teammates 陣列：自己 + 隊友（從 memberLocations）
  const teammates: TeammateLocation[] = useMemo(() => {
    const members = myTeam?.members ?? [];
    const result: TeammateLocation[] = [];

    members.forEach((m) => {
      // 自己
      if (m.userId === myUserId && myPosition) {
        result.push({
          userId: myUserId,
          displayName: myDisplayName,
          lat: myPosition.lat,
          lng: myPosition.lng,
          accuracy: myPosition.accuracy,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      // 隊友（有廣播位置才加進去）
      const memberLoc = memberLocations.get(m.userId);
      if (memberLoc) {
        result.push({
          userId: m.userId,
          displayName: deriveDisplayName(m),
          lat: memberLoc.latitude,
          lng: memberLoc.longitude,
          accuracy: memberLoc.accuracy,
          timestamp: memberLoc.timestamp,
        });
      }
    });

    return result;
  }, [myTeam, memberLocations, myUserId, myPosition, myDisplayName]);

  // triggerMode 從 config 讀（預設 any）
  // 註：GpsMissionConfig schema 暫無 triggerMode 欄位，先預設 any
  // 未來在 admin form 加開關後從 config 讀取
  const triggerMode: GpsTriggerMode = "any";

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="gps-team-mission-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="gps-team-mission-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    return (
      <Card data-testid="gps-team-mission-page-no-team">
        <CardContent className="p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">此元件需要組隊使用</p>
          <p className="text-xs text-muted-foreground">
            請回到場域首頁建立或加入隊伍
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <GpsTeamMission
      config={config}
      myUserId={myUserId}
      teammates={teammates}
      triggerMode={triggerMode}
      onComplete={handleComplete}
    />
  );
}
