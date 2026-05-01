// 🎓 AI 訓練中心 — SaaS 平台後台專區
//
// 4 個分頁（依使用者願景設計）：
//   1. 📊 用量總覽：今日 / 本月 AI 呼叫次數（按 endpoint / model / field）
//   2. 🧠 內容打磨：變體池健康度 + 一鍵批次補生成
//   3. 🖼  素材庫管理：連結到 P6 ExemplarLibrary
//   4. ⚙️  訓練設定：各 endpoint 模型 / fallback chain（唯讀預覽）
//
// 設計理念：admin 在這裡看見並打磨整個 AI 系統的狀態，讓平台越用越聰明
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Sparkles,
  ImageIcon,
  Settings,
  TrendingUp,
  Database,
  Zap,
  Loader2,
  RefreshCw,
  HeartPulse,
  AlertTriangle,
  Skull,
  Ghost,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UsageStats {
  totalCalls: number;
  byEndpoint: Record<string, number>;
  byProvider: Record<string, number>;
  cacheHitRate: number;
  variantPoolHitRate: number;
  estimatedCost: number;
}

interface HealthStats {
  totalPages: number;
  pagesWithVariantPool: number;
  pagesNeedingVariants: number;
  totalCacheRows: number;
  totalExemplars: number;
  curatedExemplars: number;
}

// P15-6: 內容健康度
interface HealthScore {
  score: number;
  level: "excellent" | "good" | "fair" | "poor" | "critical";
  breakdown: {
    totalPages: number;
    totalVariants: number;
    zombieCount: number;
    orphanCount: number;
    deadEndCount: number;
    deadEndHigh: number;
    deadEndMedium: number;
    deadEndLow: number;
    zombieRatio: number;
    orphanRatio: number;
    deadEndScore: number;
  };
  penalties: { zombie: number; orphan: number; deadEnd: number };
}

interface ZombieVariant {
  pageId: string;
  gameId: string | null;
  variantKey: string;
  variantIndex: number;
  variantText: string;
  daysOld: number;
}

interface OrphanTask {
  pageId: string;
  gameId: string;
  pageType: string;
  customName: string | null;
  pageOrder: number;
  daysOld: number;
  neverEntered: boolean;
}

interface DeadEndPage {
  pageId: string;
  gameId: string | null;
  enterCount: number;
  completeCount: number;
  exitCount: number;
  failCount: number;
  exitRate: number;
  completionRate: number;
  severity: "high" | "medium" | "low";
}

interface ContentHealthResponse {
  gameId: string | null;
  score: HealthScore;
  zombieVariants: ZombieVariant[];
  orphanTasks: OrphanTask[];
  deadEndPages: DeadEndPage[];
}

const HEALTH_LEVEL_LABEL: Record<string, string> = {
  excellent: "優秀",
  good: "健康",
  fair: "可接受",
  poor: "需改善",
  critical: "嚴重",
};

const HEALTH_LEVEL_COLOR: Record<string, string> = {
  excellent: "text-green-600",
  good: "text-blue-600",
  fair: "text-yellow-600",
  poor: "text-orange-600",
  critical: "text-red-600",
};

