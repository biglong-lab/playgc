// 密碼鎖編輯器
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";

export default function LockEditor({ config, updateField }: EditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="密碼鎖"
          data-testid="config-lock-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">鎖類型</label>
        <Select
          value={config.lockType || "number"}
          onValueChange={(value) => updateField("lockType", value)}
        >
          <SelectTrigger data-testid="config-lock-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">數字鎖</SelectItem>
            <SelectItem value="letter">字母鎖</SelectItem>
            <SelectItem value="dial">轉盤鎖</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">密碼組合</label>
        <Input
          value={config.combination || ""}
          onChange={(e) => updateField("combination", e.target.value)}
          placeholder={config.lockType === "letter" ? "ABCD" : "1234"}
          data-testid="config-lock-code"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">位數</label>
          <Input
            type="number"
            value={config.digits || 4}
            onChange={(e) => updateField("digits", parseInt(e.target.value) || 4)}
            min={2}
            max={8}
            data-testid="config-lock-digits"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">最大嘗試次數</label>
          <Input
            type="number"
            value={config.maxAttempts || 5}
            onChange={(e) => updateField("maxAttempts", parseInt(e.target.value) || 5)}
            min={1}
            max={20}
            data-testid="config-lock-attempts"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">提示</label>
        <Textarea
          value={config.hint || ""}
          onChange={(e) => updateField("hint", e.target.value)}
          placeholder="可選的密碼提示..."
          rows={2}
          data-testid="config-lock-hint"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="解開密碼鎖以繼續..."
          rows={2}
          data-testid="config-lock-instruction"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 20}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 20)}
          min={0}
          data-testid="config-lock-points"
        />
      </div>
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
