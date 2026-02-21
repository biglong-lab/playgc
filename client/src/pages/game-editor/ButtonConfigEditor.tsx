// 按鈕選擇頁面設定編輯器
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ChevronDown, Play } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "./constants";
import type { PageConfig, PageConfigValue } from "./page-config-shared";

interface ButtonItem {
  text: string;
  nextPageId?: string;
  rewardPoints?: number;
}

export default function ButtonConfigEditor({
  config,
  updateField,
  allPages
}: {
  config: PageConfig;
  updateField: (field: string, value: PageConfigValue) => void;
  allPages: Page[];
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
                      const newButtons = config.buttons.filter((_: any, idx: number) => idx !== i);
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

                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground shrink-0 w-16">獎勵分數:</label>
                  <Input
                    type="number"
                    value={btn.rewardPoints || 0}
                    onChange={(e) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = { ...newButtons[i], rewardPoints: parseInt(e.target.value) || 0 };
                      updateField("buttons", newButtons);
                    }}
                    placeholder="0"
                    className="w-24"
                    data-testid={`config-button-points-${i}`}
                  />
                  <span className="text-xs text-muted-foreground">分</span>
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
    </div>
  );
}
