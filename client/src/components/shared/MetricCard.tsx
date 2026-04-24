// 📊 共用統計卡元件 — 給 Admin Dashboard / Analytics / Sessions / Devices / Leaderboard 統一使用
//
// 特色：
// - 支援 active（當前選中 filter）高亮 ring
// - 支援 onClick 切換 filter，自動加 hover-elevate + cursor
// - 支援 Enter / Space 鍵盤觸發（a11y）
// - 副標題、右側 icon、小 badge 都是選配
// - 支援 LIVE 脈衝點（給「進行中」類型的數字用）
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type MetricAccent = "default" | "success" | "warning" | "destructive" | "primary" | "muted";

interface MetricCardProps {
  /** 標題（例如「在線設備」、「發布遊戲」）*/
  label: string;
  /** 數字或文字（空資料可傳 "—"）*/
  value: ReactNode;
  /** 副標題（次要描述，例如「今日: 3 場」）*/
  sublabel?: ReactNode;
  /** 右側圖示 */
  icon?: LucideIcon;
  /** 數字顏色語意（default / success / warning / destructive / primary / muted） */
  accent?: MetricAccent;
  /** 是否顯示脈衝 LIVE 點（用於「進行中」等即時指標） */
  live?: boolean;
  /** 是否為當前選中 filter — 顯示 ring 高亮 */
  active?: boolean;
  /** 點擊切換（給了這個才有 hover 互動）*/
  onClick?: () => void;
  /** data-testid */
  testid?: string;
  /** 覆蓋 accent 時用的自訂顏色 class（少用） */
  className?: string;
}

const accentTextClass: Record<MetricAccent, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

const accentIconClass: Record<MetricAccent, string> = {
  default: "text-primary/50",
  success: "text-success/50",
  warning: "text-warning/50",
  destructive: "text-destructive/50",
  primary: "text-primary/50",
  muted: "text-muted-foreground/30",
};

const accentLiveBgClass: Record<MetricAccent, string> = {
  default: "bg-success",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  primary: "bg-primary",
  muted: "bg-muted-foreground",
};

export default function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = "default",
  live = false,
  active = false,
  onClick,
  testid,
  className,
}: MetricCardProps) {
  const clickable = typeof onClick === "function";

  const handleKeyDown = clickable
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  return (
    <Card
      className={[
        clickable ? "cursor-pointer hover-elevate transition-all" : "",
        active ? "ring-2 ring-primary bg-primary/5" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? active : undefined}
      data-testid={testid}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {label}
              {live && (
                <span className="relative flex h-2 w-2" aria-label="live">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${accentLiveBgClass[accent]} opacity-75`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${accentLiveBgClass[accent]}`}
                  />
                </span>
              )}
            </p>
            <p className={`font-number text-3xl font-bold ${accentTextClass[accent]}`}>
              {value}
            </p>
            {sublabel && (
              <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
            )}
          </div>
          {Icon && <Icon className={`w-8 h-8 ${accentIconClass[accent]} shrink-0`} />}
        </div>
      </CardContent>
    </Card>
  );
}
