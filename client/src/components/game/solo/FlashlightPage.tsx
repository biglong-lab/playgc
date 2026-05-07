// 🔦 FlashlightPage — 手電筒獨立元件
// 2026-05-07：場域故事 / 解謎類用「玩家開手電筒看暗門」的互動
//
// pageType: "flashlight"
//
// 玩法：
//   - 啟動鏡頭（後鏡頭、不顯示 video）只為了打開 torch
//   - 玩家按「點亮手電筒」→ torch 開
//   - 完成 → onComplete 跳下一頁
//   - 自動關 torch + 關鏡頭（節電）
//
// iOS Safari 不支援 torch → 顯示「此裝置不支援、請手動打開手電筒」
// 配 useTorch hook 偵測 capability

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flashlight, FlashlightOff, AlertCircle, Check } from "lucide-react";
import { useTorch } from "@/hooks/useTorch";
import { useHaptic } from "@/hooks/useHaptic";

export interface FlashlightConfig {
  title?: string;
  description?: string;
  /** 完成所需的「點亮秒數」（預設 0、按一下就完成）*/
  requiredOnSeconds?: number;
  rewardPoints?: number;
}

interface FlashlightPageProps {
  config: FlashlightConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
}

export default function FlashlightPage({ config, onComplete }: FlashlightPageProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsOn, setSecondsOn] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const torch = useTorch(stream);
  const haptic = useHaptic();
  const required = config.requiredOnSeconds ?? 0;

  // 啟動 camera stream（背景啟動 + 不顯示 video、只為了拿 torch capability）
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("此裝置不支援鏡頭、無法使用手電筒");
          return;
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = s;
        setStream(s);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "鏡頭啟動失敗";
        setError(msg);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 計時：torch on 時累加秒數
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (torch.on && !completed) {
      intervalRef.current = setInterval(() => {
        setSecondsOn((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [torch.on, completed]);

  // 達標自動完成
  useEffect(() => {
    if (completed) return;
    if (required > 0 && secondsOn >= required) {
      setCompleted(true);
      haptic.success();
      void torch.turnOff();
      setTimeout(() => {
        onComplete({ points: config.rewardPoints }, undefined);
      }, 800);
    }
  }, [secondsOn, required, completed, haptic, torch, onComplete, config.rewardPoints]);

  const handleManualComplete = () => {
    if (completed) return;
    setCompleted(true);
    haptic.success();
    void torch.turnOff();
    setTimeout(() => {
      onComplete({ points: config.rewardPoints }, undefined);
    }, 600);
  };

  return (
    <Card data-testid="flashlight-page" className="max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
            <Flashlight className={`w-6 h-6 ${torch.on ? "text-yellow-400" : ""}`} />
            {config.title || "手電筒"}
          </h2>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">無法啟動鏡頭</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        )}

        {!error && !torch.supported && stream && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
            <p className="font-medium mb-1">此裝置不支援程式控制手電筒</p>
            <p className="text-xs text-muted-foreground">
              （iOS Safari / 部分 Android）請手動打開手機手電筒、然後點下方按鈕完成。
            </p>
          </div>
        )}

        {/* 主按鈕：開/關手電筒 */}
        {!error && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Button
              size="lg"
              onClick={() => {
                haptic.tap();
                if (torch.supported) {
                  void torch.toggle();
                } else {
                  // 不支援 → 直接讓玩家手動完成
                  handleManualComplete();
                }
              }}
              disabled={completed}
              className={`w-32 h-32 rounded-full ${
                torch.on
                  ? "bg-yellow-400 hover:bg-yellow-500 text-black"
                  : "bg-slate-800 hover:bg-slate-700 text-white"
              }`}
              data-testid="btn-flashlight-toggle"
            >
              {torch.on ? (
                <Flashlight className="w-12 h-12" />
              ) : (
                <FlashlightOff className="w-12 h-12" />
              )}
            </Button>
            <p className="text-sm font-medium">
              {torch.on ? "✨ 已點亮" : "點擊點亮手電筒"}
            </p>
          </div>
        )}

        {/* 倒數進度（required > 0）*/}
        {required > 0 && torch.on && !completed && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">
              點亮 {secondsOn} / {required} 秒
            </p>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all"
                style={{ width: `${Math.min(100, (secondsOn / required) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 完成提示 */}
        {completed && (
          <div className="flex items-center gap-2 justify-center text-emerald-500">
            <Check className="w-5 h-5" />
            <span className="font-medium">完成！</span>
          </div>
        )}

        {/* 手動完成（required=0 或玩家想跳過時）*/}
        {!completed && torch.on && required === 0 && (
          <Button
            variant="outline"
            onClick={handleManualComplete}
            className="w-full"
            data-testid="btn-flashlight-done"
          >
            完成 →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
