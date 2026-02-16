import { Loader2 } from "lucide-react";

/**
 * 全站統一頁面載入佔位元件
 * 用於 React.lazy() + Suspense 的 fallback
 */
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">載入中...</p>
      </div>
    </div>
  );
}
