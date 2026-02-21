import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, Save, Lock } from "lucide-react";
import { useGameSettings } from "./game-settings/useGameSettings";
import { LocationLockCard, ChapterCard, TeamModeCard, PricingCard } from "./game-settings/SettingsCards";

export default function GameSettings() {
  const [, setLocation] = useLocation();
  const settings = useGameSettings();
  const { game, isLoading, canEdit, basePath, isSaving } = settings;

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
              onClick={() => setLocation(`${basePath}/${game?.id}`)}
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
              onClick={settings.handleSave}
              disabled={isSaving}
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

        <LocationLockCard
          state={settings.locationLock}
          canEdit={canEdit}
          onEnabledChange={settings.setLocationLockEnabled}
          onLatitudeChange={settings.setLockLatitude}
          onLongitudeChange={settings.setLockLongitude}
          onRadiusChange={settings.setLockRadius}
          onLocationNameChange={settings.setLockLocationName}
          onGetCurrentLocation={settings.getCurrentLocation}
        />

        <ChapterCard
          state={settings.chapter}
          canEdit={canEdit}
          onStructureChange={settings.setGameStructure}
          onUnlockModeChange={settings.setChapterUnlockMode}
          onReplayChange={settings.setAllowChapterReplay}
        />

        <PricingCard
          state={settings.pricing}
          canEdit={canEdit}
          onPricingTypeChange={settings.setPricingType}
          onPriceChange={settings.setPrice}
        />

        <TeamModeCard
          state={settings.teamMode}
          canEdit={canEdit}
          onModeChange={settings.setGameMode}
          onMinPlayersChange={settings.setMinTeamPlayers}
          onMaxPlayersChange={settings.setMaxTeamPlayers}
          onChatChange={settings.setEnableTeamChat}
          onVoiceChange={settings.setEnableTeamVoice}
          onLocationChange={settings.setEnableTeamLocation}
          onScoreModeChange={settings.setTeamScoreMode}
        />

        <Card>
          <CardHeader>
            <CardTitle>其他設定</CardTitle>
            <CardDescription>更多遊戲設定選項（即將推出）</CardDescription>
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
