// 🎯 TemplateMarketDetail — 單一情境詳情頁
//
// 路徑：/template-market/:scenarioId
// 用途：完整介紹單一情境、列出元件、提供試玩入口、銷售 CTA

import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, CheckCircle, Tv, Smartphone, Zap, Copy, ExternalLink, Loader2, Printer, Wand2 } from "lucide-react";
import { getScenarioById, type ScenarioComponent } from "@shared/scenario-templates";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface ScenarioInstance {
  axis: "host" | "multi" | "solo" | "shared";
  gameId: string;
  pageType: string;
  label: string;
  role: string;
  // host 才有
  sessionId?: string;
  hostUrl?: string;
  playUrl?: string;
  hostToken?: string;
  // multi/solo/shared 才有
  gameUrl?: string;
  publicSlug?: string;
}

interface InstantiateResponse {
  scenario: { id: string; name: string; tagline: string };
  displayName: string;
  expiresAt: string;
  instances: ScenarioInstance[];
  totalCreated: number;
  breakdown: { host: number; multi: number; other: number };
}

interface AiPreviewResponse {
  scenario: { id: string; name: string; tagline: string };
  context: string;
  configs: Record<string, Record<string, unknown>>;
  rationale: string;
  components: Array<{ pageType: string; label: string; role: string; axis: string; hasAiConfig: boolean }>;
}

