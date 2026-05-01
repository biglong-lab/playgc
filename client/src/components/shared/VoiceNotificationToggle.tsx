// 🔊 VoiceNotificationToggle — 隊友狀態 TTS 語音通知開關
//
// 用途：玩家可在 lobby header 切換是否要朗讀「OOO 暫時離線」等隊友狀態
// 設定 persist 到 localStorage（chito:voice:disabled），重整不會回復
//
// 對應 lib/voice-notification.ts 的 isVoiceEnabled / setVoiceEnabled

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isVoiceEnabled, setVoiceEnabled } from "@/lib/voice-notification";

export interface VoiceNotificationToggleProps {
  /** 樣式：icon-only（預設）or label */
  variant?: "icon" | "label";
}

export default function VoiceNotificationToggle({
  variant = "icon",
}: VoiceNotificationToggleProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return isVoiceEnabled();
    } catch {
      return true;
    }
  });

  // 同步：若其他 tab 改了 localStorage，這個元件也要更新
  useEffect(() => {
    const handler = () => {
      try {
        setEnabled(isVoiceEnabled());
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setVoiceEnabled(next);
    setEnabled(next);
    toast({
      title: next ? "🔊 已開啟語音通知" : "🔇 已關閉語音通知",
      description: next
        ? "隊友離線 / 回來會用中文小聲朗讀"
        : "靜音模式：仍會收到 toast 提示，但不朗讀",
      duration: 2500,
    });
  };

  const Icon = enabled ? Volume2 : VolumeX;
  const labelText = enabled ? "語音通知開" : "語音通知關";

  if (variant === "label") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        data-testid="btn-voice-notification-toggle"
        title={labelText}
      >
        <Icon className="w-4 h-4 mr-2" />
        {labelText}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      data-testid="btn-voice-notification-toggle"
      title={labelText}
      aria-label={labelText}
    >
      <Icon className={`w-4 h-4 ${enabled ? "text-foreground" : "text-muted-foreground"}`} />
    </Button>
  );
}
