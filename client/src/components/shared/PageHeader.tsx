// 📜 統一頁面標題列 — 麵包屑 + 標題 + 返回 + 動作
import AutoBreadcrumb from "./AutoBreadcrumb";
import BackButton from "./BackButton";

interface PageHeaderProps {
  /** 頁面標題（通常由 meta 自動提供，可覆寫） */
  title?: string;
  /** 副標題 */
  subtitle?: string;
  /** 右上角動作區 */
  actions?: React.ReactNode;
  /** 顯示返回按鈕（預設 true） */
  showBack?: boolean;
  /** 返回按鈕指定路徑 */
  backTo?: string;
  /** 返回按鈕文字 */
  backLabel?: string;
  /** 顯示麵包屑（預設 true） */
  showBreadcrumb?: boolean;
  /** 麵包屑覆寫當前標題（例如顯示具體遊戲名稱） */
  breadcrumbTitle?: string;
  /** 麵包屑額外中間節點 */
  breadcrumbExtra?: Array<{ title: string; path?: string; emoji?: string }>;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  showBack = true,
  backTo,
  backLabel,
  showBreadcrumb = true,
  breadcrumbTitle,
  breadcrumbExtra,
  className,
}: PageHeaderProps) {
  return (
    <div className={`space-y-3 mb-4 ${className ?? ""}`}>
      {/* 麵包屑 */}
      {showBreadcrumb && (
        <AutoBreadcrumb
          currentTitle={breadcrumbTitle}
          extra={breadcrumbExtra}
        />
      )}

      {/* 標題列 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {showBack && (
            <BackButton
              to={backTo}
              label={backLabel ?? "返回"}
              className="-ml-2 mt-0.5"
            />
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="text-xl font-bold truncate">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
