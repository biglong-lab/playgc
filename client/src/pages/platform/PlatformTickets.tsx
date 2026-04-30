// 🎫 平台客服工單管理（P0-2）
//
// 用途：跨場域處理所有工單（場域申請、檢舉、客服詢問、計費問題）
// 設計：列表 + 抽屜詳情 + 對話留言
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Ticket,
  Search,
  Building2,
  AlertCircle,
  Send,
  User,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TicketRow {
  id: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  fieldId: string | null;
  assignedAdminId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  field: { id: string; name: string; code: string } | null;
  assignedAdmin: { id: string; username: string; displayName: string | null } | null;
}

interface TicketMessage {
  id: string;
  body: string;
  authorAdminId: string | null;
  authorIsSubmitter: string | null;
  authorName: string | null;
  internal: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null } | null;
}

interface TicketsListResponse {
  items: TicketRow[];
  total: number;
}

interface TicketsStats {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  total: number;
  openCount: number;
  urgentCount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  field_application: "場域申請",
  player_report: "玩家檢舉",
  support: "客服詢問",
  billing: "計費問題",
  bug_report: "錯誤回報",
  feature_request: "功能需求",
};

const STATUS_LABELS: Record<string, string> = {
  open: "新建",
  in_progress: "處理中",
  waiting: "等待回應",
  resolved: "已解決",
  closed: "已關閉",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary",
  high: "bg-amber-500 text-white",
  urgent: "bg-destructive text-white",
};

