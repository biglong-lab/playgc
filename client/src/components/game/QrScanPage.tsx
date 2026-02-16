import type { QrScanConfig } from "@shared/schema";
import { useQrScanner } from "./qr-scan/useQrScanner";
import {
  InstructionView, InitializingView, ScanningView,
  ManualInputView, SuccessView, ErrorView,
} from "./qr-scan/QrScanViews";

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

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {mode === "instruction" && (
        <InstructionView config={config} state={state} actions={actions} />
      )}
      {mode === "initializing" && (
        <InitializingView actions={actions} scannerContainerRef={scannerContainerRef} />
      )}
      {mode === "scanning" && (
        <ScanningView actions={actions} scannerContainerRef={scannerContainerRef} />
      )}
      {mode === "manual" && (
        <ManualInputView config={config} state={state} actions={actions} />
      )}
      {mode === "success" && <SuccessView config={config} />}
      {mode === "error" && <ErrorView />}
    </div>
  );
}
