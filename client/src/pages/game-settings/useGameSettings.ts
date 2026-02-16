import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Game, User } from "@shared/schema";

// 遊戲模式型別
export type GameMode = "individual" | "team";
export type TeamScoreMode = "shared" | "individual" | "hybrid";
export type GameStructure = "linear" | "chapters";
export type ChapterUnlockMode = "sequential" | "manual" | "all_open";

// 地點鎖定 state
export interface LocationLockState {
  locationLockEnabled: boolean;
  lockLatitude: string;
  lockLongitude: string;
  lockRadius: string;
  lockLocationName: string;
  isGettingLocation: boolean;
}

// 團隊模式 state
export interface TeamModeState {
  gameMode: GameMode;
  minTeamPlayers: string;
  maxTeamPlayers: string;
  enableTeamChat: boolean;
  enableTeamVoice: boolean;
  enableTeamLocation: boolean;
  teamScoreMode: TeamScoreMode;
}

// 章節系統 state
export interface ChapterState {
  gameStructure: GameStructure;
  chapterUnlockMode: ChapterUnlockMode;
  allowChapterReplay: boolean;
}

// Hook 回傳值
export interface GameSettingsReturn {
  // 基本資訊
  game: Game | undefined;
  isLoading: boolean;
  canEdit: boolean;
  basePath: string;
  // 地點鎖定
  locationLock: LocationLockState;
  setLocationLockEnabled: (v: boolean) => void;
  setLockLatitude: (v: string) => void;
  setLockLongitude: (v: string) => void;
  setLockRadius: (v: string) => void;
  setLockLocationName: (v: string) => void;
  getCurrentLocation: () => void;
  // 團隊模式
  teamMode: TeamModeState;
  setGameMode: (v: GameMode) => void;
  setMinTeamPlayers: (v: string) => void;
  setMaxTeamPlayers: (v: string) => void;
  setEnableTeamChat: (v: boolean) => void;
  setEnableTeamVoice: (v: boolean) => void;
  setEnableTeamLocation: (v: boolean) => void;
  setTeamScoreMode: (v: TeamScoreMode) => void;
  // 章節
  chapter: ChapterState;
  setGameStructure: (v: GameStructure) => void;
  setChapterUnlockMode: (v: ChapterUnlockMode) => void;
  setAllowChapterReplay: (v: boolean) => void;
  // 操作
  handleSave: () => void;
  isSaving: boolean;
}

/**
 * 遊戲設定頁面邏輯 Hook
 * 封裝所有 state 管理、資料載入和儲存邏輯
 */
