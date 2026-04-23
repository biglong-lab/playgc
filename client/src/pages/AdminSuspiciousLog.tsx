// 🛡️ 管理端：作弊 / 異常事件日誌
//
// 讓管理員看 client_events 裡可疑事件：
//   - Shooting 作弊（hit_rejected / final_score_mismatch / exceeds_shooting_sum / over_hard_cap）
//   - Camera 啟動失敗（影響體驗，不是作弊）
//   - Walkie 錯誤
//
// 功能：
//   1. 24h 總覽卡：警告數、錯誤數、影響 user 數
//   2. 篩選：category / severity / eventType / 時間範圍
//   3. 事件列表（分頁、含 context JSON 展開）
//   4. 常見作弊類型快捷篩選
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldAlert, AlertTriangle, Camera, Radio, Target,
  RefreshCw, ChevronDown, ChevronRight, User,
} from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ClientEvent {
  id: number;
  eventType: "error" | "info" | "milestone";
  category: string;
  code: string | null;
  message: string | null;
  severity: "critical" | "error" | "warning" | "info" | "debug" | null;
  context: Record<string, unknown> | null;
  userId: string | null;
  userAgent: string | null;
  url: string | null;
  createdAt: string;
}

interface StatsResponse {
  bySeverity: Array<{ severity: string; count: number }>;
  byCategory: Array<{ category: string; code: string | null; count: number }>;
  topErrors: Array<{ category: string; code: string | null; message: string | null; count: number; lastSeen: string }>;
  since: string;
}

const CHEAT_CODES = [
  "hit_rejected",                  // client-side 命中被拒
  "final_score_mismatch",          // client-side 總分與 hits 不一致
  "over_hard_cap",                 // server-side 超硬上限
  "exceeds_shooting_sum",          // server-side 超 shooting 真實值
  "invalid_score_type",
  "negative_score",
];