export default function PlatformAiCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { admin } = useAdminAuth();
  const isAuthed = !!admin;

  // 用量統計
  const { data: usage, isLoading: usageLoading } = useQuery<UsageStats>({
    queryKey: ["/api/platform/ai-center/usage"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/ai-center/usage");
      return res.json();
    },
    enabled: isAuthed,
  });

  // 健康度
  const { data: health, isLoading: healthLoading } = useQuery<HealthStats>({
    queryKey: ["/api/platform/ai-center/health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/ai-center/health");
      return res.json();
    },
    enabled: isAuthed,
  });

  // P15-6: 內容健康診斷
  const { data: contentHealth, isLoading: contentHealthLoading } =
    useQuery<ContentHealthResponse>({
      queryKey: ["/api/platform/ai-center/content-health"],
      queryFn: async () => {
        const res = await apiRequest(
          "GET",
          "/api/platform/ai-center/content-health",
        );
        return res.json();
      },
      enabled: isAuthed,
    });

  // 一鍵批次補生成
  // 🔧 limit=5 避免 Nginx 60s timeout（每個 page 約 8-15 秒呼叫 DeepSeek）
  const batchGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/platform/ai-center/batch-generate-variants",
        { limit: 5 },
      );
      return res.json();
    },
    onSuccess: (data: {
      generated: number;
      skipped: number;
      failed: number;
      skipReasons?: {
        noFieldId: number;
        fieldNotFound: number;
        noApiKey: number;
        notOpenRouter: number;
      };
    }) => {
      // 🔧 跳過原因細項提示（讓 admin 知道為什麼沒生成）
      let detail = `成功 ${data.generated} 個 / 跳過 ${data.skipped} / 失敗 ${data.failed}`;
      if (data.generated === 0 && data.skipped > 0 && data.skipReasons) {
        const r = data.skipReasons;
        const reasons: string[] = [];
        if (r.notOpenRouter > 0)
          reasons.push(`${r.notOpenRouter} 個非 OpenRouter key（變體生成需 sk-or-）`);
        if (r.noApiKey > 0) reasons.push(`${r.noApiKey} 個場域未設 API key`);
        if (r.fieldNotFound > 0) reasons.push(`${r.fieldNotFound} 個場域不存在`);
        if (r.noFieldId > 0) reasons.push(`${r.noFieldId} 個遊戲未綁場域`);
        if (reasons.length > 0) detail += `\n原因：${reasons.join(" / ")}`;
      }
      toast({
        title:
          data.generated > 0 ? "✨ 批次生成完成" : "ℹ️ 沒有可補生成的任務",
        description: detail,
        variant: data.generated === 0 && data.skipped > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/ai-center/health"] });
    },
    onError: (err: Error) => {
      toast({
        title: "❌ 批次生成失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <PlatformAdminLayout title="🎓 AI 訓練中心">
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          看見並打磨整個 AI 系統的狀態，讓平台越用越聰明 🌱
        </p>

        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="usage" data-testid="tab-usage">
              <Activity className="w-4 h-4 mr-1" />
              用量總覽
            </TabsTrigger>
            <TabsTrigger value="content" data-testid="tab-content">
              <Sparkles className="w-4 h-4 mr-1" />
              內容打磨
            </TabsTrigger>
            <TabsTrigger value="health-diag" data-testid="tab-health-diag">
              <HeartPulse className="w-4 h-4 mr-1" />
              健康診斷
            </TabsTrigger>
            <TabsTrigger value="exemplar" data-testid="tab-exemplar">
              <ImageIcon className="w-4 h-4 mr-1" />
              素材庫
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-1" />
              訓練設定
            </TabsTrigger>
          </TabsList>

          {/* === 1. 用量總覽 === */}
          <TabsContent value="usage" className="space-y-3 mt-4">
            {usageLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">本月總呼叫</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">{usage?.totalCalls ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Cache Hit 率</span>
                      </div>
                      <p className="text-2xl font-bold mt-1 text-green-600">
                        {usage ? `${(usage.cacheHitRate * 100).toFixed(1)}%` : "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground">變體池命中率</span>
                      </div>
                      <p className="text-2xl font-bold mt-1 text-purple-600">
                        {usage ? `${(usage.variantPoolHitRate * 100).toFixed(1)}%` : "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">本月成本（估）</span>
                      </div>
                      <p className="text-2xl font-bold mt-1 text-orange-600">
                        ${usage?.estimatedCost.toFixed(2) ?? "0.00"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">按 endpoint 分佈</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(usage?.byEndpoint ?? {}).map(([ep, count]) => (
                      <div key={ep} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">{ep}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                    {(!usage || Object.keys(usage.byEndpoint).length === 0) && (
                      <p className="text-xs text-muted-foreground">尚無紀錄</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">按 provider 分佈</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(usage?.byProvider ?? {}).map(([prov, count]) => (
                      <div key={prov} className="flex items-center justify-between text-sm">
                        <span>{prov}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* === 2. 內容打磨 === */}
          <TabsContent value="content" className="space-y-3 mt-4">
            {healthLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">總任務頁面</p>
                      <p className="text-2xl font-bold mt-1">{health?.totalPages ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">已有變體池</p>
                      <p className="text-2xl font-bold mt-1 text-green-600">
                        {health?.pagesWithVariantPool ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">需要補生成</p>
                      <p className="text-2xl font-bold mt-1 text-amber-600">
                        {health?.pagesNeedingVariants ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">⚡ 一鍵批次補生成</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      用 DeepSeek V3.2 為「需要補生成」的任務一次性補上變體池。
                      每次最多處理 <strong>5 個</strong>（避免 timeout，每個約 10-15 秒）。
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>
                        前置條件：場域需設定 <strong>OpenRouter API key</strong>（<code>sk-or-...</code>）
                        — 用 Gemini key（<code>AIza...</code>）的場域會被跳過。
                      </span>
                    </p>
                    <Button
                      onClick={() => batchGenerateMutation.mutate()}
                      disabled={
                        batchGenerateMutation.isPending ||
                        (health?.pagesNeedingVariants ?? 0) === 0
                      }
                      className="bg-gradient-to-r from-purple-500 to-pink-500"
                      data-testid="button-batch-generate"
                    >
                      {batchGenerateMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      ✨ 批次補生成（{health?.pagesNeedingVariants ?? 0} 個待處理）
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* === P15-6: 健康診斷 === */}
          <TabsContent value="health-diag" className="space-y-3 mt-4">
            {contentHealthLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !contentHealth ? (
              <p className="text-sm text-muted-foreground">無資料</p>
            ) : (
              <>
                {/* 綜合分數 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">綜合健康分數</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-3">
                      <span
                        className={`text-5xl font-bold ${HEALTH_LEVEL_COLOR[contentHealth.score.level]}`}
                        data-testid="health-score"
                      >
                        {contentHealth.score.score}
                      </span>
                      <Badge
                        variant="outline"
                        className={HEALTH_LEVEL_COLOR[contentHealth.score.level]}
                      >
                        {HEALTH_LEVEL_LABEL[contentHealth.score.level]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">殭屍扣分：</span>
                        <span className="font-medium">
                          -{contentHealth.score.penalties.zombie}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">孤兒扣分：</span>
                        <span className="font-medium">
                          -{contentHealth.score.penalties.orphan}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">死路扣分：</span>
                        <span className="font-medium">
                          -{contentHealth.score.penalties.deadEnd}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 4 個統計卡 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">總變體</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">
                        {contentHealth.score.breakdown.totalVariants}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Ghost className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground">殭屍變體</span>
                      </div>
                      <p
                        className="text-2xl font-bold mt-1 text-purple-600"
                        data-testid="zombie-count"
                      >
                        {contentHealth.zombieVariants.length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">孤兒任務</span>
                      </div>
                      <p
                        className="text-2xl font-bold mt-1 text-orange-600"
                        data-testid="orphan-count"
                      >
                        {contentHealth.orphanTasks.length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Skull className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">死路 page</span>
                      </div>
                      <p
                        className="text-2xl font-bold mt-1 text-red-600"
                        data-testid="dead-end-count"
                      >
                        {contentHealth.deadEndPages.length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 殭屍變體清單 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ghost className="w-4 h-4 text-purple-500" />
                      殭屍變體（從沒被選中過）
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                    {contentHealth.zombieVariants.length === 0 ? (
                      <p className="text-xs text-muted-foreground">無殭屍變體 🎉</p>
                    ) : (
                      contentHealth.zombieVariants.slice(0, 50).map((z, i) => (
                        <div
                          key={`${z.pageId}-${z.variantKey}-${z.variantIndex}-${i}`}
                          className="text-xs border-l-2 border-purple-300 pl-2 py-1"
                        >
                          <div className="font-mono text-muted-foreground">
                            {z.pageId.slice(0, 8)} · {z.variantKey}#{z.variantIndex} · {z.daysOld}d
                          </div>
                          <div className="truncate">{z.variantText}</div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 孤兒任務清單 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      孤兒任務(沒玩家完成過)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                    {contentHealth.orphanTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">無孤兒任務 🎉</p>
                    ) : (
                      contentHealth.orphanTasks.slice(0, 50).map((o) => (
                        <div
                          key={o.pageId}
                          className="text-xs border-l-2 border-orange-300 pl-2 py-1 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-muted-foreground">
                              {o.pageId.slice(0, 8)}
                            </span>
                            <span className="ml-2">{o.customName ?? o.pageType}</span>
                            <span className="ml-1 text-muted-foreground">
                              · 第{o.pageOrder}頁 · {o.daysOld}d
                            </span>
                          </div>
                          {o.neverEntered && (
                            <Badge variant="destructive" className="text-[10px]">
                              沒人進入
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 死路 page 清單 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Skull className="w-4 h-4 text-red-500" />
                      死路 page（玩家進去就退出）
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                    {contentHealth.deadEndPages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">無死路 page 🎉</p>
                    ) : (
                      contentHealth.deadEndPages.slice(0, 50).map((d) => (
                        <div
                          key={d.pageId}
                          className="text-xs border-l-2 border-red-300 pl-2 py-1 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-muted-foreground">
                              {d.pageId.slice(0, 8)}
                            </span>
                            <span className="ml-2">
                              {d.enterCount} 進入 / {d.completeCount} 完成
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              退出率 {(d.exitRate * 100).toFixed(0)}%
                            </span>
                          </div>
                          <Badge
                            variant={
                              d.severity === "high"
                                ? "destructive"
                                : d.severity === "medium"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {d.severity}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* === 3. 素材庫 === */}
          <TabsContent value="exemplar" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">總素材</p>
                    <p className="text-3xl font-bold">{health?.totalExemplars ?? 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">精選範本</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {health?.curatedExemplars ?? 0}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    素材庫管理在場域 admin 後台：
                  </p>
                  <Button asChild variant="outline">
                    <a href="/admin/exemplar-library" target="_blank" rel="noreferrer">
                      開啟場域素材庫 →
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === 4. 訓練設定 === */}
          <TabsContent value="settings" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">當前模型分工</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">📸 vision（即時）</p>
                    <p className="text-xs text-muted-foreground">verify-photo / compare-photos</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    meta-llama/llama-4-scout
                  </code>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">📝 text（即時）</p>
                    <p className="text-xs text-muted-foreground">score-text</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    mistralai/mistral-small-3.2-24b
                  </code>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">✨ variant-gen（離線）</p>
                    <p className="text-xs text-muted-foreground">變體池生成 / 文案優化</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">deepseek/deepseek-v3.2</code>
                </div>
                <div className="border-t pt-3 text-xs text-muted-foreground">
                  💡 模型設定在 <code>shared/schema/ai-models.ts</code>，下版可從 UI 直接調整
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlatformAdminLayout>
  );
}
