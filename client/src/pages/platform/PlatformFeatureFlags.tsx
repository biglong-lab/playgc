// 🌐 平台功能旗標管理
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleLeft, Loader2, Plus } from "lucide-react";

interface FeatureFlag {
  id: string;
  flagKey: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultEnabled: boolean | null;
  requiredPlan: string | null;
  status: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  game: { label: "遊戲類", emoji: "🎮", color: "bg-violet-100 text-violet-700" },
  battle: { label: "對戰類", emoji: "⚔️", color: "bg-rose-100 text-rose-700" },
  payment: { label: "金流類", emoji: "💰", color: "bg-emerald-100 text-emerald-700" },
  branding: { label: "品牌類", emoji: "🎨", color: "bg-pink-100 text-pink-700" },
  integration: { label: "整合類", emoji: "🔌", color: "bg-sky-100 text-sky-700" },
  experimental: { label: "實驗性", emoji: "🧪", color: "bg-amber-100 text-amber-700" },
};

export default function PlatformFeatureFlags() {
  const { isAuthenticated } = useAdminAuth();

  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/platform/feature-flags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/feature-flags");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // 依分類分組
  const grouped = (flags ?? []).reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category ?? "experimental";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  return (
    <PlatformAdminLayout
      title="🎛️ 功能開關"
      actions={
        <Button size="sm" disabled>
          <Plus className="w-4 h-4 mr-1" />
          新增旗標
        </Button>
      }
    >
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <ToggleLeft className="w-5 h-5" />
            功能開關管理
          </h2>
          <p className="text-blue-100 text-sm">
            控制全平台功能的預設啟用狀態與方案要求。場域個別覆寫可在「場域管理」設定。
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !flags?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              尚無功能旗標
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, catFlags]) => {
              const catInfo = CATEGORY_LABELS[cat] ?? {
                label: cat,
                emoji: "📌",
                color: "bg-slate-100",
              };
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span>{catInfo.emoji}</span>
                    <span>{catInfo.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {catFlags.length}
                    </Badge>
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {catFlags.map((flag) => (
                          <FlagRow key={flag.id} flag={flag} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

function FlagRow({ flag }: { flag: FeatureFlag }) {
  return (
    <div className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {flag.flagKey}
          </code>
          <p className="font-medium text-sm truncate">{flag.name}</p>
        </div>
        {flag.description && (
          <p className="text-xs text-muted-foreground mb-1.5">{flag.description}</p>
        )}
        <div className="flex items-center gap-2">
          {flag.requiredPlan && (
            <Badge variant="outline" className="text-[10px]">
              需要方案：{flag.requiredPlan}
            </Badge>
          )}
          {flag.defaultEnabled ? (
            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
              ✅ 預設啟用
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
              ⏸️ 預設停用
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {flag.status ?? "active"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
