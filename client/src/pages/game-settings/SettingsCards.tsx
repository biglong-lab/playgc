import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Crosshair, Navigation, Users, MessageCircle,
  Mic, Map, Trophy, Settings,
} from "lucide-react";
import type {
  LocationLockState, TeamModeState, ChapterState,
  GameMode, TeamScoreMode, GameStructure, ChapterUnlockMode,
} from "./useGameSettings";

// ==================== 地點鎖定卡片 ====================

interface LocationLockCardProps {
  state: LocationLockState;
  canEdit: boolean;
  onEnabledChange: (v: boolean) => void;
  onLatitudeChange: (v: string) => void;
  onLongitudeChange: (v: string) => void;
  onRadiusChange: (v: string) => void;
  onLocationNameChange: (v: string) => void;
  onGetCurrentLocation: () => void;
}

export function LocationLockCard({
  state, canEdit,
  onEnabledChange, onLatitudeChange, onLongitudeChange,
  onRadiusChange, onLocationNameChange, onGetCurrentLocation,
}: LocationLockCardProps) {
  const { locationLockEnabled, lockLatitude, lockLongitude, lockRadius, lockLocationName, isGettingLocation } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          地點鎖定
        </CardTitle>
        <CardDescription>設定玩家必須在特定地點才能開始遊戲</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="location-lock">啟用地點鎖定</Label>
            <p className="text-sm text-muted-foreground">玩家必須到達指定位置才能開始遊戲</p>
          </div>
          <Switch
            id="location-lock"
            checked={locationLockEnabled}
            onCheckedChange={onEnabledChange}
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
                onChange={(e) => onLocationNameChange(e.target.value)}
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
                  onChange={(e) => onLatitudeChange(e.target.value)}
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
                  onChange={(e) => onLongitudeChange(e.target.value)}
                  placeholder="121.565"
                  disabled={!canEdit}
                  data-testid="input-longitude"
                />
              </div>
            </div>

            {canEdit && (
              <Button
                variant="outline"
                onClick={onGetCurrentLocation}
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
                  onChange={(e) => onRadiusChange(e.target.value)}
                  className="flex-1"
                  disabled={!canEdit}
                  data-testid="input-radius"
                />
                <span className="text-sm text-muted-foreground w-24">{lockRadius} 公尺</span>
              </div>
              <p className="text-xs text-muted-foreground">建議設定 30-100 公尺的範圍，考慮 GPS 精確度</p>
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
  );
}

// ==================== 遊戲結構卡片 ====================

interface ChapterCardProps {
  state: ChapterState;
  canEdit: boolean;
  onStructureChange: (v: GameStructure) => void;
  onUnlockModeChange: (v: ChapterUnlockMode) => void;
  onReplayChange: (v: boolean) => void;
}

export function ChapterCard({ state, canEdit, onStructureChange, onUnlockModeChange, onReplayChange }: ChapterCardProps) {
  const { gameStructure, chapterUnlockMode, allowChapterReplay } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          遊戲結構
        </CardTitle>
        <CardDescription>設定遊戲為線性或章節制</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>遊戲結構</Label>
          <Select value={gameStructure} onValueChange={onStructureChange} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={chapterUnlockMode} onValueChange={onUnlockModeChange} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Switch checked={allowChapterReplay} onCheckedChange={onReplayChange} disabled={!canEdit} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== 遊戲模式（團隊）卡片 ====================

interface TeamModeCardProps {
  state: TeamModeState;
  canEdit: boolean;
  onModeChange: (v: GameMode) => void;
  onMinPlayersChange: (v: string) => void;
  onMaxPlayersChange: (v: string) => void;
  onChatChange: (v: boolean) => void;
  onVoiceChange: (v: boolean) => void;
  onLocationChange: (v: boolean) => void;
  onScoreModeChange: (v: TeamScoreMode) => void;
}

export function TeamModeCard({
  state, canEdit,
  onModeChange, onMinPlayersChange, onMaxPlayersChange,
  onChatChange, onVoiceChange, onLocationChange, onScoreModeChange,
}: TeamModeCardProps) {
  const { gameMode, minTeamPlayers, maxTeamPlayers, enableTeamChat, enableTeamVoice, enableTeamLocation, teamScoreMode } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          遊戲模式
        </CardTitle>
        <CardDescription>設定單人或團體遊戲模式</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="game-mode">遊戲模式</Label>
          <Select value={gameMode} onValueChange={onModeChange} disabled={!canEdit}>
            <SelectTrigger id="game-mode" data-testid="select-game-mode"><SelectValue placeholder="選擇遊戲模式" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">單人模式</SelectItem>
              <SelectItem value="team">團隊模式</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {gameMode === "individual" ? "玩家獨立進行遊戲，各自計分" : "玩家組隊進行遊戲，共享進度與分數"}
          </p>
        </div>

        {gameMode === "team" && (
          <TeamModeDetails
            state={state}
            canEdit={canEdit}
            onMinPlayersChange={onMinPlayersChange}
            onMaxPlayersChange={onMaxPlayersChange}
            onChatChange={onChatChange}
            onVoiceChange={onVoiceChange}
            onLocationChange={onLocationChange}
            onScoreModeChange={onScoreModeChange}
          />
        )}
      </CardContent>
    </Card>
  );
}

// 團隊模式詳細設定（私有子元件）
function TeamModeDetails({
  state, canEdit,
  onMinPlayersChange, onMaxPlayersChange,
  onChatChange, onVoiceChange, onLocationChange, onScoreModeChange,
}: Omit<TeamModeCardProps, "onModeChange">) {
  const { minTeamPlayers, maxTeamPlayers, enableTeamChat, enableTeamVoice, enableTeamLocation, teamScoreMode } = state;

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min-players">最少玩家人數</Label>
          <Input id="min-players" type="number" min="2" max="10" value={minTeamPlayers}
            onChange={(e) => onMinPlayersChange(e.target.value)} disabled={!canEdit} data-testid="input-min-players" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-players">最多玩家人數</Label>
          <Input id="max-players" type="number" min="2" max="20" value={maxTeamPlayers}
            onChange={(e) => onMaxPlayersChange(e.target.value)} disabled={!canEdit} data-testid="input-max-players" />
        </div>
      </div>

      <div className="space-y-4">
        <TeamToggle
          icon={<MessageCircle className="w-4 h-4 text-muted-foreground" />}
          id="team-chat" label="隊伍文字聊天" desc="允許隊友發送訊息"
          checked={enableTeamChat} onCheckedChange={onChatChange} disabled={!canEdit} testId="switch-team-chat"
        />
        <TeamToggle
          icon={<Mic className="w-4 h-4 text-muted-foreground" />}
          id="team-voice" label="隊伍語音通話" desc="允許隊友語音溝通（需整合第三方服務）"
          checked={enableTeamVoice} onCheckedChange={onVoiceChange} disabled={!canEdit} testId="switch-team-voice"
        />
        <TeamToggle
          icon={<Map className="w-4 h-4 text-muted-foreground" />}
          id="team-location" label="隊友位置顯示" desc="在地圖上顯示所有隊友位置"
          checked={enableTeamLocation} onCheckedChange={onLocationChange} disabled={!canEdit} testId="switch-team-location"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="score-mode" className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-muted-foreground" />
          計分模式
        </Label>
        <Select value={teamScoreMode} onValueChange={onScoreModeChange} disabled={!canEdit}>
          <SelectTrigger id="score-mode" data-testid="select-score-mode"><SelectValue placeholder="選擇計分模式" /></SelectTrigger>
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
  );
}

// 團隊功能開關（DRY 工具元件）
function TeamToggle({
  icon, id, label, desc, checked, onCheckedChange, disabled, testId,
}: {
  icon: React.ReactNode;
  id: string;
  label: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <Label htmlFor={id}>{label}</Label>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} data-testid={testId} />
    </div>
  );
}
