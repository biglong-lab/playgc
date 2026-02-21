// 頁面設定編輯器 - 各種頁面類型的設定表單（主分發器）
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Bot, Plus, X as XIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import ButtonConfigEditor from "./ButtonConfigEditor";
import ConditionalVerifyEditor from "./ConditionalVerifyEditor";
import TimeBombEditor from "./TimeBombEditor";
import LockEditor from "./LockEditor";
import MotionChallengeEditor from "./MotionChallengeEditor";
import VoteEditor from "./VoteEditor";
import FlowRouterEditor from "./FlowRouterEditor";
import OnCompleteActionsEditor from "./OnCompleteActionsEditor";
import { RewardsSection, LocationSettingsSection } from "./page-config-shared";
import {
  TextCardEditor,
  DialogueEditor,
  GpsMissionEditor,
  QrScanEditor,
  ChoiceVerifyEditor,
  VideoEditor,
} from "./page-config-inline-editors";
import type { MediaUploadButtonProps } from "./page-config-inline-editors";
import type { PageConfigEditorProps } from "./types";

export default function PageConfigEditor({
  page,
  allPages,
  gameId,
  handleMediaUpload,
  isUploading,
  onUpdate,
}: PageConfigEditorProps) {
  const config = page.config as Record<string, unknown>;

  const updateField = (field: string, value: unknown) => {
    onUpdate({ ...config, [field]: value });
  };

  // 共用的媒體上傳按鈕
  const MediaUploadButton = ({ id, accept, onUploaded }: MediaUploadButtonProps) => (
    <>
      <input
        type="file"
        accept={accept}
        className="hidden"
        id={id}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const mediaType = accept.startsWith('video') ? 'video' : accept.startsWith('audio') ? 'audio' : 'image';
            const url = await handleMediaUpload(file, mediaType as 'video' | 'audio' | 'image');
            if (url) onUploaded(url);
          }
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={isUploading}
        onClick={() => document.getElementById(id)?.click()}
        data-testid={`button-upload-${id}`}
      >
        {isUploading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <Upload className="w-4 h-4" />
        )}
      </Button>
    </>
  );

  // 渲染頁面特定設定 + 通用 onCompleteActions 區段
  const renderPageConfig = () => {
  switch (page.pageType) {
    case "text_card":
      return (
        <TextCardEditor
          config={config}
          updateField={updateField}
          gameId={gameId}
          MediaUploadButton={MediaUploadButton}
        />
      );

    case "dialogue":
      return (
        <DialogueEditor
          config={config}
          updateField={updateField}
          MediaUploadButton={MediaUploadButton}
        />
      );

    case "shooting_mission":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">需要命中次數</label>
            <Input
              type="number"
              value={(config.requiredHits as number) || 5}
              onChange={(e) => updateField("requiredHits", parseInt(e.target.value) || 5)}
              min={1}
              max={100}
              data-testid="config-hits"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
            <Input
              type="number"
              value={(config.timeLimit as number) || 60}
              onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 60)}
              min={10}
              max={300}
              data-testid="config-timelimit"
            />
          </div>
          <RewardsSection config={config} updateField={updateField} gameId={gameId} />
          <LocationSettingsSection config={config} updateField={updateField} />
        </div>
      );

    case "photo_mission":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">拍照指示</label>
            <Textarea
              value={(config.instruction as string) || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="請拍攝..."
              rows={4}
              data-testid="config-instruction"
            />
          </div>

          {/* AI 照片驗證設定 */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">AI 照片驗證</label>
              </div>
              <Switch
                checked={!!config.aiVerify}
                onCheckedChange={(checked) => updateField("aiVerify", checked)}
                data-testid="config-ai-verify"
              />
            </div>

            {!!config.aiVerify && (
              <div className="space-y-4 pt-2 border-t">
                <PhotoAiKeywordsEditor
                  keywords={(config.targetKeywords as string[]) || []}
                  onChange={(keywords) => updateField("targetKeywords", keywords)}
                />
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    信心度門檻: {Math.round(((config.aiConfidenceThreshold as number) ?? 0.6) * 100)}%
                  </label>
                  <Slider
                    value={[((config.aiConfidenceThreshold as number) ?? 0.6) * 100]}
                    onValueChange={([v]) => updateField("aiConfidenceThreshold", v / 100)}
                    min={20}
                    max={95}
                    step={5}
                    data-testid="config-ai-threshold"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    越高越嚴格，建議 50-70%
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">驗證失敗提示</label>
                  <Input
                    value={(config.aiFailMessage as string) || ""}
                    onChange={(e) => updateField("aiFailMessage", e.target.value)}
                    placeholder="照片不符合要求，請重新拍攝"
                    data-testid="config-ai-fail-msg"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">允許重拍</label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.allowRetryOnAiFail !== false}
                      onCheckedChange={(checked) => updateField("allowRetryOnAiFail", checked)}
                    />
                    {config.allowRetryOnAiFail !== false && (
                      <Input
                        type="number"
                        value={(config.maxAiRetries as number) ?? 3}
                        onChange={(e) => updateField("maxAiRetries", parseInt(e.target.value) || 3)}
                        className="w-16 h-8"
                        min={1}
                        max={10}
                        data-testid="config-ai-max-retries"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <RewardsSection config={config} updateField={updateField} gameId={gameId} />
          <LocationSettingsSection config={config} updateField={updateField} />
        </div>
      );

    case "gps_mission":
      return (
        <GpsMissionEditor
          config={config}
          updateField={updateField}
          gameId={gameId}
        />
      );

    case "qr_scan":
      return (
        <QrScanEditor
          config={config}
          updateField={updateField}
          gameId={gameId}
          page={page}
        />
      );

    case "text_verify":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">問題</label>
            <Input
              value={(config.question as string) || ""}
              onChange={(e) => updateField("question", e.target.value)}
              placeholder="輸入問題"
              data-testid="config-question"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">正確答案 (多個用逗號分隔)</label>
            <Input
              value={((config.answers as string[]) || []).join(", ")}
              onChange={(e) => updateField("answers", e.target.value.split(",").map((s: string) => s.trim()))}
              placeholder="答案1, 答案2"
              data-testid="config-answers"
            />
          </div>

          {/* AI 語意評分設定 */}
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">AI 語意評分</label>
              </div>
              <Switch
                checked={!!config.aiScoring}
                onCheckedChange={(checked) => updateField("aiScoring", checked)}
                data-testid="config-ai-scoring"
              />
            </div>

            {!!config.aiScoring && (
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    通過分數: {(config.aiPassingScore as number) ?? 70} 分
                  </label>
                  <Slider
                    value={[(config.aiPassingScore as number) ?? 70]}
                    onValueChange={([v]) => updateField("aiPassingScore", v)}
                    min={30}
                    max={95}
                    step={5}
                    data-testid="config-ai-passing"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    越低越寬鬆，建議 60-80 分
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">場景描述（選填）</label>
                  <Textarea
                    value={(config.aiContext as string) || ""}
                    onChange={(e) => updateField("aiContext", e.target.value)}
                    placeholder="描述問題的場景背景，幫助 AI 更準確評分..."
                    rows={2}
                    data-testid="config-ai-context"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  啟用後，即使答案不完全相同，語意相近也能通過（例如「太陽」和「日頭」）
                </p>
              </div>
            )}
          </div>

          <LocationSettingsSection config={config} updateField={updateField} />
        </div>
      );

    case "choice_verify":
      return (
        <ChoiceVerifyEditor
          config={config}
          updateField={updateField}
        />
      );

    case "conditional_verify":
      return <ConditionalVerifyEditor config={config} updateField={updateField} />;

    case "button":
      return (
        <div className="space-y-4">
          <ButtonConfigEditor config={config} updateField={updateField} allPages={allPages} />
          <LocationSettingsSection config={config} updateField={updateField} />
        </div>
      );

    case "video":
      return (
        <VideoEditor
          config={config}
          updateField={updateField}
          MediaUploadButton={MediaUploadButton}
        />
      );

    case "time_bomb":
      return <TimeBombEditor config={config} updateField={updateField} />;

    case "lock":
      return <LockEditor config={config} updateField={updateField} />;

    case "motion_challenge":
      return <MotionChallengeEditor config={config} updateField={updateField} />;

    case "vote":
      return <VoteEditor config={config} updateField={updateField} />;

    case "flow_router":
      return (
        <FlowRouterEditor
          config={config}
          updateField={updateField}
          allPages={allPages}
        />
      );

    default:
      return (
        <div className="bg-accent/30 rounded-lg p-4">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      );
  }
}

// ============================================================================
// AI 照片關鍵字編輯器（內部元件）
// ============================================================================
function PhotoAiKeywordsEditor({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">目標關鍵字</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {keywords.map((kw, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {kw}
            <button
              type="button"
              onClick={() => removeKeyword(i)}
              className="ml-1 hover:text-destructive"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
          placeholder="輸入關鍵字..."
          className="flex-1 h-8"
          data-testid="config-ai-keyword-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addKeyword}
          disabled={!newKeyword.trim()}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        AI 會檢查照片中是否包含這些物體或場景
      </p>
    </div>
  );
}
