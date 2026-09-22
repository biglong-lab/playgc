// ⚠️ 開局失敗畫面（2026-09-22）
// 原本建立場次失敗後會無限自動重試（每 8 秒重抓 GPS + 跳紅色 toast），
// 畫面停在「準備連線中」— 玩家不知道發生什麼事。改為顯示原因 + 手動重試。
import { MapPin, AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionErrorScreenProps {
  message: string;
  /** 地點鎖錯誤（不在範圍 / 沒有定位） */
  isLocation: boolean;
  /** 地點鎖遊戲的指定地點名稱（有值時顯示地點提示） */
  lockLocationName?: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export default function SessionErrorScreen({ message, isLocation, lockLocationName, onRetry, onBack }: SessionErrorScreenProps) {
  const Icon = isLocation ? MapPin : AlertTriangle;
  return (
    <div className="min-h-screen-dynamic bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4" data-testid="session-error-screen">
        <Icon className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">{isLocation ? "需在指定地點才能開始" : "無法開始遊戲"}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        {isLocation && lockLocationName && (
          <p className="text-sm font-medium">📍 {lockLocationName}</p>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={onRetry} className="gap-2" data-testid="button-session-retry">
            <RotateCcw className="w-4 h-4" />
            重試
          </Button>
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <Home className="w-4 h-4" />
            返回大廳
          </Button>
        </div>
      </div>
    </div>
  );
}
