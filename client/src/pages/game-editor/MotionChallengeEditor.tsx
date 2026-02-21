// 體感挑戰編輯器
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";

export default function MotionChallengeEditor({ config, updateField }: EditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="體感挑戰"
          data-testid="config-motion-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">挑戰類型</label>
        <Select
          value={config.challengeType || "shake"}
          onValueChange={(value) => updateField("challengeType", value)}
        >
          <SelectTrigger data-testid="config-motion-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shake">搖晃手機</SelectItem>
            <SelectItem value="tilt">傾斜手機</SelectItem>
            <SelectItem value="jump">跳躍 (垂直移動)</SelectItem>
            <SelectItem value="rotate">旋轉手機</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">目標值</label>
        <Input
          type="number"
          value={config.targetValue || 20}
          onChange={(e) => updateField("targetValue", parseInt(e.target.value) || 20)}
          min={1}
          max={100}
          data-testid="config-motion-target"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {config.challengeType === "shake" ? "搖晃次數" :
           config.challengeType === "tilt" || config.challengeType === "rotate" ? "傾斜角度" : "移動次數"}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
        <Input
          type="number"
          value={config.timeLimit || 30}
          onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 30)}
          min={5}
          max={120}
          data-testid="config-motion-time"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="搖晃你的手機來完成挑戰!"
          rows={2}
          data-testid="config-motion-instruction"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">成功訊息</label>
          <Input
            value={config.successMessage || ""}
            onChange={(e) => updateField("successMessage", e.target.value)}
            placeholder="挑戰成功!"
            data-testid="config-motion-success"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">失敗訊息</label>
          <Input
            value={config.failureMessage || ""}
            onChange={(e) => updateField("failureMessage", e.target.value)}
            placeholder="時間到!"
            data-testid="config-motion-failure"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 15}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 15)}
          min={0}
          data-testid="config-motion-points"
        />
      </div>
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
