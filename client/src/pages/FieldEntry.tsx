// 🏢 場域總入口頁 — 列出所有 active 場域讓玩家選擇
//
// 網址：/f （不帶 fieldCode）
// 當玩家第一次進入或想切換場域時看到這個畫面
// 點擊場域卡片 → 進入 /f/:fieldCode 該場域 Landing

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ArrowRight, Gamepad2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FieldItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
}

export default function FieldEntry() {
  const [, setLocation] = useLocation();

  // 公開端點：只回 active 場域（後端未來可加 visible_on_landing 欄位）
  const { data: fields, isLoading } = useQuery<FieldItem[]>({
    queryKey: ["/api/fields/public"],
    queryFn: async () => {
      const res = await fetch("/api/fields/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            選擇要進入的場域
          </h1>
          <p className="text-muted-foreground">
            每個場域有獨立的遊戲與排行榜
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !fields || fields.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">目前沒有可用的場域</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <Card
                key={f.id}
                className="cursor-pointer hover-elevate transition-all group"
                onClick={() => setLocation(`/f/${f.code}`)}
                data-testid={`field-card-${f.code}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {f.logoUrl ? (
                      <img
                        src={f.logoUrl}
                        alt={f.name}
                        className="w-14 h-14 rounded-xl object-contain bg-primary/10 p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-7 h-7 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-xl mb-1 truncate">
                        {f.name}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mb-2">
                        {f.code}
                      </p>
                      {f.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {f.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          或直接輸入場域網址：game.homi.cc/f/<span className="font-mono">YOUR_CODE</span>
        </p>
      </div>
    </div>
  );
}
