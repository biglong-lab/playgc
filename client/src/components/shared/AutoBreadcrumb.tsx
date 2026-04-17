// 🍞 自動麵包屑 — 根據當前路由 + ROUTE_META 自動產生
import { useLocation, Link } from "wouter";
import { buildBreadcrumbs } from "@/config/route-meta";
import { ChevronRight, Home } from "lucide-react";

interface AutoBreadcrumbProps {
  /** 覆寫當前頁面標題（例如顯示遊戲名稱而非「遊戲編輯」）*/
  currentTitle?: string;
  /** 額外插入的中間節點（例如 {title: "我的遊戲", path: "/admin/games"}）*/
  extra?: Array<{ title: string; path?: string; emoji?: string }>;
  /** 是否顯示根圖示 */
  showHome?: boolean;
  className?: string;
}

export default function AutoBreadcrumb({
  currentTitle,
  extra,
  showHome = true,
  className = "",
}: AutoBreadcrumbProps) {
  const [location] = useLocation();
  const items = buildBreadcrumbs(location);

  if (items.length === 0) return null;

  // 若有覆寫，取代最後一項
  if (currentTitle) {
    items[items.length - 1] = {
      ...items[items.length - 1],
      title: currentTitle,
    };
  }

  // 插入 extra 到倒數第二位
  if (extra && extra.length > 0) {
    items.splice(items.length - 1, 0, ...extra);
  }

  return (
    <nav
      aria-label="麵包屑"
      className={`flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap ${className}`}
    >
      {showHome && (
        <>
          <Link href="/">
            <a className="hover:text-foreground transition-colors flex items-center">
              <Home className="w-3 h-3" />
            </a>
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50" />
        </>
      )}
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.title}-${idx}`} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50" />
            )}
            {isLast || !item.path ? (
              <span className="text-foreground font-medium truncate max-w-[180px]">
                {item.emoji && <span className="mr-0.5">{item.emoji}</span>}
                {item.title}
              </span>
            ) : (
              <Link href={item.path}>
                <a className="hover:text-foreground transition-colors truncate max-w-[120px]">
                  {item.emoji && <span className="mr-0.5">{item.emoji}</span>}
                  {item.title}
                </a>
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