export default function TemplateMarketDetail() {
  const [, params] = useRoute("/template-market/:scenarioId");
  const [, navigate] = useLocation();
  // 公開銷售頁：未登入訪客也要能看詳情，不可被 useAdminAuth 預設導向 /admin/login
  const { admin } = useAdminAuth({ redirectTo: "" });
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<InstantiateResponse | null>(null);
  // 🆕 D2-c (2026-05-07)：dialog 關閉時 launchResult 不清掉、admin 可重開「再列印 / 看 URL」
  const [dialogOpen, setDialogOpen] = useState(false);

  // W9 D2: AI 預覽 state
  const [aiContext, setAiContext] = useState("");
  const [aiPreviewing, setAiPreviewing] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreviewResponse | null>(null);

  const scenarioId = params?.scenarioId;
  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;

  const handleAiPreview = async () => {
    if (!scenarioId) return;
    const trimmed = aiContext.trim();
    if (!trimmed) {
      toast({ title: "請輸入活動描述", variant: "destructive" });
      return;
    }
    setAiPreviewing(true);
    try {
      const res = await apiRequest("POST", `/api/admin/scenarios/${scenarioId}/ai-preview`, {
        context: trimmed,
      });
      const data: AiPreviewResponse = await res.json();
      setAiPreview(data);
      toast({ title: "✅ AI 內容已生成", description: `${Object.keys(data.configs).length} 個元件已客製` });
    } catch (err) {
      toast({
        title: "❌ AI 預覽失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setAiPreviewing(false);
    }
  };

  const handleLaunchWithAi = async () => {
    if (!scenarioId || !aiPreview) return;
    setLaunching(true);
    try {
      const res = await apiRequest("POST", `/api/admin/scenarios/${scenarioId}/instantiate`, {
        aiConfigs: aiPreview.configs,
        displayName: aiContext.slice(0, 100),
      });
      const data: InstantiateResponse = await res.json();
      setLaunchResult(data);
      setDialogOpen(true);
      setAiPreview(null);
      toast({
        title: "✅ 用 AI 內容建場成功",
        description: `已建立 ${data.totalCreated} 個元件、視窗已開啟。請複製 URL 給玩家或點「列印 QR」`,
      });
    } catch (err) {
      toast({
        title: "❌ 建場失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  const handleLaunch = async () => {
    if (!scenarioId) return;
    setLaunching(true);
    try {
      const res = await apiRequest("POST", `/api/admin/scenarios/${scenarioId}/instantiate`, {});
      const data: InstantiateResponse = await res.json();
      setLaunchResult(data);
      setDialogOpen(true);
      toast({
        title: "✅ 建場成功！",
        description: `已建立 ${data.totalCreated} 個元件、視窗已開啟。請複製 URL 給玩家或點「列印 QR」`,
      });
    } catch (err) {
      toast({
        title: "❌ 建立失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold">情境不存在</h1>
          <p className="text-sm text-muted-foreground">
            找不到 ID 為 {scenarioId} 的情境模板
          </p>
          <Link href="/template-market">
            <Button>回情境模板市集</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-muted rounded-lg"
              onClick={() => navigate("/template-market")}
              data-testid="btn-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display font-bold text-lg" data-testid="text-scenario-name">
                {scenario.name}
              </h1>
              <p className="text-xs text-muted-foreground">{scenario.tagline}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Hero */}
        <Card className={`bg-gradient-to-br ${scenario.gradient} border-0`}>
          <CardContent className="p-6 md:p-8 space-y-4">
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              {scenario.name}
            </h2>
            <p className="text-base md:text-lg whitespace-pre-line leading-relaxed">
              {scenario.description}
            </p>
            <div className="flex gap-2 pt-2 flex-wrap">
              <Badge variant="secondary">👥 {scenario.estimatedPlayers}</Badge>
              <Badge variant="secondary">⏱ {scenario.estimatedDuration}</Badge>
              <Badge
                variant="secondary"
                data-testid={`badge-status-${scenario.status}`}
              >
                {scenario.status === "live"
                  ? "✅ 可用"
                  : scenario.status === "preview"
                    ? "👀 預覽"
                    : "🚧 規劃中"}
              </Badge>
              {/* 🔑 登入需求標示：全 host = 免登入掃碼即玩；含 multi = 部分需組隊登入 */}
              <Badge
                variant="secondary"
                data-testid="badge-login-mode"
                className={
                  scenario.components.every((c) => c.axis === "host")
                    ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                }
              >
                {scenario.components.every((c) => c.axis === "host")
                  ? "🟢 全程免登入（掃 QR 即玩）"
                  : "🔑 含需登入組隊元件"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 適用情境 */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-lg">📍 適用情境</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {scenario.useCases.map((useCase, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-lg bg-card border"
                data-testid={`use-case-${i}`}
              >
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">{useCase}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 元件組合 — 🔧 2026-07-05 UX：扁平清單升級為「活動流程」時間軸
            （編號 + 連接線，一眼看懂一場活動先做什麼、再做什麼）*/}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-lg">
            🧩 活動流程（{scenario.components.length} 個環節）
          </h3>
          <div className="relative">
            {scenario.components.map((component, idx) => (
              <ComponentRow
                key={component.pageType}
                component={component}
                stepNumber={idx + 1}
                isLast={idx === scenario.components.length - 1}
              />
            ))}
          </div>
        </section>

        {/* 商業價值 */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 space-y-2">
            <h3 className="font-display font-bold flex items-center gap-2">
              💼 商業價值
            </h3>
            <p className="text-sm leading-relaxed">{scenario.valueProposition}</p>
          </CardContent>
        </Card>

        {/* W9 D2: AI 客製化內容（admin only）*/}
        {admin && (
          <Card className="bg-purple-500/10 border-purple-500/30">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  AI 客製化內容（選用）
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  輸入活動描述，AI 會為每個元件生成客製化內容（取代範例 default）
                </p>
              </div>
              <textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value.slice(0, 500))}
                placeholder="例如：Hung & Anita 5/15 晶華婚禮、新郎新娘都喜歡音樂、賓客約 100 人"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm min-h-[80px]"
                maxLength={500}
                data-testid="input-ai-context"
              />
              <div className="text-xs text-muted-foreground text-right">{aiContext.length}/500</div>
              <Button
                onClick={handleAiPreview}
                disabled={aiPreviewing || !aiContext.trim()}
                variant="outline"
                className="w-full border-purple-500/50"
                data-testid="btn-ai-preview"
              >
                {aiPreviewing ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />AI 思考中...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-1" />預覽 AI 客製內容</>
                )}
              </Button>

              {aiPreview && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="bg-card rounded-lg p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">💡 AI 思考</div>
                    <div className="text-sm">{aiPreview.rationale}</div>
                  </div>
                  <div className="bg-card rounded-lg p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">📦 客製化結果</div>
                    {aiPreview.components.map((c) => (
                      <div key={c.pageType} className="flex items-center gap-2 text-sm">
                        {c.hasAiConfig ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-amber-500 flex-shrink-0">⚠</span>
                        )}
                        <span className="font-medium">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{c.pageType}</span>
                      </div>
                    ))}
                  </div>
                  <details className="bg-card rounded-lg p-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      📄 看完整 JSON（debug）
                    </summary>
                    <pre className="text-xs mt-2 overflow-auto bg-muted p-2 rounded max-h-60">
                      {JSON.stringify(aiPreview.configs, null, 2)}
                    </pre>
                  </details>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setAiPreview(null)}
                      variant="ghost"
                      className="flex-1"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleLaunchWithAi}
                      disabled={launching}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      data-testid="btn-launch-with-ai"
                    >
                      {launching ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" />建場中...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-1" />用 AI 內容建場</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin 一鍵建場（W6 D2 + D3 含混合情境）*/}
        {/* 🆕 D2-c (2026-05-07)：未登入也顯示同樣 Card 但 disabled，讓使用者一眼知道「就在這裡可建場、要先登入」 */}
        <Card className={admin ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}>
          <CardContent className="p-6 space-y-3 text-center">
            <h3 className="font-display font-bold text-lg flex items-center justify-center gap-2">
              <Zap className={`w-5 h-5 ${admin ? "text-emerald-600" : "text-amber-600"}`} />
              {admin ? "Admin 一鍵建場（用 default 內容）" : "一鍵建場（需 Admin 登入）"}
            </h3>
            <p className="text-sm text-muted-foreground">
              為這個情境的 {scenario.components.length} 個元件，一次建好所有 game + 場次。<br />
              <span className="text-xs">不用 AI、用 default 範例 — 適合快速 demo 或 admin 自己改內容</span>
            </p>
            {admin ? (
              <Button
                size="lg"
                onClick={handleLaunch}
                disabled={launching}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-launch-scenario"
              >
                {launching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    立即建立 {scenario.components.length} 個元件實例
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button size="lg" disabled className="bg-amber-600">
                  <Zap className="w-4 h-4 mr-1" />
                  立即建立 {scenario.components.length} 個元件實例（需先登入）
                </Button>
                <div>
                  <Link href="/admin/login">
                    <Button variant="outline" className="border-amber-500" data-testid="btn-go-admin-login">
                      🔐 前往 Admin 登入
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 🆕 D2-c：建場完成後保留「再次查看」按鈕，避免關 dialog 後找不到 URL */}
            {admin && launchResult && !dialogOpen && (
              <div className="pt-2 border-t border-emerald-500/20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  data-testid="btn-reopen-launch-result"
                  className="border-emerald-500/50"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  再次查看上次建場結果（URLs / 列印 QR）
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA */}
        <section className="text-center space-y-4 py-6">
          <h3 className="font-display font-bold text-lg">看好了？開始建一個</h3>
          <p className="text-sm text-muted-foreground">
            上方一鍵建場（admin 限定）為跨軸線情境一次建好所有元件實例，或下方手動操作既有後台
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/showcase">
              <Button variant="outline" data-testid="btn-try-components">
                <Smartphone className="w-4 h-4 mr-1" />
                先試玩元件
              </Button>
            </Link>
            <Link href="/admin/host-sessions">
              <Button data-testid="btn-create-host-session">
                <Tv className="w-4 h-4 mr-1" />
                手動建大螢幕場次
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* 一鍵建場結果 Dialog */}
      {/* 🆕 D2-c (2026-05-07)：dialog 關閉只 hide、launchResult 不清掉、admin 可重開 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ✅ {launchResult?.scenario.name} 已建立
            </DialogTitle>
          </DialogHeader>
          {launchResult && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  建立了 <span className="font-bold text-foreground">{launchResult.totalCreated}</span> 個元件實例
                </div>
                <div className="flex gap-2 flex-wrap">
                  {launchResult.breakdown.host > 0 && (
                    <Badge variant="outline">📺 大螢幕 × {launchResult.breakdown.host}</Badge>
                  )}
                  {launchResult.breakdown.multi > 0 && (
                    <Badge variant="outline">👥 隊伍 × {launchResult.breakdown.multi}</Badge>
                  )}
                  {launchResult.breakdown.other > 0 && (
                    <Badge variant="outline">👤 其他 × {launchResult.breakdown.other}</Badge>
                  )}
                </div>
                <div className="text-xs">
                  hostToken {new Date(launchResult.expiresAt).toLocaleString("zh-TW")} 前有效
                </div>
              </div>
              <div className="space-y-2">
                {launchResult.instances.map((inst) => (
                  <InstanceRow key={inst.sessionId} instance={inst} />
                ))}
              </div>
              <div className="flex justify-between pt-4 border-t flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  關閉（資料保留、可再次查看）
                </Button>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => openPrintPage(launchResult)}
                    data-testid="btn-print-qr"
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    列印 QR
                  </Button>
                  <Button
                    onClick={() => navigate("/admin/host-sessions")}
                    data-testid="btn-go-host-sessions"
                  >
                    到管理後台 <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function openPrintPage(result: InstantiateResponse) {
  const printData = {
    displayName: result.displayName,
    expiresAt: result.expiresAt,
    instances: result.instances.map((i) => ({
      axis: i.axis,
      label: i.label,
      pageType: i.pageType,
      role: i.role,
      hostUrl: i.hostUrl,
      playUrl: i.playUrl,
      gameUrl: i.gameUrl,
    })),
  };
  const json = JSON.stringify(printData);
  // base64 encode（含中文）
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const encoded = encodeURIComponent(base64);
  window.open(`/admin/scenario-qr-print?data=${encoded}`, "_blank");
}

function InstanceRow({ instance }: { instance: ScenarioInstance }) {
  // 🆕 D2-c (2026-05-07)：複製 fallback — Safari/HTTP 環境 navigator.clipboard 不穩
  // 失敗時用 document.execCommand 備援，再失敗則顯示明文供手動複製
  const handleCopy = async (url: string, label: string) => {
    // 嘗試 navigator.clipboard（HTTPS + 現代瀏覽器）
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: `✅ 已複製 ${label} 網址` });
        return;
      } catch {
        // fall through 到 fallback
      }
    }
    // Fallback：document.execCommand("copy")（舊瀏覽器 / Safari / HTTP）
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        toast({ title: `✅ 已複製 ${label} 網址（fallback）` });
        return;
      }
    } catch {
      // fall through 到最終 fallback
    }
    // 最終：複製失敗，提示玩家手動複製
    toast({
      title: "❌ 自動複製失敗",
      description: `請手動長按下方網址複製：${url}`,
      variant: "destructive",
    });
  };

  const axisLabel = {
    host: { emoji: "📺", label: "大螢幕主控", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    multi: { emoji: "👥", label: "隊伍協作", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
    solo: { emoji: "👤", label: "個人闖關", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    shared: { emoji: "🧩", label: "通用元件", color: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400" },
  }[instance.axis];

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" data-testid={`instance-${instance.pageType}`}>
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="font-medium text-sm">{axisLabel.emoji} {instance.label}</div>
        <div className="flex items-center gap-1">
          <Badge className={`text-xs ${axisLabel.color}`}>{axisLabel.label}</Badge>
          <Badge variant="outline" className="text-xs">{instance.pageType}</Badge>
        </div>
      </div>
      <div className="space-y-1.5">
        {instance.axis === "host" && instance.hostUrl && instance.playUrl && (
          <>
            <UrlRow label="大螢幕" url={instance.hostUrl} onCopy={(u) => handleCopy(u, "大螢幕")} />
            <UrlRow label="玩家" url={instance.playUrl} onCopy={(u) => handleCopy(u, "玩家")} />
          </>
        )}
        {instance.axis !== "host" && instance.gameUrl && (
          <UrlRow label="玩家入口" url={instance.gameUrl} onCopy={(u) => handleCopy(u, "玩家")} />
        )}
      </div>
    </div>
  );
}

function UrlRow({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (full: string) => void;
}) {
  const fullUrl = `${window.location.origin}${url}`;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <code className="text-xs flex-1 truncate bg-muted px-2 py-1 rounded">{fullUrl}</code>
      <Button size="sm" variant="ghost" onClick={() => onCopy(fullUrl)}>
        <Copy className="w-3 h-3" />
      </Button>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="ghost">
          <ExternalLink className="w-3 h-3" />
        </Button>
      </a>
    </div>
  );
}

function ComponentRow({
  component,
  stepNumber,
  isLast,
}: {
  component: ScenarioComponent;
  stepNumber: number;
  isLast: boolean;
}) {
  const axisStyle = {
    host: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", label: "📺 大螢幕" },
    multi: { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", label: "👥 多人" },
    solo: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "👤 個人" },
    shared: { bg: "bg-zinc-500/10", text: "text-zinc-700 dark:text-zinc-400", label: "🧩 通用" },
  }[component.axis];

  return (
    <div className="flex gap-3" data-testid={`component-${component.pageType}`}>
      {/* 流程時間軸：編號圓點 + 連接線 */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
          {stepNumber}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
      </div>
      <div className={`flex items-start gap-3 p-3 rounded-lg bg-card border flex-1 min-w-0 ${isLast ? "" : "mb-2"}`}>
      <Badge className={`${axisStyle.bg} ${axisStyle.text} flex-shrink-0`}>
        {axisStyle.label}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
          {component.label}
          {/* host 軸線可匿名（掃 QR 即玩）；其他軸線需登入組隊 */}
          {component.axis === "host" ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              免登入
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
              需登入組隊
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{component.role}</div>
      </div>
      {component.demoMode && (
        <Link href={`/showcase?demo=${component.demoMode}`}>
          <Button size="sm" variant="ghost" className="text-xs flex-shrink-0">
            試玩
          </Button>
        </Link>
      )}
    </div>
  );
}
