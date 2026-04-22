// 🔗 通用頁面選擇器（nextPageId / jumpTargetId 等用途）
//
// 用途：取代散落在 FlowRouterEditor / ButtonConfigEditor / Legacy ChoiceVerify 等
// 各自實作的「下一頁 dropdown」，統一顯示規則、圖示、customName
//
// 特殊值：
//   - ""（空）或 "_next"：依預設順序
//   - "_end"：結束遊戲
//   - 其他 UUID：指定頁面
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Play, Flag } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "@/pages/game-editor/constants";

interface PageSelectProps {
  value?: string;
  onChange: (pageIdOrSpecial: string) => void;
  /** 所有頁面（通常由 editor 傳入） */
  allPages: Page[];
  /** 排除掉自己（當前編輯的頁面 id，避免自指） */
  currentPageId?: string;
  /** 允許的特殊值：next / end / empty（預設都允許） */
  allowNext?: boolean;   // 預設 true
  allowEnd?: boolean;    // 預設 true
  allowEmpty?: boolean;  // 預設 false；true 時多一個「(未設定)」選項
  placeholder?: string;
  className?: string;
  testId?: string;
  /** 置頂顯示的使用情境說明（選填） */
  variant?: "default" | "compact";
}

// 內部統一的特殊值常數（不改既有儲存格式）
const VAL_NEXT = "_next";
const VAL_END = "_end";
const VAL_EMPTY = "__empty__";

export function PageSelect({
  value,
  onChange,
  allPages,
  currentPageId,
  allowNext = true,
  allowEnd = true,
  allowEmpty = false,
  placeholder = "選擇目標頁面",
  className,
  testId,
  variant = "default",
}: PageSelectProps) {
  // 正規化當前值 → dropdown 顯示用
  const displayValue = (() => {
    if (!value) return allowEmpty ? VAL_EMPTY : VAL_NEXT;
    if (value === VAL_END) return VAL_END;
    if (value === VAL_NEXT) return VAL_NEXT;
    return value; // UUID
  })();

  const handleChange = (v: string) => {
    // __empty__ 對外回傳空字串；其他原樣傳
    if (v === VAL_EMPTY) {
      onChange("");
      return;
    }
    onChange(v);
  };

  // 過濾掉自己
  const visiblePages = currentPageId
    ? allPages.filter((p) => p.id !== currentPageId)
    : allPages;

  const heightClass = variant === "compact" ? "h-8 text-xs" : "";

  return (
    <Select value={displayValue} onValueChange={handleChange}>
      <SelectTrigger className={`${heightClass} ${className ?? ""}`} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && (
          <SelectItem value={VAL_EMPTY}>
            <span className="text-muted-foreground">（未設定）</span>
          </SelectItem>
        )}
        {allowNext && (
          <SelectItem value={VAL_NEXT}>
            <span className="flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              下一頁（依預設順序）
            </span>
          </SelectItem>
        )}
        {allowEnd && (
          <SelectItem value={VAL_END}>
            <span className="flex items-center gap-2 text-amber-600">
              <Flag className="w-4 h-4" />
              結束遊戲
            </span>
          </SelectItem>
        )}

        {visiblePages.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            尚無其他頁面可選
          </div>
        )}

        {visiblePages.map((p, idx) => {
          // allPages 的真實索引（不是 filter 後的）— 顯示 #序號時用
          const realIndex = allPages.findIndex((x) => x.id === p.id);
          const info = getPageTypeInfo(p.pageType);
          const pwn = p as Page & { customName?: string | null };
          const label = pwn.customName?.trim() || info.label;
          return (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <info.icon className="w-4 h-4" />
                <span className="font-mono text-xs text-muted-foreground">
                  #{realIndex + 1}
                </span>
                <span>{label}</span>
                {pwn.customName?.trim() && (
                  <span className="text-[10px] text-muted-foreground">
                    · {info.label}
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
