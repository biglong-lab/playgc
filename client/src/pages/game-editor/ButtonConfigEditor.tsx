// 按鈕選擇頁面設定編輯器
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ChevronDown, Play, Clock } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "./constants";
import type { PageConfig, PageConfigValue } from "./page-config-shared";
import { ItemMultiSelect } from "@/components/shared/ItemMultiSelect";

interface ButtonItem {
  text: string;
  nextPageId?: string;
  rewardPoints?: number;
  icon?: string;
  color?: string;
  items?: string[];
}

export default function ButtonConfigEditor({
  config,
  updateField,
  allPages,
  gameId,
}: {
  config: PageConfig;
  updateField: (field: string, value: PageConfigValue) => void;
  allPages: Page[];
  gameId?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">提示文字</label>
        <Input
          value={config.prompt || ""}
          onChange={(e) => updateField("prompt", e.target.value)}
          placeholder="請選擇一個選項..."
          data-testid="config-button-prompt"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-3 block flex items-center gap-2">
          按鈕選項
          <Badge variant="secondary" className="text-xs">條件分支</Badge>
        </label>
        <div className="space-y-3">
          {((config.buttons || []) as ButtonItem[]).map((btn: ButtonItem, i: number) => (
            <Card key={i} className="p-3">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={btn.text || ""}
                    onChange={(e) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = { ...newButtons[i], text: e.target.value };
                      updateField("buttons", newButtons);
                    }}
                    placeholder={`按鈕文字 ${i + 1}`}
                    className="flex-1"
                    data-testid={`config-button-text-${i}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => {
                      const newButtons = (config.buttons as ButtonItem[]).filter((_: ButtonItem, idx: number) => idx !== i);
                      updateField("buttons", newButtons);
                    }}
                    data-testid={`config-button-delete-${i}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground shrink-0 w-16">跳轉到:</label>
                  <Select
                    value={btn.nextPageId || "_next"}
                    onValueChange={(value) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = {
                        ...newButtons[i],
                        nextPageId: value === "_next" ? undefined : value
                      };
                      updateField("buttons", newButtons);
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid={`config-button-next-${i}`}>
                      <SelectValue placeholder="選擇目標頁面" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_next">
                        <span className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4" />
                          下一頁 (順序)
                        </span>
                      </SelectItem>
                      <SelectItem value="_end">
                        <span className="flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          結束遊戲
                        </span>
                      </SelectItem>
                      {allPages.map((p, idx) => {
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">獎勵分數</label>
                    <Input
                      type="number"
                      value={btn.rewardPoints ?? 0}
                      onChange={(e) => {
                        const newButtons = [...config.buttons];
                        const n = parseInt(e.target.value, 10);
                        newButtons[i] = { ...newButtons[i], rewardPoints: Number.isFinite(n) ? n : 0 };
                        updateField("buttons", newButtons);
                      }}
                      placeholder="0"
                      className="h-9"
                      data-testid={`config-button-points-${i}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">圖示（lucide 名稱）</label>
                    <Input
                      value={btn.icon || ""}
                      onChange={(e) => {
                        const newButtons = [...config.buttons];
                        newButtons[i] = { ...newButtons[i], icon: e.target.value || undefined };
                        updateField("buttons", newButtons);
                      }}
                      placeholder="例：Sword / Heart"
                      className="h-9"
                      data-testid={`config-button-icon-${i}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">按鈕顏色</label>
                    <Input
                      type="color"
                      value={btn.color || "#3b82f6"}
                      onChange={(e) => {
                        const newButtons = [...config.buttons];
                        newButtons[i] = { ...newButtons[i], color: e.target.value };
                        updateField("buttons", newButtons);
                      }}
                      className="h-9"
                      data-testid={`config-button-color-${i}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">發送道具</label>
                    <ItemMultiSelect
                      gameId={gameId}
                      value={btn.items || []}
                      onChange={(items) => {
                        const newButtons = [...config.buttons];
                        newButtons[i] = { ...newButtons[i], items: items.length > 0 ? items : undefined };
                        updateField("buttons", newButtons);
                      }}
                      testId={`config-button-items-${i}`}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateField("buttons", [...(config.buttons || []), { text: "", nextPageId: undefined, rewardPoints: 0 }]);
            }}
            data-testid="button-add-button"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增選項
          </Button>
        </div>
      </div>

      {/* 進階選項 */}
      <div className="border rounded-lg p-3 space-y-3 bg-accent/5">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" /> 時限與排序
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">時限（秒，0=無）</label>
            <Input
              type="number"
              value={(config.timeLimit as number | undefined) ?? 0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                updateField("timeLimit", Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              min={0}
              className="h-9"
              data-testid="config-button-time-limit"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">時間到預設選項</label>
            <Input
              type="number"
              value={(config.defaultChoice as number | undefined) ?? 0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                updateField("defaultChoice", Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              min={0}
              max={(((config.buttons as ButtonItem[]) || []).length || 1) - 1}
              className="h-9"
              data-testid="config-button-default-choice"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">第 0 個為第一顆</p>
          </div>
          <div className="flex items-center justify-between border rounded p-2 col-span-2">
            <span className="text-xs">隨機按鈕順序</span>
            <Switch
              checked={config.randomizeOrder === true}
              onCheckedChange={(v) => updateField("randomizeOrder", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