export default function PlatformTickets() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // 列表
  const { data: listData, isLoading } = useQuery<TicketsListResponse>({
    queryKey: ["/api/platform/tickets", statusFilter, categoryFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const url = `/api/platform/tickets?${params.toString()}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // 統計
  const { data: stats } = useQuery<TicketsStats>({
    queryKey: ["/api/platform/tickets/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/tickets/stats");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const tickets = listData?.items ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.submitterName || "").toLowerCase().includes(q) ||
        (t.submitterEmail || "").toLowerCase().includes(q) ||
        (t.field?.code || "").toLowerCase().includes(q),
    );
  }, [tickets, searchQuery]);

  return (
    <PlatformAdminLayout title="客服工單">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="總工單" value={stats?.total ?? 0} accent="text-primary" />
        <StatCard
          label="待處理"
          value={stats?.openCount ?? 0}
          accent="text-amber-500"
          icon={<AlertCircle className="w-4 h-4" />}
        />
        <StatCard
          label="緊急"
          value={stats?.urgentCount ?? 0}
          accent="text-destructive"
          icon={<AlertCircle className="w-4 h-4" />}
        />
        <StatCard
          label="處理中"
          value={stats?.byStatus?.in_progress ?? 0}
          accent="text-blue-500"
        />
        <StatCard
          label="已解決"
          value={stats?.byStatus?.resolved ?? 0}
          accent="text-emerald-500"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
      </div>

      {/* 篩選列 */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋標題 / 描述 / 提交者 / 場域代碼..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tickets"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分類</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部優先</SelectItem>
            <SelectItem value="urgent">緊急</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="normal">一般</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={tickets.length === 0 ? "尚無工單" : "沒有符合條件的工單"}
          description={
            tickets.length === 0 ? "目前沒有任何工單" : "試著清除篩選條件"
          }
        />
      ) : (
        <div className="space-y-2" data-testid="tickets-list">
          {filtered.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onClick={() => setSelectedTicketId(t.id)}
            />
          ))}
        </div>
      )}

      {/* 詳情 sheet */}
      {selectedTicketId && (
        <TicketDetailSheet
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/platform/tickets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/platform/tickets/stats"] });
          }}
        />
      )}
    </PlatformAdminLayout>
  );

  function TicketCard({ ticket, onClick }: { ticket: TicketRow; onClick: () => void }) {
    return (
      <Card className="hover-elevate cursor-pointer" onClick={onClick}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Badge className={PRIORITY_BADGE[ticket.priority] || "bg-muted"}>
              {ticket.priority}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{ticket.title}</span>
                <Badge variant="outline">{STATUS_LABELS[ticket.status] || ticket.status}</Badge>
                <Badge variant="secondary">{CATEGORY_LABELS[ticket.category] || ticket.category}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                {ticket.field && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {ticket.field.code}
                  </span>
                )}
                {ticket.submitterName && (
                  <>
                    <span>·</span>
                    <span>{ticket.submitterName}</span>
                  </>
                )}
                {ticket.assignedAdmin && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {ticket.assignedAdmin.displayName || ticket.assignedAdmin.username}
                    </span>
                  </>
                )}
                <span>·</span>
                <span className="tabular-nums">
                  {new Date(ticket.createdAt).toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
}

function TicketDetailSheet({
  ticketId,
  onClose,
  onUpdate,
}: {
  ticketId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [internal, setInternal] = useState(false);

  const { data, isLoading } = useQuery<{ ticket: TicketRow & { field: TicketRow["field"] }; messages: TicketMessage[] }>({
    queryKey: ["/api/platform/tickets", ticketId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/platform/tickets/${ticketId}`);
      return res.json();
    },
  });

  const updateTicket = useMutation({
    mutationFn: async (patch: Partial<TicketRow>) => {
      const res = await apiRequest("PATCH", `/api/platform/tickets/${ticketId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tickets", ticketId] });
      onUpdate();
      toast({ title: "✅ 工單已更新" });
    },
    onError: (err) => {
      toast({
        title: "更新失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const addMessage = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platform/tickets/${ticketId}/messages`, {
        body: newMessage,
        internal,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewMessage("");
      setInternal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tickets", ticketId] });
      onUpdate();
      toast({ title: "✅ 留言已送出" });
    },
    onError: (err) => {
      toast({
        title: "留言失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading || !data ? (
          <div className="py-8">
            <ListSkeleton count={3} />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={PRIORITY_BADGE[data.ticket.priority] || "bg-muted"}>
                  {data.ticket.priority}
                </Badge>
                <Badge variant="secondary">
                  {CATEGORY_LABELS[data.ticket.category] || data.ticket.category}
                </Badge>
              </div>
              <SheetTitle className="text-left">{data.ticket.title}</SheetTitle>
              <SheetDescription className="text-left">
                {data.ticket.field ? `${data.ticket.field.name}（${data.ticket.field.code}）· ` : ""}
                {data.ticket.submitterName ?? "（未填）"}
                {data.ticket.submitterEmail ? ` · ${data.ticket.submitterEmail}` : ""}
              </SheetDescription>
            </SheetHeader>

            {/* 狀態 / 優先度切換 */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div>
                <label className="text-xs text-muted-foreground">狀態</label>
                <Select
                  value={data.ticket.status}
                  onValueChange={(v) => updateTicket.mutate({ status: v as TicketRow["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">優先度</label>
                <Select
                  value={data.ticket.priority}
                  onValueChange={(v) => updateTicket.mutate({ priority: v as TicketRow["priority"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">緊急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="normal">一般</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 描述 */}
            {data.ticket.description && (
              <div className="mt-4 text-sm bg-muted/30 rounded p-3 leading-relaxed whitespace-pre-wrap">
                {data.ticket.description}
              </div>
            )}

            {/* 留言列表 */}
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">對話記錄（{data.messages.length}）</h4>
              {data.messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">尚無留言</p>
              ) : (
                <div className="space-y-2">
                  {data.messages.map((m) => (
                    <Card key={m.id} className={m.internal === "yes" ? "bg-amber-500/10 border-amber-500/30" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          {m.internal === "yes" && <Lock className="w-3 h-3 text-amber-500" />}
                          <span className="font-medium text-foreground">
                            {m.author?.displayName || m.author?.username || m.authorName || "（系統）"}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {new Date(m.createdAt).toLocaleString("zh-TW")}
                          </span>
                          {m.internal === "yes" && (
                            <Badge variant="outline" className="ml-auto text-amber-600 border-amber-500/40 text-[10px]">
                              內部
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 加留言 */}
            <div className="mt-4 space-y-2">
              <Textarea
                placeholder="輸入留言..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                data-testid="textarea-ticket-reply"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  內部留言（不對提交者顯示）
                </label>
                <Button
                  size="sm"
                  className="ml-auto gap-1"
                  disabled={!newMessage.trim() || addMessage.isPending}
                  onClick={() => addMessage.mutate()}
                  data-testid="btn-send-ticket-reply"
                >
                  <Send className="w-3.5 h-3.5" />
                  送出
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
