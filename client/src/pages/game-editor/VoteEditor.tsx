// 投票編輯器
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { LocationSettingsSection } from "./page-config-shared";

interface VoteEditorProps {
  config: Record<string, any>;
  updateField: (field: string, value: any) => void;
}

export default function VoteEditor({ config, updateField }: VoteEditorProps) {
  const voteOptions = config.options || [{ text: "選項一" }, { text: "選項二" }];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="隊伍投票"
          data-testid="config-vote-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">投票問題</label>
        <Textarea
          value={config.question || ""}
          onChange={(e) => updateField("question", e.target.value)}
          placeholder="請選擇你的答案"
          rows={2}
          data-testid="config-vote-question"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">投票選項</label>
        <div className="space-y-2">
          {voteOptions.map((opt: { text: string; icon?: string; nextPageId?: string }, idx: number) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                value={opt.text}
                onChange={(e) => {
                  const newOpts = [...voteOptions];
                  newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                  updateField("options", newOpts);
                }}
                placeholder={`選項 ${idx + 1}`}
                data-testid={`config-vote-option-${idx}`}
              />
              <Select
                value={opt.nextPageId || "_continue"}
                onValueChange={(value) => {
                  const newOpts = [...voteOptions];
                  newOpts[idx] = { ...newOpts[idx], nextPageId: value === "_continue" ? undefined : value };
                  updateField("options", newOpts);
                }}
              >
                <SelectTrigger className="w-[140px]" data-testid={`config-vote-option-next-${idx}`}>
                  <SelectValue placeholder="下一頁" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_continue">繼續下一頁</SelectItem>
                  <SelectItem value="_end">結束遊戲</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newOpts = voteOptions.filter((_: any, i: number) => i !== idx);
                  updateField("options", newOpts);
                }}
                disabled={voteOptions.length <= 2}
                data-testid={`config-vote-remove-${idx}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateField("options", [...voteOptions, { text: `選項 ${voteOptions.length + 1}` }])}
            data-testid="config-vote-add-option"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增選項
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.showResults ?? true}
            onChange={(e) => updateField("showResults", e.target.checked)}
            id="vote-show-results"
            data-testid="config-vote-show-results"
          />
          <label htmlFor="vote-show-results" className="text-sm">顯示投票結果</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.anonymousVoting ?? true}
            onChange={(e) => updateField("anonymousVoting", e.target.checked)}
            id="vote-anonymous"
            data-testid="config-vote-anonymous"
          />
          <label htmlFor="vote-anonymous" className="text-sm">匿名投票</label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">投票時限 (秒，0 = 無限)</label>
          <Input
            type="number"
            value={config.votingTimeLimit || 0}
            onChange={(e) => updateField("votingTimeLimit", parseInt(e.target.value) || 0)}
            min={0}
            max={300}
            data-testid="config-vote-time-limit"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">最少投票數</label>
          <Input
            type="number"
            value={config.minVotes || 1}
            onChange={(e) => updateField("minVotes", parseInt(e.target.value) || 1)}
            min={1}
            max={100}
            data-testid="config-vote-min-votes"
          />
          <p className="text-xs text-muted-foreground mt-1">達到此數量才顯示結果</p>
        </div>
      </div>
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
