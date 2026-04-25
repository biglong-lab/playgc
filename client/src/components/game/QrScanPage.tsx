import type { QrScanConfig } from "@shared/schema";
import { useQrScanner } from "./qr-scan/useQrScanner";
import {
  InstructionView, CameraView,
  ManualInputView, SuccessView, ErrorView,
} from "./qr-scan/QrScanViews";
import { useCameraOverlayMode } from "@/hooks/useCameraOverlayMode";

interface QrScanPageProps {
  config: QrScanConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function QrScanPage({ config, onComplete, sessionId }: QrScanPageProps) {
  const { state, actions, scannerContainerRef } = useQrScanner(config, sessionId, onComplete);
  const { mode } = state;

  // 🆕 掃描相機開啟時隱藏浮動 UI（避免擋切鏡頭按鈕）
  useCameraOverlayMode(mode === "initializing" || mode === "scanning");

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {mode === "instruction" && (
        <InstructionView config={config} state={state} actions={actions} />
      )}
      {(mode === "initializing" || mode === "scanning") && (
        <CameraView
          state={state}
          actions={actions}
          scannerContainerRef={scannerContainerRef}
          isInitializing={mode === "initializing"}
        />
      )}
      {mode === "manual" && (
        <ManualInputView config={config} state={state} actions={actions} />
      )}
      {mode === "success" && <SuccessView config={config} />}
      {mode === "error" && <ErrorView />}
    </div>
  );
}
