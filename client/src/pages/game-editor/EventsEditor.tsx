// 遊戲事件編輯器
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Save, Zap, AlertTriangle } from "lucide-react";
import type { Page } from "@shared/schema";
import { EVENT_TYPES, REWARD_TYPES, getPageTypeInfo } from "./constants";
import type { GameEvent } from "./types";

interface EventsEditorProps {
  gameId: string;
  pages: Page[];
  apiGamesPath: string;
  apiEventsPath: string;
}

export default function EventsEditor({ gameId, pages, apiGamesPath, apiEventsPath }: EventsEditorProps) {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<GameEvent>>>({});

  const { data: events = [], isLoading } = useQuery<GameEvent[]>({
    queryKey: [apiGamesPath, gameId, 'events'],
    enabled: !!gameId && gameId !== "new",
  });

  const createEventMutation = useMutation({
    mutationFn: async (event: Omit<GameEvent, "id">) => {
      const res = await apiRequest("POST", `${apiGamesPath}/${gameId}/events`, event);
      return res.json();
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      setSelectedEvent(newEvent);
      toast({ title: "已新增事件" });
    },
    onError: () => {
      toast({ title: "新增失敗", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiEventsPath}/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      if (selectedEvent?.id === deletedId) {
        setSelectedEvent(null);
      }
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      toast({ title: "已刪除事件" });
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GameEvent> }) => {
      const res = await apiRequest("PATCH", `${apiEventsPath}/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[updatedEvent.id];
        return next;
      });
      setSelectedEvent(updatedEvent);
      toast({ title: "已儲存事件" });
    },
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
    },
  });

  const addEvent = () => {
    createEventMutation.mutate({
      name: "新事件",
      eventType: "qrcode",
      triggerConfig: { qrCodeId: "" },
      rewardConfig: { type: "points", value: 10 },
    });
  };

  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    setLocalEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
    if (selectedEvent?.id === id) {
      setSelectedEvent({ ...selectedEvent, ...updates });
    }
  };

  const deleteEvent = (id: string) => {
    deleteEventMutation.mutate(id);
  };

  const getEventWithEdits = (event: GameEvent): GameEvent => {
    const edits = localEdits[event.id];
    return edits ? { ...event, ...edits } : event;
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];
  };

  if (gameId === "new") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>請先儲存遊戲後再新增事件</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              事件列表
            </CardTitle>
            <Button
              size="sm"
              onClick={addEvent}
              disabled={createEventMutation.isPending}
              data-testid="button-add-event"
            >
              <Plus className="w-4 h-4 mr-1" />
              {createEventMutation.isPending ? "新增中..." : "新增事件"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">載入中...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">尚未建立任何事件</p>
                <p className="text-xs mt-1">事件可在特定條件下觸發獎勵或頁面跳轉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const displayEvent = getEventWithEdits(event);
                  const typeInfo = getEventTypeInfo(displayEvent.eventType);
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEvent?.id === event.id
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-accent/30 hover:bg-accent"
                      }`}
                      onClick={() => setSelectedEvent(displayEvent)}
                      data-testid={`event-item-${event.id}`}
                    >
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                        <typeInfo.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{displayEvent.name}</p>
                        <p className="text-xs text-muted-foreground">{typeInfo.label}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }}
                        disabled={deleteEventMutation.isPending}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        {selectedEvent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">編輯事件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">事件名稱</label>
                <Input
                  value={selectedEvent.name}
                  onChange={(e) => updateEvent(selectedEvent.id, { name: e.target.value })}
                  placeholder="輸入事件名稱"
                  data-testid="input-event-name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">觸發類型</label>
                <Select
                  value={selectedEvent.eventType}
                  onValueChange={(value) => {
                    let triggerConfig = {};
                    switch (value) {
                      case "qrcode":
                        triggerConfig = { qrCodeId: "" };
                        break;
                      case "gps":
                        triggerConfig = { lat: 25.033, lng: 121.565, radius: 50 };
                        break;
                      case "shooting":
                        triggerConfig = { minScore: 100 };
                        break;
                      case "timer":
                        triggerConfig = { delaySeconds: 60 };
                        break;
                    }
                    updateEvent(selectedEvent.id, { eventType: value, triggerConfig });
                  }}
                >
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-accent/30 rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium block">觸發條件設定</label>
                <TriggerConfigEditor
                  eventType={selectedEvent.eventType}
                  config={selectedEvent.triggerConfig}
                  onChange={(triggerConfig) => updateEvent(selectedEvent.id, { triggerConfig })}
                />
              </div>

              <div className="bg-accent/30 rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium block">獎勵設定</label>
                <RewardConfigEditor
                  config={selectedEvent.rewardConfig}
                  pages={pages}
                  onChange={(rewardConfig) => updateEvent(selectedEvent.id, { rewardConfig })}
                />
              </div>

              {localEdits[selectedEvent.id] && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const edits = localEdits[selectedEvent.id];
                    if (edits) {
                      updateEventMutation.mutate({
                        id: selectedEvent.id,
                        data: edits
                      });
                    }
                  }}
                  disabled={updateEventMutation.isPending}
                  data-testid="button-save-event"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateEventMutation.isPending ? "儲存中..." : "儲存事件"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>選擇一個事件進行編輯</p>
              <p className="text-sm mt-1">或點擊「新增事件」建立新事件</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TriggerConfigEditor({
  eventType,
  config,
  onChange
}: {
  eventType: string;
  config: any;
  onChange: (config: any) => void;
}) {
  switch (eventType) {
    case "qrcode":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">QR Code ID</label>
          <Input
            value={config.qrCodeId || ""}
            onChange={(e) => onChange({ ...config, qrCodeId: e.target.value })}
            placeholder="QR-001"
            data-testid="trigger-qrcode-id"
          />
        </div>
      );
    case "gps":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">緯度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.lat || 25.033}
                onChange={(e) => onChange({ ...config, lat: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lat"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">經度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.lng || 121.565}
                onChange={(e) => onChange({ ...config, lng: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lng"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">觸發半徑 (公尺)</label>
            <Input
              type="number"
              value={config.radius || 50}
              onChange={(e) => onChange({ ...config, radius: parseInt(e.target.value) })}
              data-testid="trigger-gps-radius"
            />
          </div>
        </div>
      );
    case "shooting":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">最低分數</label>
          <Input
            type="number"
            value={config.minScore || 100}
            onChange={(e) => onChange({ ...config, minScore: parseInt(e.target.value) })}
            data-testid="trigger-shooting-score"
          />
        </div>
      );
    case "timer":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">延遲秒數</label>
          <Input
            type="number"
            value={config.delaySeconds || 60}
            onChange={(e) => onChange({ ...config, delaySeconds: parseInt(e.target.value) })}
            data-testid="trigger-timer-delay"
          />
        </div>
      );
    default:
      return null;
  }
}

function RewardConfigEditor({
  config,
  pages,
  onChange,
}: {
  config: any;
  pages: Page[];
  onChange: (config: any) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">獎勵類型</label>
        <Select
          value={config.type || "points"}
          onValueChange={(value) => {
            let newConfig = { type: value };
            switch (value) {
              case "points":
                newConfig = { ...newConfig, value: 10 } as any;
                break;
              case "item":
                newConfig = { ...newConfig, itemId: "" } as any;
                break;
              case "unlock_page":
                newConfig = { ...newConfig, pageId: "" } as any;
                break;
              case "message":
                newConfig = { ...newConfig, message: "" } as any;
                break;
            }
            onChange(newConfig);
          }}
        >
          <SelectTrigger data-testid="select-reward-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REWARD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-2">
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.type === "points" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">分數</label>
          <Input
            type="number"
            value={config.value || 10}
            onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) })}
            data-testid="reward-points-value"
          />
        </div>
      )}

      {config.type === "item" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">道具 ID</label>
          <Input
            value={config.itemId || ""}
            onChange={(e) => onChange({ ...config, itemId: e.target.value })}
            placeholder="輸入道具 ID"
            data-testid="reward-item-id"
          />
        </div>
      )}

      {config.type === "unlock_page" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">目標頁面</label>
          <Select
            value={config.pageId || ""}
            onValueChange={(value) => onChange({ ...config, pageId: value })}
          >
            <SelectTrigger data-testid="reward-page-select">
              <SelectValue placeholder="選擇頁面" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p, idx) => {
                const info = getPageTypeInfo(p.pageType);
                return (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <info.icon className="w-4 h-4" />
                      #{idx + 1} {info.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.type === "message" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">訊息內容</label>
          <Textarea
            value={config.message || ""}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
            placeholder="輸入要顯示的訊息..."
            rows={3}
            data-testid="reward-message"
          />
        </div>
      )}
    </div>
  );
}
