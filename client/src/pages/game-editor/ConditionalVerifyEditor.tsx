// 碎片收集編輯器
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Puzzle } from "lucide-react";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";

interface Fragment {
  id: string;
  label: string;
  value: string;
  order: number;
}

export default function ConditionalVerifyEditor({ config, updateField }: EditorProps) {
  const fragments = (config.fragments || []) as Fragment[];

  const updateFragments = (newFragments: Fragment[]) => {
    updateField("fragments", newFragments);
    if (config.fragmentType !== 'custom') {
      const targetCode = newFragments.map((f) => f.value).join('');
      updateField("targetCode", targetCode);
    }
  };

  const generateFragments = (type: string, count: number) => {
    const newFragments = [];
    for (let i = 0; i < count; i++) {
      let value = '';
      if (type === 'numbers') {
        value = String(Math.floor(Math.random() * 10));
      } else if (type === 'letters') {
        value = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
      newFragments.push({
        id: `f${i + 1}`,
        label: `碎片 ${i + 1}/${count}`,
        value,
        order: i + 1
      });
    }
    return newFragments;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="碎片收集任務"
          data-testid="config-fragment-title"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">任務說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="收集所有碎片，組成正確的密碼"
          rows={2}
          data-testid="config-fragment-instruction"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">碎片類型</label>
          <Select
            value={config.fragmentType || "numbers"}
            onValueChange={(value) => {
              updateField("fragmentType", value);
              const newFragments = generateFragments(value, config.fragmentCount || 4);
              updateFragments(newFragments);
            }}
          >
            <SelectTrigger data-testid="config-fragment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="numbers">數字碎片 (0-9)</SelectItem>
              <SelectItem value="letters">字母碎片 (A-Z)</SelectItem>
              <SelectItem value="custom">自定義內容</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">碎片數量</label>
          <Input
            type="number"
            value={config.fragmentCount || 4}
            onChange={(e) => {
              const count = Math.max(2, Math.min(10, parseInt(e.target.value) || 4));
              updateField("fragmentCount", count);
              const newFragments = generateFragments(config.fragmentType || 'numbers', count);
              updateFragments(newFragments);
            }}
            min={2}
            max={10}
            data-testid="config-fragment-count"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">驗證模式</label>
        <Select
          value={config.verificationMode || "order_matters"}
          onValueChange={(value) => updateField("verificationMode", value)}
        >
          <SelectTrigger data-testid="config-verification-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="order_matters">順序重要（依照順序輸入）</SelectItem>
            <SelectItem value="order_independent">順序不重要（只需全部收集）</SelectItem>
            <SelectItem value="all_collected">只需確認收集（無需輸入）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-3 block flex items-center gap-2">
          <Puzzle className="w-4 h-4" />
          碎片配置
          <Badge variant="secondary" className="text-xs">{fragments.length} 個碎片</Badge>
        </label>
        <div className="space-y-2">
          {fragments.map((fragment: any, i: number) => (
            <div key={fragment.id || i} className="flex gap-2 items-center bg-accent/30 rounded-lg p-2">
              <div className="flex-shrink-0 w-16 text-center">
                <Badge variant="outline" className="text-xs">碎片 {i + 1}</Badge>
              </div>
              <Input
                value={fragment.value || ""}
                onChange={(e) => {
                  const newFragments = [...fragments];
                  newFragments[i] = { ...newFragments[i], value: e.target.value };
                  updateFragments(newFragments);
                }}
                placeholder={config.fragmentType === 'numbers' ? '0-9' : config.fragmentType === 'letters' ? 'A-Z' : '內容'}
                className="w-20 text-center font-mono"
                maxLength={config.fragmentType === 'custom' ? 10 : 1}
                data-testid={`config-fragment-value-${i}`}
              />
              <Input
                value={fragment.label || ""}
                onChange={(e) => {
                  const newFragments = [...fragments];
                  newFragments[i] = { ...newFragments[i], label: e.target.value };
                  updateField("fragments", newFragments);
                }}
                placeholder="碎片標籤"
                className="flex-1"
                data-testid={`config-fragment-label-${i}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">目標密碼</label>
        <Input
          value={config.targetCode || ""}
          onChange={(e) => updateField("targetCode", e.target.value)}
          placeholder="自動生成或手動設定"
          className="font-mono"
          data-testid="config-target-code"
        />
        <p className="text-xs text-muted-foreground mt-1">
          玩家需要收集碎片並組成此密碼。如果留空，將自動根據碎片值生成。
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 0}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 0)}
          min={0}
          max={1000}
          data-testid="config-fragment-reward"
        />
      </div>

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
