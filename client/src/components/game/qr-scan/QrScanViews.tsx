import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  QrCode, Camera, CheckCircle, XCircle, Keyboard,
  Loader2, MapPin, AlertTriangle, RefreshCw,
} from "lucide-react";
import type { QrScanConfig } from "@shared/schema";
import type { QrScannerState, QrScannerActions } from "./useQrScanner";

interface ViewProps {
  config: QrScanConfig;
  state: QrScannerState;
  actions: QrScannerActions;
  scannerContainerRef: React.RefObject<HTMLDivElement>;
}

// ==================== 指示畫面 ====================

export function InstructionView({ config, state, actions }: Omit<ViewProps, "scannerContainerRef">) {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <QrCode className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">
          {config.title || "掃描 QR Code"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {config.instruction || config.prompt || config.description || "找到並掃描指定的 QR Code 來完成任務"}
        </p>

        {config.locationHint && (
          <div className="bg-accent/50 rounded-lg p-3 mb-6 flex items-start gap-2">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-left">{config.locationHint}</p>
          </div>
        )}

        {state.cameraError && <CameraErrorBanner error={state.cameraError} onRetry={actions.handleRetry} />}

        <div className="space-y-3">
          <Button onClick={actions.startScanning} className="w-full gap-2" data-testid="button-start-scan">
            <Camera className="w-4 h-4" />
            開啟掃描器
          </Button>
          <Button variant="outline" onClick={() => actions.setMode("manual")} className="w-full gap-2" data-testid="button-manual-input">
            <Keyboard className="w-4 h-4" />
            手動輸入代碼
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">提示: 請確保允許瀏覽器使用相機權限</p>
      </CardContent>
    </Card>
  );
}

// ==================== 相機畫面（初始化 + 掃描中共用）====================
// 重要約束：
// 1. initializing 和 scanning 必須共用同一個 #qr-reader DOM，否則
//    html5-qrcode 插入的 <video> 會在 mode 切換時被 React 卸載，導致黑屏
// 2. #qr-reader 內部不能有任何 React 管理的 children（html5-qrcode 會清空並
//    插入自己的 DOM，React 若嘗試移除原本的 children 會拋 NotFoundError）
// 3. 所有 loading overlay 必須放在 #qr-reader 的外層兄弟位置（absolute 疊加）

export function CameraView({
  state,
  actions,
  scannerContainerRef,
  isInitializing,
}: Pick<ViewProps, "actions" | "state" | "scannerContainerRef"> & { isInitializing: boolean }) {
  return (
    <div className="w-full max-w-md">
      {/* 相機容器 + 疊加層（用 wrapper 把 overlay 放在 #qr-reader 外）*/}
      <div className="relative aspect-square mb-4">
        <div
          id="qr-reader"
          ref={scannerContainerRef}
          className="absolute inset-0 bg-black rounded-lg overflow-hidden"
        />
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none rounded-lg overflow-hidden">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg">正在啟動相機...</p>
              <p className="text-sm text-white/60 mt-2">請允許相機權限</p>
            </div>
          </div>
        )}
        {/* 🆕 切換鏡頭按鈕（右上角，z-[60] 不被擋）*/}
        {!isInitializing && (
          <Button
            onClick={() => actions.switchCamera?.()}
            className="absolute top-2 right-2 z-[60] bg-emerald-600/90 backdrop-blur hover:bg-emerald-700 text-white gap-1.5 px-3 h-10 rounded-full border-2 border-white/40 shadow-2xl"
            data-testid="btn-qr-switch-camera"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">
              {state.facingMode === "user" ? "切後鏡頭" : "切前鏡頭"}
            </span>
          </Button>
        )}
      </div>
      {isInitializing ? (
        <Button variant="outline" onClick={actions.handleCancelScan} className="w-full" data-testid="button-cancel-init">
          取消
        </Button>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground mb-4">將 QR Code 對準掃描框內</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={actions.handleCancelScan} className="flex-1" data-testid="button-cancel-scan">
              取消
            </Button>
            <Button
              variant="outline"
              onClick={async () => { await actions.stopScanning(); actions.setMode("manual"); }}
              className="flex-1 gap-2"
              data-testid="button-switch-manual"
            >
              <Keyboard className="w-4 h-4" />
              手動輸入
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== 手動輸入 ====================

export function ManualInputView({ config, state, actions }: Omit<ViewProps, "scannerContainerRef">) {
  const primaryCode = config.primaryCode || config.expectedCode || config.qrCodeId || "";
  const placeholder = getCodePlaceholder(primaryCode);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
          <Keyboard className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-display font-bold text-center mb-4">手動輸入代碼</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">輸入 QR Code 上顯示的代碼</p>

        <Input
          value={state.manualCode}
          onChange={(e) => actions.setManualCode(e.target.value.toUpperCase())}
          placeholder={placeholder}
          className="text-center font-mono mb-4"
          onKeyDown={(e) => e.key === "Enter" && actions.handleManualSubmit()}
          data-testid="input-manual-code"
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { actions.setMode("instruction"); actions.setManualCode(""); }} className="flex-1">
            取消
          </Button>
          <Button
            onClick={actions.handleManualSubmit}
            disabled={!state.manualCode.trim() || state.isProcessing}
            className="flex-1"
            data-testid="button-submit-code"
          >
            {state.isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== 成功/失敗 ====================

export function SuccessView({ config }: { config: QrScanConfig }) {
  return (
    <div className="text-center">
      <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6 animate-scaleIn">
        <CheckCircle className="w-12 h-12 text-success" />
      </div>
      <h2 className="text-2xl font-display font-bold mb-2 text-success">驗證成功!</h2>
      <p className="text-muted-foreground">{config.onSuccess?.message || config.successMessage || "QR Code 已確認"}</p>
    </div>
  );
}

export function ErrorView() {
  return (
    <div className="text-center">
      <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6 animate-scaleIn">
        <XCircle className="w-12 h-12 text-destructive" />
      </div>
      <h2 className="text-2xl font-display font-bold mb-2 text-destructive">驗證失敗</h2>
      <p className="text-muted-foreground">這不是正確的 QR Code</p>
    </div>
  );
}

// ==================== 私有子元件 ====================

function CameraErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-left">
          <p className="text-sm text-destructive font-medium mb-1">相機問題</p>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 w-full gap-2">
        <RefreshCw className="w-4 h-4" />
        重試
      </Button>
    </div>
  );
}

function getCodePlaceholder(code: string): string {
  if (!code) return "輸入代碼";
  if (code.length <= 4) return "輸入代碼";
  return `格式類似: ${code.substring(0, Math.min(4, code.length))}...`;
}
