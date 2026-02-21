// 拆彈任務編輯器
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";

interface BombTask {
  type: string;
  question: string;
  targetCount?: number;
  answer?: string;
}

export default function TimeBombEditor({ config, updateField }: EditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="拆彈任務"
          data-testid="config-bomb-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
        <Input
          type="number"
          value={config.timeLimit || 60}
          onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 60)}
          min={10}
          max={300}
          data-testid="config-bomb-time"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">任務說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="在時間內完成所有任務來拆除炸彈!"
          rows={2}
          data-testid="config-bomb-instruction"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-3 block flex items-center gap-2">
          任務列表
          <Badge variant="secondary" className="text-xs">{(config.tasks || []).length} 個任務</Badge>
        </label>
        <div className="space-y-2">
          {(config.tasks || []).map((task: any, i: number) => (
            <div key={i} className="bg-accent/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <Badge variant="outline">任務 {i + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newTasks = config.tasks.filter((_: any, idx: number) => idx !== i);
                    updateField("tasks", newTasks);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Select
                value={task.type || "tap"}
                onValueChange={(value) => {
                  const newTasks = [...config.tasks];
                  newTasks[i] = { ...newTasks[i], type: value };
                  updateField("tasks", newTasks);
                }}
              >
                <SelectTrigger data-testid={`config-task-type-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tap">快速點擊</SelectItem>
                  <SelectItem value="input">輸入答案</SelectItem>
                  <SelectItem value="choice">選擇題</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={task.question || ""}
                onChange={(e) => {
                  const newTasks = [...config.tasks];
                  newTasks[i] = { ...newTasks[i], question: e.target.value };
                  updateField("tasks", newTasks);
                }}
                placeholder="問題或說明"
                data-testid={`config-task-question-${i}`}
              />
              {task.type === "tap" && (
                <Input
                  type="number"
                  value={task.targetCount || 10}
                  onChange={(e) => {
                    const newTasks = [...config.tasks];
                    newTasks[i] = { ...newTasks[i], targetCount: parseInt(e.target.value) || 10 };
                    updateField("tasks", newTasks);
                  }}
                  placeholder="目標點擊次數"
                  data-testid={`config-task-count-${i}`}
                />
              )}
              {task.type === "input" && (
                <Input
                  value={task.answer || ""}
                  onChange={(e) => {
                    const newTasks = [...config.tasks];
                    newTasks[i] = { ...newTasks[i], answer: e.target.value };
                    updateField("tasks", newTasks);
                  }}
                  placeholder="正確答案"
                  data-testid={`config-task-answer-${i}`}
                />
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateField("tasks", [...(config.tasks || []), { type: "tap", question: "", targetCount: 10 }]);
            }}
            data-testid="button-add-task"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增任務
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">成功訊息</label>
          <Input
            value={config.successMessage || ""}
            onChange={(e) => updateField("successMessage", e.target.value)}
            placeholder="炸彈已拆除!"
            data-testid="config-bomb-success"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">失敗訊息</label>
          <Input
            value={config.failureMessage || ""}
            onChange={(e) => updateField("failureMessage", e.target.value)}
            placeholder="時間到!"
            data-testid="config-bomb-failure"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 50}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 50)}
          min={0}
          data-testid="config-bomb-points"
        />
      </div>
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
