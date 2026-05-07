// 🔊 FloatingBgmMute — BGM 靜音切換浮動按鈕
// 2026-05-07：玩家可隨時關掉 BGM
//
// 顯示條件：
//   - currentUrl 有值（game / page 設了 BGM）
//   - 不在 admin / platform 後台
//
// 位置：右下角（避開 FloatingHomeButton 在左下、FloatingFontScale 在右上）

import { useLocation } from "wouter";
import { Volume2, VolumeX } from "lucide-react";
import { useBgmPlayer } from "@/hooks/useBgmPlayer";

function shouldHide(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/platform");
}

export default function FloatingBgmMute() {
  const [location] = useLocation();
  const bgm = useBgmPlayer();

  if (shouldHide(location)) return null;
  if (!bgm.currentUrl) return null;

  return (
    <button
      type="button"
      onClick={bgm.toggleMute}
      className="fixed right-3 z-30 pointer-events-auto print:hidden bg-background/90 backdrop-blur border rounded-full p-2.5 shadow-lg hover:bg-background transition-colors"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      title={bgm.muted ? "開啟背景音樂" : "靜音背景音樂"}
      data-testid="floating-bgm-mute"
      aria-label={bgm.muted ? "開啟 BGM" : "靜音 BGM"}
    >
      {bgm.muted ? (
        <VolumeX className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Volume2 className="w-5 h-5 text-foreground" />
      )}
    </button>
  );
}
