// 編輯器頂部「資源管理」連結列（道具 / 成就 / 地點 / 票券 / 設定）
//
// 保留 <Link>（可中鍵 / ⌘ 點另開分頁）；有未存變更時由 useUnsavedChangesGuard
// 在 capture 階段攔截點擊並跳出未存對話框，這裡不需要額外處理。
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Package, Trophy, MapPin, Ticket, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorResourceBarProps {
  basePath: string;
  gameId: string;
}

const RESOURCE_LINKS: ReadonlyArray<{ path: string; label: string; icon: LucideIcon }> = [
  { path: "items", label: "道具", icon: Package },
  { path: "achievements", label: "成就", icon: Trophy },
  { path: "locations", label: "地點", icon: MapPin },
  { path: "tickets", label: "票券", icon: Ticket },
  { path: "settings", label: "設定", icon: Settings },
];

export default function EditorResourceBar({ basePath, gameId }: EditorResourceBarProps) {
  return (
    <div className="px-4 py-2 border-t border-border/50 flex items-center gap-2 bg-muted/30">
      <span className="text-xs text-muted-foreground mr-2">資源管理:</span>
      {RESOURCE_LINKS.map(({ path, label, icon: Icon }) => (
        <Link key={path} href={`${basePath}/${gameId}/${path}`}>
          <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid={`link-${path}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
