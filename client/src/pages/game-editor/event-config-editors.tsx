// 事件觸發條件與獎勵設定子編輯器
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Page } from "@shared/schema";
import { REWARD_TYPES, getPageTypeInfo } from "./constants";

// 觸發條件 config 型別
type TriggerConfig = Record<string, unknown>;
type RewardConfig = Record<string, unknown>;

export function TriggerConfigEditor({
  eventType,
  config,
  onChange
}: {
  eventType: string;
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  switch (eventType) {
    case "qrcode":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">QR Code ID</label>
          <Input
            value={String(config.qrCodeId || "")}
            onChange={(e) => onChange({ ...config, qrCodeId: e.target.value })}
            placeholder="QR-001"
            data-testid="trigger-qrcode-id"
          />
        </div>
      );
    case "gps":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">緯度</label>
              <Input
                type="number"
                step="0.0001"
                value={Number(config.lat) || 25.033}
                onChange={(e) => onChange({ ...config, lat: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lat"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">經度</label>
              <Input
                type="number"
                step="0.0001"
                value={Number(config.lng) || 121.565}
                onChange={(e) => onChange({ ...config, lng: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lng"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">觸發半徑 (公尺)</label>
            <Input
              type="number"
              value={Number(config.radius) || 50}
              onChange={(e) => onChange({ ...config, radius: parseInt(e.target.value) })}
              data-testid="trigger-gps-radius"
            />
          </div>
        </div>
      );
    case "shooting":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">最低分數</label>
          <Input
            type="number"
            value={Number(config.minScore) || 100}
            onChange={(e) => onChange({ ...config, minScore: parseInt(e.target.value) })}
            data-testid="trigger-shooting-score"
          />
        </div>
      );
    case "timer":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">延遲秒數</label>
          <Input
            type="number"
            value={Number(config.delaySeconds) || 60}
            onChange={(e) => onChange({ ...config, delaySeconds: parseInt(e.target.value) })}
            data-testid="trigger-timer-delay"
          />
        </div>
      );
    default:
      return null;
  }
}

export function RewardConfigEditor({
  config,
  pages,
  onChange,
}: {
  config: RewardConfig;
  pages: Page[];
  onChange: (config: RewardConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">獎勵類型</label>
        <Select
          value={String(config.type || "points")}
          onValueChange={(value) => {
            const baseConfig: RewardConfig = { type: value };
            switch (value) {
              case "points":
                onChange({ ...baseConfig, value: 10 });
                break;
              case "item":
                onChange({ ...baseConfig, itemId: "" });
                break;
              case "unlock_page":
                onChange({ ...baseConfig, pageId: "" });
                break;
              case "message":
                onChange({ ...baseConfig, message: "" });
                break;
              default:
                onChange(baseConfig);
            }
          }}
        >
          <SelectTrigger data-testid="select-reward-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REWARD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-2">
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.type === "points" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">分數</label>
          <Input
            type="number"
            value={Number(config.value) || 10}
            onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) })}
            data-testid="reward-points-value"
          />
        </div>
      )}

      {config.type === "item" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">道具 ID</label>
          <Input
            value={String(config.itemId || "")}
            onChange={(e) => onChange({ ...config, itemId: e.target.value })}
            placeholder="輸入道具 ID"
            data-testid="reward-item-id"
          />
        </div>
      )}

      {config.type === "unlock_page" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">目標頁面</label>
          <Select
            value={String(config.pageId || "")}
            onValueChange={(value) => onChange({ ...config, pageId: value })}
          >
            <SelectTrigger data-testid="reward-page-select">
              <SelectValue placeholder="選擇頁面" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p, idx) => {
                const info = getPageTypeInfo(p.pageType);
                return (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <info.icon className="w-4 h-4" />
                      #{idx + 1} {info.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.type === "message" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">訊息內容</label>
          <Textarea
            value={String(config.message || "")}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
            placeholder="輸入要顯示的訊息..."
            rows={3}
            data-testid="reward-message"
          />
        </div>
      )}
    </div>
  );
}
