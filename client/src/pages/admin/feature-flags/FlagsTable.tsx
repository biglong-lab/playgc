// 🎚️ 元件開關列表（2026-09-23 P0-B：自 AdminFeatureFlags 拆出）
//   不能切換的列（非 super_admin 看全平台開關）顯示「僅平台可改」、不給按鈕
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Power, PowerOff, Bot } from "lucide-react";
import { canToggleFlag, scopeLabel, type FeatureFlag, type FlagAdmin } from "./flag-scope";

interface FlagsTableProps {
  flags: FeatureFlag[];
  admin: FlagAdmin | null;
  togglePending: boolean;
  onRequestToggle: (flag: FeatureFlag) => void;
}

function ReasonBadge({ reason }: { reason: string | null }) {
  if (!reason) return null;
  if (reason === "manual") return <Badge variant="outline">手動關</Badge>;
  if (reason === "auto:high_failure")
    return <Badge className="bg-red-600 text-white"><Bot className="w-3 h-3 mr-1" />高失敗率</Badge>;
  if (reason === "auto:low_completion")
    return <Badge className="bg-orange-600 text-white"><Bot className="w-3 h-3 mr-1" />完成率低</Badge>;
  return <Badge variant="outline">{reason}</Badge>;
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-emerald-500 text-white"><Power className="w-3 h-3 mr-1" />啟用</Badge>
  ) : (
    <Badge variant="destructive"><PowerOff className="w-3 h-3 mr-1" />關閉</Badge>
  );
}

function FlagRow({ flag, admin, togglePending, onRequestToggle }: Omit<FlagsTableProps, "flags"> & { flag: FeatureFlag }) {
  const canToggle = canToggleFlag(flag, admin);
  return (
    <tr className="border-t" data-testid={`flag-${flag.moduleKey}`}>
      <td className="px-3 py-2 font-mono text-xs">{flag.moduleKey}</td>
      <td className="px-3 py-2 text-xs">{scopeLabel(flag, admin)}</td>
      <td className="px-3 py-2 text-center"><StatusBadge enabled={flag.enabled} /></td>
      <td className="px-3 py-2 text-xs">
        <ReasonBadge reason={flag.disabledReason} />
        {flag.metrics && (
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {flag.metrics.errored ?? 0}/{flag.metrics.total ?? 0} 錯誤 ({Math.round((flag.metrics.failRate ?? 0) * 100)}%)
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {flag.disabledAt ? new Date(flag.disabledAt).toLocaleString("zh-TW") : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        {canToggle ? (
          <Button
            size="sm"
            variant={flag.enabled ? "outline" : "default"}
            disabled={togglePending}
            onClick={() => onRequestToggle(flag)}
            data-testid={`btn-toggle-${flag.moduleKey}`}
          >
            {flag.enabled ? "停用" : "啟用"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground" title="全平台開關只有平台管理員可以修改">僅平台可改</span>
        )}
      </td>
    </tr>
  );
}

export function FlagsTable({ flags, ...rowProps }: FlagsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">元件</th>
            <th className="px-3 py-2 text-left">範圍</th>
            <th className="px-3 py-2 text-center">狀態</th>
            <th className="px-3 py-2 text-left">原因</th>
            <th className="px-3 py-2 text-left">關閉時間</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => <FlagRow key={f.id} flag={f} {...rowProps} />)}
        </tbody>
      </table>
    </div>
  );
}
