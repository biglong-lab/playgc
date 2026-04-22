// 🤖 AI 模型選擇器
//
// 用途：PhotoMission / TextVerify / 其他 AI 驗證類元件用
// 顯示模型名稱 + 推薦標記 + 價格 + 描述
// 預設「使用場域預設」= 空值（由後端 resolveAiApiKey + DEFAULT_VISION_MODEL 處理）
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS } from "@shared/schema/ai-models";

interface AIModelSelectProps {
  value?: string;
  onChange: (modelId: string) => void;
  /** 是否只顯示支援 vision 的模型（預設 true，因為主要用於照片驗證） */
  visionOnly?: boolean;
  className?: string;
  testId?: string;
}

const TIER_COLORS = {
  budget: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  balanced: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  premium: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
} as const;

const TIER_LABELS = {
  budget: "經濟",
  balanced: "均衡",
  premium: "高階",
} as const;

export function AIModelSelect({
  value,
  onChange,
  visionOnly = true,
  className,
  testId,
}: AIModelSelectProps) {
  const filtered = visionOnly
    ? AI_MODELS.filter((m) => m.vision)
    : AI_MODELS;

  return (
    <Select
      value={value || "__default__"}
      onValueChange={(v) => onChange(v === "__default__" ? "" : v)}
    >
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder="選擇 AI 模型..." />
      </SelectTrigger>
      <SelectContent className="max-w-md">
        <SelectItem value="__default__">
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">使用場域預設</span>
            <Badge variant="outline" className="text-xs">
              Gemini Flash
            </Badge>
          </span>
        </SelectItem>
        {filtered.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex flex-col items-start w-full">
              <span className="flex items-center gap-2">
                <span className="font-medium">{model.label}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${TIER_COLORS[model.tier]}`}
                >
                  {TIER_LABELS[model.tier]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  ${model.priceIn}/M in · ${model.priceOut}/M out
                </span>
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {model.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
