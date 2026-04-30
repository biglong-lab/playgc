// 🪄 AI 遊戲腳本產生器 admin UI
//
// 流程：
//   1. admin 寫腳本（自然語言）
//   2. 點「✨ 生成」→ DeepSeek 解析 → 預覽 pages
//   3. admin 微調或重新生成
//   4. 點「🚀 套用」→ INSERT 到指定遊戲
//
// 用法：admin 從遊戲詳情頁帶 ?gameId=... 進入
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Wand2,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneratedPage {
  pageOrder: number;
  pageType: string;
  customName?: string;
  config: Record<string, unknown>;
}

interface GeneratedGame {
  pages: GeneratedPage[];
  estimatedDuration?: number;
  difficulty?: "easy" | "medium" | "hard";
  summary?: string;
  fieldId?: string;
}

const SAMPLE_SCRIPT = `玩家從廟口出發，先聽一段歷史介紹，
然後找到 3 個古蹟拍照打卡，
最後在最後一個古蹟回答一個關於歷史的問題，
答對得寶藏鑰匙作為紀念。`;

export default function GameGenerator() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // 從 URL 取 gameId
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId") || "";

  // 表單狀態
  const [script, setScript] = useState("");
  const [fieldStyle, setFieldStyle] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // 生成結果
  const [generated, setGenerated] = useState<GeneratedGame | null>(null);

  // 套用設定
  const [replace, setReplace] = useState(false);

  // 生成 mutation
  const generateMutation = useMutation({
    mutationFn: async (): Promise<GeneratedGame> => {
      const res = await apiRequest("POST", "/api/admin/games/generate-from-script", {
        script,
        gameId,
        fieldStyle: fieldStyle || undefined,
        targetMinutes,
        difficulty,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGenerated(data);
      toast({
        title: "✨ 生成完成",
        description: `共 ${data.pages.length} 頁 | 預估 ${data.estimatedDuration ?? "?"} 分鐘`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "❌ 生成失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 套用 mutation
  const applyMutation = useMutation({
    mutationFn: async (): Promise<{ pagesAdded: number }> => {
      if (!generated) throw new Error("尚未生成");
      const res = await apiRequest(
        "POST",
        `/api/admin/games/${gameId}/apply-generated`,
        { pages: generated.pages, replace },
      );
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🚀 已套用到遊戲",
        description: `新增 ${data.pagesAdded} 頁，正在跳轉到遊戲編輯器...`,
      });
      setTimeout(() => {
        setLocation(`/admin/games/${gameId}`);
      }, 1500);
    },
    onError: (err: Error) => {
      toast({
        title: "❌ 套用失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 移除單頁（admin 微調）
  const removePage = (idx: number) => {
    if (!generated) return;
    setGenerated({
      ...generated,
      pages: generated.pages.filter((_, i) => i !== idx),
    });
  };

  if (!gameId) {
    return (
      <UnifiedAdminLayout title="✨ AI 遊戲產生器">
        <Card className="m-4">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
            <h3 className="font-semibold mb-2">缺少遊戲 ID</h3>
            <p className="text-sm text-muted-foreground mb-4">
              請從遊戲詳情頁進入 AI 產生器（URL 需含 ?gameId=...）
            </p>
            <Button variant="outline" onClick={() => setLocation("/admin/games")}>
              前往遊戲列表
            </Button>
          </CardContent>
        </Card>
      </UnifiedAdminLayout>
    );
  }

  return (
    <UnifiedAdminLayout title="✨ AI 遊戲產生器">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* 說明 */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">寫一段腳本，AI 自動組裝完整遊戲</p>
                <p className="text-muted-foreground mt-1">
                  支援 23 種模組（拍照 / 答題 / GPS / 射擊 / 對話等）。
                  AI 會挑合適的 page type 並填入合理 config，admin 預覽後可微調發布。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 1. 腳本輸入 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-500" />
              1. 描述你的遊戲腳本
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={SAMPLE_SCRIPT}
              rows={6}
              className="font-mono text-sm"
              data-testid="textarea-script"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{script.length} / 2000 字（最少 20 字）</span>
              {script.length === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setScript(SAMPLE_SCRIPT)}
                  data-testid="button-sample"
                >
                  使用範例
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <label className="text-xs font-medium mb-1 block">場域風格</label>
                <Input
                  value={fieldStyle}
                  onChange={(e) => setFieldStyle(e.target.value)}
                  placeholder="戰術 + 歷史"
                  data-testid="input-style"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">時長（分鐘）</label>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 30)}
                  data-testid="input-minutes"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">難度</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  data-testid="select-difficulty"
                >
                  <option value="easy">🟢 簡單</option>
                  <option value="medium">🟡 中等</option>
                  <option value="hard">🔴 困難</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || script.length < 20}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  AI 正在解析腳本... (約 10-30 秒)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  ✨ 生成遊戲流程
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. 預覽 */}
        {generated && (
          <Card data-testid="preview-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  2. 預覽（{generated.pages.length} 頁）
                </span>
                <div className="flex gap-2">
                  {generated.estimatedDuration && (
                    <Badge variant="outline">⏱ {generated.estimatedDuration} 分鐘</Badge>
                  )}
                  {generated.difficulty && (
                    <Badge>
                      {generated.difficulty === "easy"
                        ? "🟢 簡單"
                        : generated.difficulty === "medium"
                        ? "🟡 中等"
                        : "🔴 困難"}
                    </Badge>
                  )}
                </div>
              </CardTitle>
              {generated.summary && (
                <p className="text-sm text-muted-foreground italic">{generated.summary}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {generated.pages.map((page, idx) => (
                <Card key={idx} className="border-l-4 border-l-purple-300">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            #{page.pageOrder}
                          </Badge>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {page.pageType}
                          </code>
                          {page.customName && (
                            <span className="text-sm font-medium truncate">
                              {page.customName}
                            </span>
                          )}
                        </div>
                        {/* config 摘要：取 title / instruction / question 等常見欄位 */}
                        {(() => {
                          const cfg = page.config as Record<string, unknown>;
                          const summary =
                            (cfg.title as string) ||
                            (cfg.instruction as string) ||
                            (cfg.question as string) ||
                            (cfg.content as string)?.substring(0, 80) ||
                            "（無摘要）";
                          return (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {summary}
                            </p>
                          );
                        })()}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePage(idx)}
                        className="h-7 px-2 text-destructive"
                        data-testid={`button-remove-${idx}`}
                      >
                        移除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 3. 套用 */}
        {generated && generated.pages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className="w-4 h-4 text-blue-500" />
                3. 套用到遊戲
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="text-sm font-medium">清空既有頁面</p>
                  <p className="text-xs text-muted-foreground">
                    開啟 = 取代既有 pages（破壞性，需謹慎）
                    <br />
                    關閉 = append 到既有最後一頁之後
                  </p>
                </div>
                <Switch
                  checked={replace}
                  onCheckedChange={setReplace}
                  data-testid="switch-replace"
                />
              </div>

              {replace && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs">
                  ⚠️ 此操作會刪除遊戲現有所有 pages，請確認已備份。
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  重新生成
                </Button>
                <Button
                  onClick={() => applyMutation.mutate()}
                  disabled={applyMutation.isPending || generated.pages.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
                  data-testid="button-apply"
                >
                  {applyMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      套用中...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      🚀 套用 {generated.pages.length} 頁到遊戲
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}
