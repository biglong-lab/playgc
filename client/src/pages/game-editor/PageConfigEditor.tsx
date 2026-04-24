// 頁面設定編輯器 - 各種頁面類型的設定表單（主分發器）
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Bot, Plus, X as XIcon, Eye, MapPin, ImageIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          {/* 🆕 v2: 拍照模式選擇器 */}
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <label className="text-sm font-medium">拍照模式</label>
            </div>
            <Select
              value={(config.mode as string) || "free"}
              onValueChange={(v) => updateField("mode", v === "free" ? undefined : v)}
            >
              <SelectTrigger data-testid="config-photo-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">
                  🎨 自由拍照（AI 關鍵字驗證）
                </SelectItem>
                <SelectItem value="spot">
                  📍 指定拍照（GPS + 視覺雙通道）
                </SelectItem>
                <SelectItem value="compare">
                  🔍 拍照確認（與參考照比對）
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.mode === "spot" && "玩家需到指定地點拍照，AI 會驗證 GPS 與視覺場景"}
              {config.mode === "compare" && "玩家需拍出與參考照相似的照片，AI 做相似度比對"}
              {(!config.mode || config.mode === "free") && "自由拍照，AI 依關鍵字檢查內容（既有模式）"}
            </p>
          </div>

          {/* 🆕 v2: 指定拍照 spot 子設定 */}
          {config.mode === "spot" && (
            <div className="border border-border rounded-lg p-4 space-y-4" data-testid="config-spot-section">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">拍照點設定</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">緯度 (lat)</label>
                  <Input
                    type="number"
                    step="any"
                    value={(config.spotConfig as any)?.latitude ?? ""}
                    onChange={(e) => updateField("spotConfig", {
                      ...(config.spotConfig as any || {}),
                      latitude: parseFloat(e.target.value) || 0,
                    })}
                    placeholder="24.4319"
                    data-testid="config-spot-lat"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">經度 (lng)</label>
                  <Input
                    type="number"
                    step="any"
                    value={(config.spotConfig as any)?.longitude ?? ""}
                    onChange={(e) => updateField("spotConfig", {
                      ...(config.spotConfig as any || {}),
                      longitude: parseFloat(e.target.value) || 0,
                    })}
                    placeholder="118.3174"
                    data-testid="config-spot-lng"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  半徑（公尺）— 預設 20m
                </label>
                <Input
                  type="number"
                  value={(config.spotConfig as any)?.radiusMeters ?? 20}
                  onChange={(e) => updateField("spotConfig", {
                    ...(config.spotConfig as any || {}),
                    radiusMeters: parseInt(e.target.value) || 20,
                  })}
                  min={1}
                  max={500}
                  data-testid="config-spot-radius"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  場景描述（AI 驗證用）
                </label>
                <Textarea
                  value={(config.spotConfig as any)?.sceneDescription ?? ""}
                  onChange={(e) => updateField("spotConfig", {
                    ...(config.spotConfig as any || {}),
                    sceneDescription: e.target.value,
                  })}
                  placeholder="例如：紅色涼亭 + 石獅子"
                  rows={2}
                  data-testid="config-spot-scene"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  參考圖（選填，給玩家看範例）
                </label>
                <div className="flex gap-2">
                  <Input
                    value={(config.spotConfig as any)?.referenceImageUrl ?? ""}
                    onChange={(e) => updateField("spotConfig", {
                      ...(config.spotConfig as any || {}),
                      referenceImageUrl: e.target.value,
                    })}
                    placeholder="貼 URL 或按右側上傳"
                    data-testid="config-spot-ref-url"
                  />
                  <MediaUploadButton
                    id="spot-ref-upload"
                    accept="image/*"
                    onUploaded={(url) => updateField("spotConfig", {
                      ...(config.spotConfig as any || {}),
                      referenceImageUrl: url,
                    })}
                  />
                </div>
                {(config.spotConfig as any)?.referenceImageUrl && (
                  <div className="mt-2 rounded border overflow-hidden max-w-xs">
                    <img
                      src={(config.spotConfig as any).referenceImageUrl}
                      alt="參考圖預覽"
                      className="w-full aspect-video object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    if (!("geolocation" in navigator)) {
                      alert("裝置不支援 GPS");
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        updateField("spotConfig", {
                          ...(config.spotConfig as any || {}),
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude,
                        });
                      },
                      (err) => {
                        alert(`無法取得位置：${err.message}`);
                      },
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                  data-testid="btn-spot-use-current-location"
                >
                  <MapPin className="w-4 h-4" />
                  使用我現在的位置
                </Button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">驗證策略</label>
                <Select
                  value={(config.spotConfig as any)?.verifyStrategy ?? "gps_and_vision"}
                  onValueChange={(v) => updateField("spotConfig", {
                    ...(config.spotConfig as any || {}),
                    verifyStrategy: v,
                  })}
                >
                  <SelectTrigger data-testid="config-spot-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gps_and_vision">GPS + 視覺（雙通過，最嚴）</SelectItem>
                    <SelectItem value="gps_or_vision">GPS 或 視覺（任一，寬鬆）</SelectItem>
                    <SelectItem value="gps_only">只看 GPS（最寬）</SelectItem>
                    <SelectItem value="vision_only">只看視覺</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GPS 嚴格度</label>
                <Select
                  value={(config.spotConfig as any)?.gpsStrictMode ?? "hard"}
                  onValueChange={(v) => updateField("spotConfig", {
                    ...(config.spotConfig as any || {}),
                    gpsStrictMode: v,
                  })}
                >
                  <SelectTrigger data-testid="config-spot-gps-strict">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">嚴格（未進圈無法拍照）</SelectItem>
                    <SelectItem value="soft">寬鬆（可拍但不在圈內會扣分）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">生成紀念照</label>
                <Switch
                  checked={(config.spotConfig as any)?.enableComposite !== false}
                  onCheckedChange={(checked) => updateField("spotConfig", {
                    ...(config.spotConfig as any || {}),
                    enableComposite: checked,
                  })}
                  data-testid="config-spot-composite"
                />
              </div>
            </div>
          )}

          {/* 🆕 v2: 拍照確認 compare 子設定 */}
          {config.mode === "compare" && (
            <div className="border border-border rounded-lg p-4 space-y-4" data-testid="config-compare-section">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">參考照片設定</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  參考照（必填）
                </label>
                <div className="flex gap-2">
                  <Input
                    value={(config.compareConfig as any)?.referenceImageUrl ?? ""}
                    onChange={(e) => updateField("compareConfig", {
                      ...(config.compareConfig as any || {}),
                      referenceImageUrl: e.target.value,
                    })}
                    placeholder="貼 URL 或按右側上傳"
                    data-testid="config-compare-ref-url"
                  />
                  <MediaUploadButton
                    id="compare-ref-upload"
                    accept="image/*"
                    onUploaded={(url) => updateField("compareConfig", {
                      ...(config.compareConfig as any || {}),
                      referenceImageUrl: url,
                    })}
                  />
                </div>
                {(config.compareConfig as any)?.referenceImageUrl && (
                  <div className="mt-2 rounded border overflow-hidden max-w-xs">
                    <img
                      src={(config.compareConfig as any).referenceImageUrl}
                      alt="參考照預覽"
                      className="w-full aspect-square object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  玩家需拍出與這張照片相似的畫面
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  參考照描述（選填，給 AI 特別提示）
                </label>
                <Textarea
                  value={(config.compareConfig as any)?.referenceDescription ?? ""}
                  onChange={(e) => updateField("compareConfig", {
                    ...(config.compareConfig as any || {}),
                    referenceDescription: e.target.value,
                  })}
                  placeholder="例如：請注意石獅子的朝向與背景紅色圍牆"
                  rows={2}
                  data-testid="config-compare-desc"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">比對模式</label>
                <Select
                  value={(config.compareConfig as any)?.compareMode ?? "scene"}
                  onValueChange={(v) => updateField("compareConfig", {
                    ...(config.compareConfig as any || {}),
                    compareMode: v,
                  })}
                >
                  <SelectTrigger data-testid="config-compare-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scene">整體場景（預設）</SelectItem>
                    <SelectItem value="object">物件存在性</SelectItem>
                    <SelectItem value="composition">構圖結構</SelectItem>
                    <SelectItem value="color">色調氛圍</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    相似度門檻: {Math.round(((config.compareConfig as any)?.similarityThreshold ?? 0.6) * 100)}%
                  </label>
                </div>
                <Slider
                  value={[((config.compareConfig as any)?.similarityThreshold ?? 0.6) * 100]}
                  onValueChange={([v]) => updateField("compareConfig", {
                    ...(config.compareConfig as any || {}),
                    similarityThreshold: v / 100,
                  })}
                  min={20}
                  max={95}
                  step={5}
                  data-testid="config-compare-threshold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  建議 50-70%；太高玩家會挫敗
                </p>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">直接顯示參考照</label>
                <Switch
                  checked={(config.compareConfig as any)?.showReferenceToPlayer !== false}
                  onCheckedChange={(checked) => updateField("compareConfig", {
                    ...(config.compareConfig as any || {}),
                    showReferenceToPlayer: checked,
                  })}
                  data-testid="config-compare-show-ref"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">生成紀念照</label>
                <Switch
                  checked={(config.compareConfig as any)?.enableComposite !== false}
                  onCheckedChange={(checked) => updateField("compareConfig", {
                    ...(config.compareConfig as any || {}),
                    enableComposite: checked,
                  })}
                  data-testid="config-compare-composite"
                />
              </div>
            </div>
          )}

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

          {/* AI 照片驗證設定（只對 free 模式有意義；spot/compare 已內建 AI） */}
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
      {/* 🏷️ 頁面名稱（通用）+ 🆕 G1: 預覽按鈕 */}
      <div className="space-y-2 pb-3 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <label className="text-sm font-medium flex items-center gap-2 flex-1">
            頁面名稱
            <span className="text-xs text-muted-foreground font-normal">
              選填，例如「開場白」「第一關驗證」；留空則顯示模組預設名稱
            </span>
          </label>
          {/* 🆕 G1: 預覽 — 所有 pageType 都支援，不用發布先看效果 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-1.5 shrink-0"
            data-testid="btn-open-preview"
          >
            <Eye className="w-3.5 h-3.5" />
            預覽
          </Button>
        </div>
        <Input
          value={pageWithName.customName || ""}
          onChange={(e) => updateCustomName(e.target.value)}
          placeholder="留空則顯示模組預設名稱"
          maxLength={200}
          data-testid="input-page-custom-name"
        />
      </div>

      {/* 🆕 G1: 預覽 Dialog */}
      <PagePreviewDialog
        page={previewOpen ? page : null}
        onClose={() => setPreviewOpen(false)}
      />

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
