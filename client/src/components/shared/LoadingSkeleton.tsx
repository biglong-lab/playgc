// 💀 統一骨架屏 — 比 Loader2 spinner 更好看
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** 統計卡骨架 */
export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="w-5 h-5 mb-2" />
        <Skeleton className="h-3 w-16 mb-1" />
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  );
}

/** 列表骨架（預設 5 行）*/
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** 卡片網格骨架 */
export function GridSkeleton({
  count = 6,
  cols = 3,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 2
      ? "md:grid-cols-2"
      : cols === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-2/3 mb-2" />
            <Skeleton className="h-3 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-3" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 表單骨架 */
export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** 頁面級骨架（含頂部 + 卡片） */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <ListSkeleton count={5} />
    </div>
  );
}
