// 場域切換器 — super_admin 專用
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Check } from "lucide-react";

interface Field {
  id: string;
  name: string;
  code: string;
}

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
  const [selectedFieldId, setSelectedFieldId] = useState(
    getStoredFieldId() || currentFieldId
  );

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

  const selectedField = fieldsList?.find(f => f.id === selectedFieldId);
  const displayName = selectedField?.name || currentFieldName;

  const handleSelect = (field: Field) => {
    setSelectedFieldId(field.id);
    setStoredFieldId(field.id);
    // 重新載入頁面以套用新場域（簡單可靠）
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[200px]">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{displayName}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          切換場域
        </div>
        <DropdownMenuSeparator />
        {fieldsList?.map((field) => (
          <DropdownMenuItem
            key={field.id}
            onClick={() => handleSelect(field)}
            className="gap-2"
          >
            {field.id === selectedFieldId && (
              <Check className="w-4 h-4 text-primary" />
            )}
            {field.id !== selectedFieldId && <div className="w-4" />}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{field.name}</p>
              <p className="text-xs text-muted-foreground">{field.code}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
