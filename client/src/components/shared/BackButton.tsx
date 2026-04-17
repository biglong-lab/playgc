// ⬅️ 智慧返回按鈕 — 優先用 history.back，fallback 到父層路由
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { buildBreadcrumbs } from "@/config/route-meta";

interface BackButtonProps {
  /** 手動指定返回路徑（覆寫自動判斷） */
  to?: string;
  /** 按鈕文字（預設「返回」） */
  label?: string;
  /** 外觀變體 */
  variant?: "ghost" | "outline" | "default";
  /** 小尺寸（用於嵌入式） */
  size?: "sm" | "default";
  className?: string;
}

export default function BackButton({
  to,
  label = "返回",
  variant = "ghost",
  size = "sm",
  className,
}: BackButtonProps) {
  const [location, setLocation] = useLocation();

  const handleBack = () => {
    if (to) {
      setLocation(to);
      return;
    }

    // 優先用 history.back（保留捲動位置）
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // Fallback：從 route-meta 找父層
    const items = buildBreadcrumbs(location);
    if (items.length >= 2) {
      const parent = items[items.length - 2];
      if (parent.path) {
        setLocation(parent.path);
        return;
      }
    }

    // 最終 fallback：回首頁
    setLocation("/");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBack}
      className={`gap-1 ${className ?? ""}`}
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </Button>
  );
}