export default function AdminSuspiciousLog() {
  const { isAuthenticated } = useAdminAuth();
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"all" | "cheat">("cheat");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 統計
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["/api/admin/client-logs/stats"],
    queryFn: () => fetchWithAdminAuth("/api/admin/client-logs/stats"),
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  // 事件列表
  const { data: eventsData, isLoading, refetch } = useQuery<{ events: ClientEvent[] }>({
    queryKey: ["/api/admin/client-logs", category, severity, viewMode],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (category !== "all") params.set("category", category);
      if (severity !== "all") params.set("severity", severity);
      return fetchWithAdminAuth(`/api/admin/client-logs?${params.toString()}`);
    },
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  });

  const allEvents = eventsData?.events ?? [];

  // 作弊模式：只顯示已知作弊 code
  const filteredEvents = viewMode === "cheat"
    ? allEvents.filter((e) => e.code && CHEAT_CODES.includes(e.code))
    : allEvents;

  const cheatCount24h = (stats?.byCategory ?? [])
    .filter((c) => c.category === "shooting")
    .reduce((sum, c) => sum + c.count, 0);

  const warningCount = stats?.bySeverity.find((s) => s.severity === "warning")?.count ?? 0;
  const errorCount = stats?.bySeverity.find((s) => s.severity === "error")?.count ?? 0;
  const uniqueAffectedUsers = new Set(allEvents.filter((e) => e.userId).map((e) => e.userId)).size;

  const getSeverityBadge = (sev: ClientEvent["severity"]) => {
    switch (sev) {
      case "critical":
        return <Badge className="bg-destructive">🚨 嚴重</Badge>;
      case "error":
        return <Badge variant="destructive">錯誤</Badge>;
      case "warning":
        return <Badge className="bg-amber-500 hover:bg-amber-500/90">⚠️ 警告</Badge>;
      case "info":
        return <Badge variant="secondary">資訊</Badge>;
      default:
        return <Badge variant="outline">{sev || "未知"}</Badge>;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "shooting": return <Target className="w-4 h-4 text-red-500" />;
      case "camera": return <Camera className="w-4 h-4 text-blue-500" />;
      case "walkie": return <Radio className="w-4 h-4 text-emerald-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCheatLabel = (code: string | null): string | null => {
    const map: Record<string, string> = {
      hit_rejected: "🛑 Client 攔下異常命中",
      final_score_mismatch: "🔴 總分與命中不一致",
      over_hard_cap: "🚨 超過單場硬上限（10000）",
      exceeds_shooting_sum: "⚠️ 分數遠超真實命中",
      invalid_score_type: "❌ 分數型別錯誤",
      negative_score: "❌ 負分",
    };
    return code ? map[code] ?? null : null;
  };

  return (
    <UnifiedAdminLayout
      title="🛡️ 作弊 / 異常監控"
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="w-4 h-4" />
          重新整理
        </Button>
      }
    >
      <div className="p-6 space-y-6">
        {/* 24h 總覽 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<ShieldAlert className="w-5 h-5" />}
            label="Shooting 作弊嘗試"
            value={cheatCount24h}
            suffix="次"
            color="bg-red-500"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="警告事件"
            value={warningCount}
            suffix="次"
            color="bg-amber-500"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="錯誤事件"
            value={errorCount}
            suffix="次"
            color="bg-destructive"
          />
          <StatCard
            icon={<User className="w-5 h-5" />}
            label="影響玩家"
            value={uniqueAffectedUsers}
            suffix="人"
            color="bg-indigo-500"
          />
        </div>

        {/* 模式切換 */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "cheat")}>
          <TabsList>
            <TabsTrigger value="cheat">🛡️ 作弊嫌疑</TabsTrigger>
            <TabsTrigger value="all">全部事件</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 篩選 */}
        {viewMode === "all" && (
          <div className="flex flex-wrap gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                <SelectItem value="shooting">Shooting</SelectItem>
                <SelectItem value="camera">相機</SelectItem>
                <SelectItem value="walkie">對講機</SelectItem>
                <SelectItem value="game">遊戲流程</SelectItem>
                <SelectItem value="api">API 錯誤</SelectItem>
                <SelectItem value="uncaught">未捕獲</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部嚴重度</SelectItem>
                <SelectItem value="critical">🚨 嚴重</SelectItem>
                <SelectItem value="error">錯誤</SelectItem>
                <SelectItem value="warning">⚠️ 警告</SelectItem>
                <SelectItem value="info">資訊</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 事件列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {viewMode === "cheat" ? "作弊嫌疑事件" : "所有事件"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredEvents.length} 筆)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground py-8">載入中...</p>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <ShieldAlert className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {viewMode === "cheat"
                    ? "目前沒有作弊嫌疑事件 👍"
                    : "目前沒有符合條件的事件"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((event) => {
                  const isExpanded = expandedId === event.id;
                  const cheatLabel = getCheatLabel(event.code);
                  return (
                    <div
                      key={event.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                        className="w-full flex items-start gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                      >
                        <div className="shrink-0 mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {getCategoryIcon(event.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {getSeverityBadge(event.severity)}
                            <span className="text-sm font-medium">
                              {cheatLabel || event.code || event.category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.createdAt), {
                                addSuffix: true,
                                locale: zhTW,
                              })}
                            </span>
                          </div>
                          {event.message && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {event.message}
                            </p>
                          )}
                          {event.userId && (
                            <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                              user: {event.userId.slice(0, 12)}...
                            </p>
                          )}
                        </div>
                      </button>

                      {/* 展開的 context 詳情 */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                          <div className="text-xs space-y-2">
                            <InfoRow label="時間" value={new Date(event.createdAt).toLocaleString("zh-TW")} />
                            <InfoRow label="分類" value={event.category} />
                            <InfoRow label="Code" value={<span className="font-mono">{event.code || "—"}</span>} />
                            <InfoRow label="嚴重度" value={event.severity || "—"} />
                            {event.url && <InfoRow label="URL" value={<span className="font-mono text-[10px]">{event.url}</span>} />}
                            {event.userAgent && (
                              <InfoRow
                                label="User Agent"
                                value={<span className="font-mono text-[10px] break-all">{event.userAgent.slice(0, 80)}...</span>}
                              />
                            )}
                            {event.context && Object.keys(event.context).length > 0 && (
                              <div>
                                <div className="text-muted-foreground mb-1">Context:</div>
                                <pre className="bg-card border rounded p-2 text-[10px] overflow-x-auto max-h-40 overflow-y-auto">
                                  {JSON.stringify(event.context, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 事件說明卡 */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">🔍 事件類型說明</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1 text-muted-foreground">
            <div><strong className="text-foreground">hit_rejected</strong>：Client-side 防線擋下異常命中（太快 / 分數過高 / 超次數）</div>
            <div><strong className="text-foreground">final_score_mismatch</strong>：玩家 state.totalScore 與實際 hits 總和不一致（可能 devtools 改過）</div>
            <div><strong className="text-foreground">over_hard_cap</strong>：Server 端擋下單場分數超 10000 的送單</div>
            <div><strong className="text-foreground">exceeds_shooting_sum</strong>：Client 送的分數遠超真實 shooting_records 總和</div>
            <div className="pt-2 text-[11px] opacity-70">
              💡 單次事件不代表作弊；持續多次或短時間內大量警告才需關注。可依 userId 找出特定玩家的異常模式。
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

// 子元件

function StatCard({
  icon, label, value, suffix, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {value}
              <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-20">{label}</span>
      <span className="flex-1 min-w-0">{value}</span>
    </div>
  );
}
