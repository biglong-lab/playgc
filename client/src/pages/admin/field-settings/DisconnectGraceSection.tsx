// ⏱️ 場域設定 › 功能模組 › 多人遊戲行為（斷線寬限期）
// 2026-09-23 從 FieldSettingsPage 抽出：
//   - 後端改為斷線時讀場域設定（30 秒快取），不再需要重啟 / 設環境變數
//   - 輸入範圍與設定 API 驗證共用 shared/lib/disconnect-grace
import { DISCONNECT_GRACE_LIMITS } from "@shared/lib/disconnect-grace";

export type PauseStrategy = "always_pause" | "never_pause" | "leader_decide";

interface DisconnectGraceSectionProps {
  readonly graceSec: number;
  readonly autoLeaveSec: number;
  readonly pauseStrategy: PauseStrategy;
  readonly onGraceSecChange: (sec: number) => void;
  readonly onAutoLeaveSecChange: (sec: number) => void;
  readonly onPauseStrategyChange: (strategy: PauseStrategy) => void;
}

const { graceSec: GRACE, autoLeaveSec: AUTO_LEAVE } = DISCONNECT_GRACE_LIMITS;

export default function DisconnectGraceSection({
  graceSec,
  autoLeaveSec,
  pauseStrategy,
  onGraceSecChange,
  onAutoLeaveSecChange,
  onPauseStrategyChange,
}: DisconnectGraceSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          多人遊戲行為（斷線寬限期）
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          控制玩家在多人遊戲中斷線時的處理流程。預設值適合多數場域，特殊活動再調整。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SecondsInput
          label="寬限期（秒）"
          value={graceSec}
          range={GRACE}
          onChange={onGraceSecChange}
          help={`玩家斷線後幾秒內不影響（預設 ${GRACE.default} 秒，可設 ${GRACE.min}～${GRACE.max}）`}
          testId="input-disconnect-grace"
        />
        <SecondsInput
          label="超時自動離開（秒）"
          value={autoLeaveSec}
          range={AUTO_LEAVE}
          onChange={onAutoLeaveSecChange}
          help={`寬限期過後再多久 server 自動標離開（預設 ${AUTO_LEAVE.default} 秒，可設 ${AUTO_LEAVE.min}～${AUTO_LEAVE.max}）`}
          testId="input-auto-leave-grace"
        />
      </div>
      <div>
        <label className="text-sm font-medium">暫停策略</label>
        <select
          value={pauseStrategy}
          onChange={(e) => onPauseStrategyChange(e.target.value as PauseStrategy)}
          className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
          data-testid="select-pause-strategy"
        >
          <option value="leader_decide">隊長決定（預設）— 寬限期過顯示 dialog</option>
          <option value="never_pause">不暫停 — 自動處理，不打擾玩家</option>
          <option value="always_pause">永遠暫停 — 等斷線玩家手動回來</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground italic" data-testid="grace-apply-hint">
        💡 儲存後約 30 秒內生效，套用於之後發生的斷線（進行中的倒數維持原設定）。
      </p>
    </div>
  );
}

function SecondsInput({
  label,
  value,
  range,
  onChange,
  help,
  testId,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; default: number };
  onChange: (sec: number) => void;
  help: string;
  testId: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="number"
        min={range.min}
        max={range.max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || range.default)}
        className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
        data-testid={testId}
      />
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </div>
  );
}