export function useGameSettings(): GameSettingsReturn {
  const { gameId } = useParams<{ gameId: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // 路徑偵測
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  const apiBasePath = isAdminStaff ? "/api/admin/games" : "/api/games";

  // 地點鎖定 state
  const [locationLockEnabled, setLocationLockEnabled] = useState(false);
  const [lockLatitude, setLockLatitude] = useState("");
  const [lockLongitude, setLockLongitude] = useState("");
  const [lockRadius, setLockRadius] = useState("50");
  const [lockLocationName, setLockLocationName] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // 團隊模式 state
  const [gameMode, setGameMode] = useState<GameMode>("individual");
  const [minTeamPlayers, setMinTeamPlayers] = useState("2");
  const [maxTeamPlayers, setMaxTeamPlayers] = useState("6");
  const [enableTeamChat, setEnableTeamChat] = useState(true);
  const [enableTeamVoice, setEnableTeamVoice] = useState(false);
  const [enableTeamLocation, setEnableTeamLocation] = useState(true);
  const [teamScoreMode, setTeamScoreMode] = useState<TeamScoreMode>("shared");

  // 章節系統 state
  const [gameStructure, setGameStructure] = useState<GameStructure>("linear");
  const [chapterUnlockMode, setChapterUnlockMode] = useState<ChapterUnlockMode>("sequential");
  const [allowChapterReplay, setAllowChapterReplay] = useState(true);

  // 資料查詢
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: game, isLoading } = useQuery<Game>({
    queryKey: [apiBasePath, gameId],
    enabled: !!gameId,
  });

  const canEdit = isAdminStaff || (!!user && !!game && (
    user.role === "admin" ||
    game.creatorId === user.id
  ));

  // 載入遊戲資料到 state
  useEffect(() => {
    if (!game) return;
    setLocationLockEnabled(game.locationLockEnabled || false);
    setLockLatitude(game.lockLatitude || "");
    setLockLongitude(game.lockLongitude || "");
    setLockRadius(String(game.lockRadius || 50));
    setLockLocationName(game.lockLocationName || "");
    setGameMode((game.gameMode as GameMode) || "individual");
    setMinTeamPlayers(String(game.minTeamPlayers || 2));
    setMaxTeamPlayers(String(game.maxTeamPlayers || 6));
    setEnableTeamChat(game.enableTeamChat !== false);
    setEnableTeamVoice(game.enableTeamVoice || false);
    setEnableTeamLocation(game.enableTeamLocation !== false);
    setTeamScoreMode((game.teamScoreMode as TeamScoreMode) || "shared");
    setGameStructure((game.gameStructure as GameStructure) || "linear");
    setChapterUnlockMode((game.chapterUnlockMode as ChapterUnlockMode) || "sequential");
    setAllowChapterReplay(game.allowChapterReplay !== false);
  }, [game]);

  // 儲存 mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("PATCH", `${apiBasePath}/${gameId}`, data);
    },
    onSuccess: () => {
      toast({ title: "設定已儲存" });
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "儲存失敗";
      toast({
        title: "儲存失敗",
        description: message.includes("Unauthorized") ? "您沒有權限修改此遊戲" : message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!canEdit) {
      toast({ title: "您沒有權限修改此遊戲", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      locationLockEnabled,
      lockLatitude: lockLatitude ? parseFloat(lockLatitude) : null,
      lockLongitude: lockLongitude ? parseFloat(lockLongitude) : null,
      lockRadius: parseInt(lockRadius) || 50,
      lockLocationName: lockLocationName || null,
      gameMode,
      minTeamPlayers: parseInt(minTeamPlayers) || 2,
      maxTeamPlayers: parseInt(maxTeamPlayers) || 6,
      enableTeamChat,
      enableTeamVoice,
      enableTeamLocation,
      teamScoreMode,
      gameStructure,
      chapterUnlockMode,
      allowChapterReplay,
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "您的瀏覽器不支援定位功能", variant: "destructive" });
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLockLatitude(position.coords.latitude.toFixed(8));
        setLockLongitude(position.coords.longitude.toFixed(8));
        setIsGettingLocation(false);
        toast({ title: "已取得目前位置" });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({ title: "無法取得位置", description: error.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return {
    game,
    isLoading,
    canEdit,
    basePath,
    locationLock: {
      locationLockEnabled,
      lockLatitude,
      lockLongitude,
      lockRadius,
      lockLocationName,
      isGettingLocation,
    },
    setLocationLockEnabled,
    setLockLatitude,
    setLockLongitude,
    setLockRadius,
    setLockLocationName,
    getCurrentLocation,
    teamMode: {
      gameMode,
      minTeamPlayers,
      maxTeamPlayers,
      enableTeamChat,
      enableTeamVoice,
      enableTeamLocation,
      teamScoreMode,
    },
    setGameMode,
    setMinTeamPlayers,
    setMaxTeamPlayers,
    setEnableTeamChat,
    setEnableTeamVoice,
    setEnableTeamLocation,
    setTeamScoreMode,
    chapter: {
      gameStructure,
      chapterUnlockMode,
      allowChapterReplay,
    },
    setGameStructure,
    setChapterUnlockMode,
    setAllowChapterReplay,
    handleSave,
    isSaving: updateMutation.isPending,
  };
}
