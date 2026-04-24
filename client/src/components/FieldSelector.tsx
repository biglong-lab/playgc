// 場域切換器 — super_admin 專用
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Building2, ChevronDown, Check, Loader2,
  Target, Swords, MapPin, Camera, BookOpen, DollarSign,
  Megaphone, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { FieldSettings } from "@shared/schema";

interface Field {
  id: string;
  name: string;
  code: string;
  /** 🆕 settings jsonb — 用來顯示模組啟用狀態 */
  settings?: FieldSettings | null;
}

/** 🆕 模組徽章定義（對應 /admin/fields 表格相同 icon，保持視覺一致）*/
const MODULES: Array<{
  key: keyof FieldSettings;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "enableShootingMission", label: "射擊", Icon: Target },
  { key: "enableBattleArena",     label: "對戰", Icon: Swords },
  { key: "enableGpsMission",      label: "GPS",  Icon: MapPin },
  { key: "enablePhotoMission",    label: "拍照", Icon: Camera },
  { key: "enableChapters",        label: "章節", Icon: BookOpen },
  { key: "enablePayment",         label: "收費", Icon: DollarSign },
];

interface FieldSelectorProps {
  currentFieldId: string;
  currentFieldName: string;
  isSuperAdmin: boolean;
}

const FIELD_STORAGE_KEY = "admin_selected_field_id";

/** 從 localStorage 讀取 super_admin 上次選擇的場域 */
export function getStoredFieldId(): string | null {
  try {
    return localStorage.getItem(FIELD_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 儲存 super_admin 選擇的場域 */
export function setStoredFieldId(fieldId: string): void {
  try {
    localStorage.setItem(FIELD_STORAGE_KEY, fieldId);
  } catch {
    // localStorage 不可用時忽略
  }
}

export default function FieldSelector({
  currentFieldId,
  currentFieldName,
  isSuperAdmin,
}: FieldSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);

  // 只有 super_admin 才載入場域列表
  const { data: fieldsList } = useQuery<Field[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/fields");
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  // 非 super_admin 只顯示當前場域名稱
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
        <Building2 className="w-4 h-4" />
        <span className="truncate max-w-[120px]">{currentFieldName}</span>
      </div>
    );
  }

  const displayName = currentFieldName;

  // 🆕 真正切換：呼叫後端 switch-field 更新 session token，不再只寫 localStorage
  const handleSelect = async (field: Field) => {
    if (field.id === currentFieldId) return; // 同場域不切
    setSwitching(true);
    try {
      const res = await apiRequest("POST", "/api/admin/switch-field", {
        fieldCode: field.code,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "切換失敗");
      }
      setStoredFieldId(field.id); // 記下選擇（輔助）
      // 清所有 cache 避免看到舊場域資料
      queryClient.clear();
      toast({ title: `已切換到 ${field.name}` });
      // 🔄 強制重載當前頁面
      //   設 window.location.href = "/admin" 若當前就在 /admin，瀏覽器視為 no-op 不會重載
      //   改用 reload() 確保所有 query 重取 + provider 重建（場域主題也會換）
      //   使用者留在原本的 admin 子頁（例 /admin/games），但資料全變新場域的
      window.location.reload();
    } catch (err) {
      toast({
        title: "切換失敗",
        description: err instanceof Error ? err.message : "請重新登入",
        variant: "destructive",
      });
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[200px]" disabled={switching}>
          {switching ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          ) : (
            <Building2 className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{displayName}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          切換場域
        </div>
        <DropdownMenuSeparator />
        {fieldsList?.map((field) => {
          const enabledCount = MODULES.filter((m) => field.settings?.[m.key] === true).length;
          return (
            <DropdownMenuItem
              key={field.id}
              onClick={() => handleSelect(field)}
              className="gap-2 items-start py-2.5"
              disabled={switching}
              data-testid={`field-select-${field.code}`}
            >
              {field.id === currentFieldId ? (
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{field.name}</p>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {enabledCount}/{MODULES.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{field.code}</p>
                {/* 🆕 模組啟用迷你 icon bar */}
                <div className="flex items-center gap-0.5 mt-1.5">
                  {MODULES.map((m) => {
                    const enabled = field.settings?.[m.key] === true;
                    return (
                      <m.Icon
                        key={String(m.key)}
                        className={`w-3 h-3 ${
                          enabled ? "text-primary" : "text-muted-foreground/25"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
