// 頁面設定編輯器 - 各種頁面類型的設定表單（主分發器）
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Bot, Plus, X as XIcon, Eye } from "lucide-react";
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
import CommonNavigationEditor from "./CommonNavigationEditor";
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
import { DeviceSelect } from "@/components/shared/DeviceSelect";
import { AIModelSelect } from "@/components/shared/AIModelSelect";
import { AIPhotoTester } from "@/components/shared/AIPhotoTester";
import PagePreviewDialog from "./PagePreviewDialog";

export default function PageConfigEditor({
  page,
  allPages,
  gameId,
  handleMediaUpload,
  isUploading,
  onUpdate,
  onUpdatePageMeta,
}: PageConfigEditorProps) {
  const config = page.config as Record<string, unknown>;
  const pageWithName = page as typeof page & { customName?: string | null };
  // 🆕 G1: 預覽 Dialog state
  const [previewOpen, setPreviewOpen] = useState(false);

  const updateField = (field: string, value: unknown) => {
    onUpdate({ ...config, [field]: value });
  };

  const updateCustomName = (name: string) => {
    // 傳回給父元件做 page-level 更新（非 config 內）
    onUpdatePageMeta?.({ customName: name || null });
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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">目標分數（選填）</label>
              <Input
                type="number"
                value={(config.targetScore as number | undefined) ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  updateField("targetScore", Number.isFinite(n) ? n : undefined);
                }}
                min={0}
                placeholder="不限制"
                data-testid="config-target-score"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                硬體裝置
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  選填，指定後只接受該靶機命中
                </span>
              </label>
              <DeviceSelect
                value={(config.deviceId as string) || ""}
                onChange={(deviceId) => updateField("deviceId", deviceId || undefined)}
                allowEmpty
                filterType="shooting_target"
                placeholder="不指定（任何裝置）"
                testId="config-device-id"
              />
            </div>
          </div>
          <div className="flex items-center justify-between border rounded p-2">
            <div>
              <span className="text-sm font-medium">啟用模擬命中</span>
              <p className="text-xs text-muted-foreground">無硬體場地/開發測試用；開啟後玩家可手動點按鈕模擬</p>
            </div>
            <Switch
              checked={config.allowSimulation === true}
              onCheckedChange={(v) => updateField("allowSimulation", v)}
              data-testid="config-allow-simulation"
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

                {/* 🤖 AI 模型選擇 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    AI 模型
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      選填，不填用場域預設
                    </span>
                  </label>
                  <AIModelSelect
                    value={(config.aiModelId as string) || ""}
                    onChange={(v) => updateField("aiModelId", v || undefined)}
                    visionOnly
                    testId="config-ai-model"
                  />
                </div>

                {/* 信心度門檻 + 四檔語意標籤 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      信心度門檻: {Math.round(((config.aiConfidenceThreshold as number) ?? 0.6) * 100)}%
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const v = (config.aiConfidenceThreshold as number) ?? 0.6;
                        if (v < 0.4) return "🟢 寬鬆";
                        if (v < 0.6) return "🟡 普通";
                        if (v < 0.8) return "🟠 嚴格";
                        return "🔴 非常嚴格";
                      })()}
                    </span>
                  </div>
                  <Slider
                    value={[((config.aiConfidenceThreshold as number) ?? 0.6) * 100]}
                    onValueChange={([v]) => updateField("aiConfidenceThreshold", v / 100)}
                    min={20}
                    max={95}
                    step={5}
                    data-testid="config-ai-threshold"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    建議 50-70%；越高 AI 越嚴格，但容易誤判真實照片
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

                {/* 🧪 AI 測試 */}
                <AIPhotoTester
                  gameId={gameId}
                  targetKeywords={(config.targetKeywords as string[]) || []}
                  instruction={(config.instruction as string) || ""}
                  confidenceThreshold={(config.aiConfidenceThreshold as number) ?? 0.6}
                  aiModelId={(config.aiModelId as string) || undefined}
                />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">輸入類型</label>
              <select
                value={(config.inputType as string) || "text"}
                onChange={(e) => updateField("inputType", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="config-input-type"
              >
                <option value="text">文字</option>
                <option value="number">數字</option>
                <option value="password">密碼</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">最大嘗試次數</label>
              <Input
                type="number"
                value={(config.maxAttempts as number | undefined) ?? 5}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  updateField("maxAttempts", Number.isFinite(n) && n > 0 ? n : 5);
                }}
                min={1}
                max={20}
                className="h-9"
                data-testid="config-max-attempts"
              />
            </div>
            <div className="flex items-center justify-between border rounded p-2">
              <span className="text-xs">大小寫敏感</span>
              <Switch
                checked={config.caseSensitive === true}
                onCheckedChange={(v) => updateField("caseSensitive", v)}
              />
            </div>
            <div className="flex items-center justify-between border rounded p-2">
              <span className="text-xs">漸進式回饋</span>
              <Switch
                checked={config.gradedFeedback === true}
                onCheckedChange={(v) => updateField("gradedFeedback", v)}
              />
            </div>
            <div className="flex items-center justify-between border rounded p-2">
              <span className="text-xs">顯示嘗試紀錄</span>
              <Switch
                checked={config.showAttemptHistory === true}
                onCheckedChange={(v) => updateField("showAttemptHistory", v)}
              />
            </div>
            <div className="flex items-center justify-between border rounded p-2">
              <span className="text-xs">答題後顯示解釋</span>
              <Switch
                checked={config.showExplanation === true}
                onCheckedChange={(v) => updateField("showExplanation", v)}
              />
            </div>
          </div>

          <HintsInput
            value={(config.hints as string[] | undefined) || []}
            onChange={(hints) => {
              updateField("hints", hints.length > 0 ? hints : undefined);
              if (hints.length > 0) updateField("hint", hints[0]);
            }}
          />



          {config.showExplanation === true && (
            <div>
              <label className="text-sm font-medium mb-2 block">答題後的解釋</label>
              <Textarea
                value={(config.explanation as string) || ""}
                onChange={(e) => updateField("explanation", e.target.value)}
                placeholder="說明正確答案的由來"
                rows={2}
                data-testid="config-explanation"
              />
            </div>
          )}

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
          allPages={allPages}
        />
      );

    case "conditional_verify":
      return <ConditionalVerifyEditor config={config} updateField={updateField} gameId={gameId} />;

    case "button":
      return (
        <div className="space-y-4">
          <ButtonConfigEditor config={config} updateField={updateField} allPages={allPages} gameId={gameId} />
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
      return <VoteEditor config={config} updateField={updateField} allPages={allPages} />;

    case "flow_router":
      return (
        <FlowRouterEditor
          config={config}
          updateField={updateField}
          allPages={allPages}
          gameId={gameId}
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
  };

  return (
    <div className="space-y-4">
      {/* 🏷️ 頁面名稱（通用）— 自訂識別名稱，會顯示為左側清單的主標題 */}
      <div className="space-y-2 pb-3 border-b border-border/50">
        <label className="text-sm font-medium flex items-center gap-2">
          頁面名稱
          <span className="text-xs text-muted-foreground font-normal">
            選填，例如「開場白」「第一關驗證」；留空則顯示模組類別
          </span>
        </label>
        <Input
          value={pageWithName.customName || ""}
          onChange={(e) => updateCustomName(e.target.value)}
          placeholder="留空則顯示模組預設名稱"
          maxLength={200}
          data-testid="input-page-custom-name"
        />
      </div>

      {renderPageConfig()}
      {/* 通用：下一頁導向 + 完成獎勵（依 pageType 自動判斷是否顯示） */}
      <CommonNavigationEditor
        config={config}
        updateField={updateField}
        allPages={allPages}
        pageType={page.pageType}
        currentPageId={page.id}
      />
      {/* 通用完成動作（flow_router 除外，它是純邏輯節點，不需要完成動作） */}
      {page.pageType !== "flow_router" && (
        <OnCompleteActionsEditor config={config} updateField={updateField} gameId={gameId} />
      )}
    </div>
  );
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


// 🆕 提示輸入 — 解決「打字 normalize 卡頓」問題：
// 原本 onChange 就 split/trim/filter，使用者打「第一,」時逗號和空白會被即時吃掉，很難繼續輸入。
// 改用 local state 讓使用者自由打，只在 blur 時才 parse 成 string[]。
function HintsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (hints: string[]) => void;
}) {
  const [localValue, setLocalValue] = useState(() => value.join(", "));

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">
        提示（答錯時顯示，多個用逗號分隔）
      </label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          const hints = localValue
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(hints);
          // 正規化顯示：blur 後用標準分隔重組回 input
          setLocalValue(hints.join(", "));
        }}
        placeholder="第一次提示, 第二次提示, 第三次提示"
        data-testid="config-hints"
      />
      <p className="text-xs text-muted-foreground mt-1">
        依答錯次數逐步顯示；也可只填一個提示
      </p>
    </div>
  );
}
