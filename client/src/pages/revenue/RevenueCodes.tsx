// 💰 財務中心 — 兌換碼中心（跨遊戲）
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, ExternalLink } from "lucide-react";

interface CodeRow {
  code: {
    id: string;
    code: string;
    scope: string;
    gameId: string | null;
    chapterId: string | null;
    status: string;
    maxUses: number | null;
    usedCount: number | null;
    expiresAt: string | null;
    createdAt: string;
  };
  game: { id: string; title: string } | null;
}

export default function RevenueCodes() {
  const { isAuthenticated } = useAdminAuth();
  const { data, isLoading } = useQuery<{ codes: CodeRow[] }>({
    queryKey: ["/api/revenue/codes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/revenue/codes");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <UnifiedAdminLayout title="💰 兌換碼中心">
      <div className="space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            兌換碼中心
          </h2>
          <p className="text-emerald-50 text-sm">跨所有遊戲的兌換碼一覽</p>
        </div>

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : !data?.codes?.length ? (
          <EmptyState
            icon={Ticket}
            title="尚無兌換碼"
            description="前往遊戲管理為特定遊戲建立兌換碼。Phase 3 後續會支援跨遊戲直接建立。"
            actions={[{ label: "前往遊戲管理", href: "/admin/games" }]}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.codes.map((row) => (
                  <CodeRow key={row.code.id} row={row} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

function CodeRow({ row }: { row: CodeRow }) {
  const { code, game } = row;
  const used = code.usedCount ?? 0;
  const max = code.maxUses ?? Infinity;
  const usageText = code.maxUses ? `${used} / ${code.maxUses}` : `${used} (無限)`;

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div className="font-mono text-sm bg-muted px-2.5 py-1 rounded">
        {code.code}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm truncate">
            {game?.title ?? <span className="text-muted-foreground">（未指定遊戲）</span>}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {code.scope === "game" ? "整款遊戲" : "章節"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          使用 {usageText}
          {code.expiresAt && ` · 有效至 ${new Date(code.expiresAt).toLocaleDateString("zh-TW")}`}
        </p>
      </div>
      <StatusBadge status={code.status} />
      {game && (
        <Link href={`/admin/games/${game.id}/tickets`}>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    active: { label: "有效", className: "bg-emerald-100 text-emerald-700" },
    used: { label: "已用完", className: "bg-slate-100 text-slate-600" },
    expired: { label: "已過期", className: "bg-amber-100 text-amber-700" },
    disabled: { label: "已停用", className: "bg-rose-100 text-rose-700" },
  };
  const v = variants[status] ?? { label: status, className: "bg-slate-100" };
  return (
    <Badge variant="secondary" className={`text-[10px] ${v.className}`}>
      {v.label}
    </Badge>
  );
}
