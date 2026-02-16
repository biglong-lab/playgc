import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronLeft, Save, MapPin, Crosshair, Navigation, Lock, AlertTriangle, Users, MessageCircle, Mic, Map, Trophy, Settings } from "lucide-react";
import type { Game, User } from "@shared/schema";

export default function GameSettings() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Detect if we're in admin-staff context or admin context
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  // Use different API paths based on authentication context
  const apiBasePath = isAdminStaff ? "/api/admin/games" : "/api/games";

  const [locationLockEnabled, setLocationLockEnabled] = useState(false);
  const [lockLatitude, setLockLatitude] = useState("");
  const [lockLongitude, setLockLongitude] = useState("");
  const [lockRadius, setLockRadius] = useState("50");
  const [lockLocationName, setLockLocationName] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Team mode settings
  const [gameMode, setGameMode] = useState<"individual" | "team">("individual");
  const [minTeamPlayers, setMinTeamPlayers] = useState("2");
  const [maxTeamPlayers, setMaxTeamPlayers] = useState("6");
  const [enableTeamChat, setEnableTeamChat] = useState(true);
  const [enableTeamVoice, setEnableTeamVoice] = useState(false);
  const [enableTeamLocation, setEnableTeamLocation] = useState(true);
  const [teamScoreMode, setTeamScoreMode] = useState<"shared" | "individual" | "hybrid">("shared");

  // 章節系統設定
  const [gameStructure, setGameStructure] = useState<"linear" | "chapters">("linear");
  const [chapterUnlockMode, setChapterUnlockMode] = useState<"sequential" | "manual" | "all_open">("sequential");
  const [allowChapterReplay, setAllowChapterReplay] = useState(true);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: game, isLoading } = useQuery<Game>({
    queryKey: [apiBasePath, gameId],
    enabled: !!gameId,
  });

  // For admin-staff context, always allow edit (permissions checked on backend)
  const canEdit = isAdminStaff || (user && game && (
    user.role === "admin" || 
    game.creatorId === user.id
  ));

  useEffect(() => {
    if (game) {
      setLocationLockEnabled(game.locationLockEnabled || false);
      setLockLatitude(game.lockLatitude || "");
      setLockLongitude(game.lockLongitude || "");
      setLockRadius(String(game.lockRadius || 50));
      setLockLocationName(game.lockLocationName || "");
      // Team mode settings
      setGameMode((game.gameMode as "individual" | "team") || "individual");
      setMinTeamPlayers(String(game.minTeamPlayers || 2));
      setMaxTeamPlayers(String(game.maxTeamPlayers || 6));
      setEnableTeamChat(game.enableTeamChat !== false);
      setEnableTeamVoice(game.enableTeamVoice || false);
      setEnableTeamLocation(game.enableTeamLocation !== false);
      setTeamScoreMode((game.teamScoreMode as "shared" | "individual" | "hybrid") || "shared");
      // 章節系統設定
      setGameStructure((game.gameStructure as "linear" | "chapters") || "linear");
      setChapterUnlockMode((game.chapterUnlockMode as "sequential" | "manual" | "all_open") || "sequential");
      setAllowChapterReplay(game.allowChapterReplay !== false);
    }
  }, [game]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `${apiBasePath}/${gameId}`, data);
    },
    onSuccess: () => {
      toast({ title: "設定已儲存" });
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId] });
    },
    onError: (error: any) => {
      const message = error?.message || "儲存失敗";
      toast({ 
        title: "儲存失敗", 
        description: message.includes("Unauthorized") ? "您沒有權限修改此遊戲" : message,
        variant: "destructive" 
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
      // Team mode settings
      gameMode,
      minTeamPlayers: parseInt(minTeamPlayers) || 2,
      maxTeamPlayers: parseInt(maxTeamPlayers) || 6,
      enableTeamChat,
      enableTeamVoice,
      enableTeamLocation,
      teamScoreMode,
      // 章節系統
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
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation(`${basePath}/${gameId}`)}
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">遊戲設定</h1>
              <p className="text-sm text-muted-foreground">{game?.title}</p>
            </div>
          </div>
          {canEdit && (
            <Button 
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4" />
              儲存設定
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        {!canEdit && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              您沒有權限修改此遊戲設定。只有遊戲創建者或管理員可以修改設定。
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              地點鎖定
            </CardTitle>
            <CardDescription>
              設定玩家必須在特定地點才能開始遊戲
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="location-lock">啟用地點鎖定</Label>
                <p className="text-sm text-muted-foreground">
                  玩家必須到達指定位置才能開始遊戲
                </p>
              </div>
              <Switch
                id="location-lock"
                checked={locationLockEnabled}
                onCheckedChange={setLocationLockEnabled}
                disabled={!canEdit}
                data-testid="switch-location-lock"
              />
            </div>

            {locationLockEnabled && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="location-name">地點名稱</Label>
                  <Input
                    id="location-name"
                    value={lockLocationName}
                    onChange={(e) => setLockLocationName(e.target.value)}
                    placeholder="例如：賈村大門、遊客中心"
                    disabled={!canEdit}
                    data-testid="input-location-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">緯度 (Latitude)</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.00000001"
                      value={lockLatitude}
                      onChange={(e) => setLockLatitude(e.target.value)}
                      placeholder="25.033"
                      disabled={!canEdit}
                      data-testid="input-latitude"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">經度 (Longitude)</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.00000001"
                      value={lockLongitude}
                      onChange={(e) => setLockLongitude(e.target.value)}
                      placeholder="121.565"
                      disabled={!canEdit}
                      data-testid="input-longitude"
                    />
                  </div>
                </div>

                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full gap-2"
                    data-testid="button-get-location"
                  >
                    {isGettingLocation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        正在取得位置...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        使用目前位置
                      </>
                    )}
                  </Button>
                )}

                <div className="space-y-2">
                  <Label htmlFor="radius">有效範圍 (公尺)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="radius"
                      type="number"
                      min="10"
                      max="1000"
                      value={lockRadius}
                      onChange={(e) => setLockRadius(e.target.value)}
                      className="flex-1"
                      disabled={!canEdit}
                      data-testid="input-radius"
                    />
                    <span className="text-sm text-muted-foreground w-24">
                      {lockRadius} 公尺
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    建議設定 30-100 公尺的範圍，考慮 GPS 精確度
                  </p>
                </div>

                {lockLatitude && lockLongitude && (
                  <div className="p-4 bg-muted/50 rounded-lg flex items-center gap-3">
                    <Crosshair className="w-5 h-5 text-primary" />
                    <div className="text-sm">
                      <p className="font-medium">鎖定位置預覽</p>
                      <p className="text-muted-foreground">
                        {lockLocationName || "未命名地點"} ({parseFloat(lockLatitude).toFixed(6)}, {parseFloat(lockLongitude).toFixed(6)})
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 遊戲結構設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              遊戲結構
            </CardTitle>
            <CardDescription>
              設定遊戲為線性或章節制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>遊戲結構</Label>
              <Select
                value={gameStructure}
                onValueChange={(v: "linear" | "chapters") => setGameStructure(v)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">線性（頁面依序進行）</SelectItem>
                  <SelectItem value="chapters">章節制（分章進行）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {gameStructure === "linear"
                  ? "頁面從頭到尾依序進行，適合單次遊戲"
                  : "遊戲分為多個章節，支援進度保存和跨場次遊玩"}
              </p>
            </div>

            {gameStructure === "chapters" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>章節解鎖模式</Label>
                  <Select
                    value={chapterUnlockMode}
                    onValueChange={(v: "sequential" | "manual" | "all_open") => setChapterUnlockMode(v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">依序解鎖（完成前一章才能開始下一章）</SelectItem>
                      <SelectItem value="manual">手動設定（各章節獨立設定解鎖條件）</SelectItem>
                      <SelectItem value="all_open">全部開放（所有章節一開始就可遊玩）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>允許章節重玩</Label>
                    <p className="text-xs text-muted-foreground">玩家完成章節後可以再次遊玩</p>
                  </div>
                  <Switch
                    checked={allowChapterReplay}
                    onCheckedChange={setAllowChapterReplay}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              遊戲模式
            </CardTitle>
            <CardDescription>
              設定單人或團體遊戲模式
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="game-mode">遊戲模式</Label>
              <Select 
                value={gameMode} 
                onValueChange={(value: "individual" | "team") => setGameMode(value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="game-mode" data-testid="select-game-mode">
                  <SelectValue placeholder="選擇遊戲模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">單人模式</SelectItem>
                  <SelectItem value="team">團隊模式</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {gameMode === "individual" 
                  ? "玩家獨立進行遊戲，各自計分" 
                  : "玩家組隊進行遊戲，共享進度與分數"}
              </p>
            </div>

            {gameMode === "team" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-players">最少玩家人數</Label>
                    <Input
                      id="min-players"
                      type="number"
                      min="2"
                      max="10"
                      value={minTeamPlayers}
                      onChange={(e) => setMinTeamPlayers(e.target.value)}
                      disabled={!canEdit}
                      data-testid="input-min-players"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-players">最多玩家人數</Label>
                    <Input
                      id="max-players"
                      type="number"
                      min="2"
                      max="20"
                      value={maxTeamPlayers}
                      onChange={(e) => setMaxTeamPlayers(e.target.value)}
                      disabled={!canEdit}
                      data-testid="input-max-players"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="team-chat">隊伍文字聊天</Label>
                        <p className="text-xs text-muted-foreground">允許隊友發送訊息</p>
                      </div>
                    </div>
                    <Switch
                      id="team-chat"
                      checked={enableTeamChat}
                      onCheckedChange={setEnableTeamChat}
                      disabled={!canEdit}
                      data-testid="switch-team-chat"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="team-voice">隊伍語音通話</Label>
                        <p className="text-xs text-muted-foreground">允許隊友語音溝通（需整合第三方服務）</p>
                      </div>
                    </div>
                    <Switch
                      id="team-voice"
                      checked={enableTeamVoice}
                      onCheckedChange={setEnableTeamVoice}
                      disabled={!canEdit}
                      data-testid="switch-team-voice"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Map className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="team-location">隊友位置顯示</Label>
                        <p className="text-xs text-muted-foreground">在地圖上顯示所有隊友位置</p>
                      </div>
                    </div>
                    <Switch
                      id="team-location"
                      checked={enableTeamLocation}
                      onCheckedChange={setEnableTeamLocation}
                      disabled={!canEdit}
                      data-testid="switch-team-location"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score-mode" className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-muted-foreground" />
                    計分模式
                  </Label>
                  <Select 
                    value={teamScoreMode} 
                    onValueChange={(value: "shared" | "individual" | "hybrid") => setTeamScoreMode(value)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="score-mode" data-testid="select-score-mode">
                      <SelectValue placeholder="選擇計分模式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">共享分數 - 全隊統一分數</SelectItem>
                      <SelectItem value="individual">個人分數 - 各自記錄</SelectItem>
                      <SelectItem value="hybrid">混合計分 - 個人與隊伍分數並行</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    團隊模式需要玩家透過 6 位數組隊碼加入隊伍。隊長創建隊伍後，其他玩家輸入組隊碼即可加入。
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>其他設定</CardTitle>
            <CardDescription>
              更多遊戲設定選項（即將推出）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              未來將支援更多進階設定，如時間限制、重複遊玩限制、道具限制等。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
