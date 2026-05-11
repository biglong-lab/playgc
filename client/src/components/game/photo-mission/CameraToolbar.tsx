// 📷 CameraToolbar — 拍照工具列共用元件
// 2026-05-07：相機統一改造的核心 UI
//
// 用途：所有 8 個拍照元件 + QR scan 共用一組工具列、提供：
//   - 拍照（既有功能、改用此 toolbar 統一外觀）
//   - 閃光燈 toggle（只 Android 部分機型支援）
//   - 前後鏡頭切換
//   - 從相簿選圖
//
// 設計原則：
//   1. 不支援的功能 → 灰色 disabled、不隱藏（admin 知道為何沒按鈕）
//   2. 拍照按鈕最大、置中（最常用）
//   3. 其他功能放兩側、icon button
//   4. 觸控目標 ≥ 44px（iOS HIG）
//
// 用法：
//   <CameraToolbar
//     stream={stream}
//     facingMode={facingMode}
//     onCapture={handleCapture}
//     onSwitchCamera={switchCamera}
//     onPickFromGallery={openGallery}
//   />

import { Button } from "@/components/ui/button";
import { Camera, Zap, ZapOff, RefreshCcw, ImagePlus } from "lucide-react";
import { useTorch } from "@/hooks/useTorch";
import { useHaptic } from "@/hooks/useHaptic";
import { useShutterSound } from "@/hooks/useShutterSound";
import { cn } from "@/lib/utils";

export interface CameraToolbarProps {
  /** 當前 camera stream（給 useTorch 用、判斷 capability）*/
  stream: MediaStream | null;
  /** 當前鏡頭方向 */
  facingMode: "user" | "environment";
  /** 拍照按鈕觸發 */
  onCapture: () => void;
  /** 切換前後鏡頭、null 表示不支援切換 */
  onSwitchCamera?: () => void;
  /** 從相簿選圖、null 表示不支援 */
  onPickFromGallery?: () => void;
  /** 是否 disable 所有互動（如 uploading 中）*/
  disabled?: boolean;
  /**
   * 🆕 2026-05-12 (#3 業主回報): 只 disable 拍照按鈕（保留閃光燈 / 翻鏡頭 / 相簿能用）
   * 例：AR 元件「等找到臉才能拍」場景、玩家仍需切後鏡頭 / 開閃光燈
   */
  captureDisabled?: boolean;
  /** 自訂額外 class */
  className?: string;
}

export default function CameraToolbar({
  stream,
  facingMode,
  onCapture,
  onSwitchCamera,
  onPickFromGallery,
  disabled = false,
  captureDisabled = false,
  className,
}: CameraToolbarProps) {
  const torch = useTorch(stream);
  const haptic = useHaptic();
  const playShutter = useShutterSound();

  const handleCapture = () => {
    if (disabled || captureDisabled) return;
    haptic.success();
    playShutter();
    onCapture();
  };

  const handleSwitchCamera = () => {
    if (disabled || !onSwitchCamera) return;
    haptic.tap();
    onSwitchCamera();
  };

  const handleToggleTorch = () => {
    if (disabled || !torch.supported) return;
    haptic.tap();
    void torch.toggle();
  };

  const handlePickGallery = () => {
    if (disabled || !onPickFromGallery) return;
    haptic.tap();
    onPickFromGallery();
  };

  return (
    <div
      className={cn(
        "flex items-center justify-around gap-2 px-4 py-3 bg-background/90 backdrop-blur rounded-full border shadow-lg",
        className,
      )}
      data-testid="camera-toolbar"
    >
      {/* 🔦 閃光燈（Android 支援、iOS 灰）*/}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full h-12 w-12"
        disabled={disabled || !torch.supported}
        onClick={handleToggleTorch}
        title={
          !torch.supported
            ? "此裝置不支援閃光燈"
            : torch.on
              ? "關閉閃光燈"
              : "開啟閃光燈"
        }
        data-testid="btn-camera-torch"
        data-torch-on={torch.on}
      >
        {torch.on ? (
          <Zap className="w-6 h-6 text-yellow-400" />
        ) : (
          <ZapOff
            className={cn(
              "w-6 h-6",
              torch.supported ? "text-foreground" : "text-muted-foreground/40",
            )}
          />
        )}
      </Button>

      {/* 📷 拍照（最大、置中、最常用）*/}
      <Button
        type="button"
        variant="default"
        size="icon"
        className="rounded-full h-16 w-16 bg-white hover:bg-white/90 text-black border-4 border-primary/40 shadow-xl"
        disabled={disabled || captureDisabled}
        onClick={handleCapture}
        title={captureDisabled ? "等找到臉再拍" : "拍照"}
        data-testid="btn-camera-capture"
      >
        <Camera className="w-8 h-8" />
      </Button>

      {/* 🔄 前後鏡頭切換 */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full h-12 w-12"
        disabled={disabled || !onSwitchCamera}
        onClick={handleSwitchCamera}
        title={facingMode === "user" ? "切到後鏡頭" : "切到前鏡頭"}
        data-testid="btn-camera-switch"
        data-facing={facingMode}
      >
        <RefreshCcw className="w-6 h-6" />
      </Button>

      {/* 🖼️ 從相簿（若有提供 onPickFromGallery）*/}
      {onPickFromGallery && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full h-12 w-12"
          disabled={disabled}
          onClick={handlePickGallery}
          title="從相簿選圖"
          data-testid="btn-camera-gallery"
        >
          <ImagePlus className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
