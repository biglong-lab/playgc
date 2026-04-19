// 頁面設定編輯器 — 內嵌子元件（TextCard、Dialogue、GPS、QR、Choice、Video）
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X as XIcon } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import { RewardsSection, LocationSettingsSection } from "./page-config-shared";

// ====== 共用型別 ======

export interface MediaUploadButtonProps {
  id: string;
  accept: string;
  onUploaded: (url: string) => void;
}

interface BaseEditorProps {
  config: Record<string, unknown>;
  updateField: (field: string, value: unknown) => void;
}

interface WithGameId {
  gameId: string;
}

interface WithMediaUpload {
  MediaUploadButton: React.FC<MediaUploadButtonProps>;
}

// ====== 文字卡編輯器 ======

export function TextCardEditor({ config, updateField, gameId, MediaUploadButton }: BaseEditorProps & WithGameId & WithMediaUpload) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={(config.title as string) || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="輸入標題"
          data-testid="config-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">內容</label>
        <Textarea
          value={(config.content as string) || ""}
          onChange={(e) => updateField("content", e.target.value)}
          placeholder="輸入內容..."
          rows={6}
          data-testid="config-content"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">背景圖片 (可選)</label>
        <div className="flex gap-2">
          <Input
            value={(config.backgroundImage as string) || ""}
            onChange={(e) => updateField("backgroundImage", e.target.value)}
            placeholder="https://..."
            data-testid="config-background-image"
            className="flex-1"
          />
          <MediaUploadButton
            id="textcard-image-upload"
            accept="image/*"
            onUploaded={(url) => updateField("backgroundImage", url)}
          />
        </div>
        {Boolean(config.backgroundImage) && (
          <div className="mt-2">
            <img
              src={config.backgroundImage as string}
              alt="背景預覽"
              className="w-full rounded-lg max-h-32 object-cover"
              data-testid="image-preview"
            />
          </div>
        )}
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">佈局樣式</label>
        <Select
          value={(config.layout as string) || "center"}
          onValueChange={(value) => updateField("layout", value)}
        >
          <SelectTrigger data-testid="select-layout">
            <SelectValue placeholder="選擇佈局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="center">置中</SelectItem>
            <SelectItem value="image_top">圖片在上</SelectItem>
            <SelectItem value="image_left">圖片在左</SelectItem>
            <SelectItem value="fullscreen">全螢幕</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">背景音訊 (可選)</label>
        <div className="flex gap-2">
          <Input
            value={(config.backgroundAudio as string) || ""}
            onChange={(e) => updateField("backgroundAudio", e.target.value)}
            placeholder="https://..."
            data-testid="config-background-audio"
            className="flex-1"
          />
          <MediaUploadButton
            id="textcard-audio-upload"
            accept="audio/*"
            onUploaded={(url) => updateField("backgroundAudio", url)}
          />
        </div>
        {Boolean(config.backgroundAudio) && (
          <div className="mt-2">
            <audio
              src={config.backgroundAudio as string}
              controls
              className="w-full"
              data-testid="audio-preview"
            />
          </div>
        )}
      </div>

      {/* 視覺 & 效果 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">字體大小</label>
          <Select
            value={(config.fontSize as string) || "medium"}
            onValueChange={(v) => updateField("fontSize", v)}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">小</SelectItem>
              <SelectItem value="medium">中</SelectItem>
              <SelectItem value="large">大</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">進場動畫</label>
          <Select
            value={(config.animation as string) || "fade_in"}
            onValueChange={(v) => updateField("animation", v)}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fade_in">淡入</SelectItem>
              <SelectItem value="slide_in">滑入</SelectItem>
              <SelectItem value="none">無動畫</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">打字機效果</span>
          <Switch
            checked={config.typewriterEffect === true}
            onCheckedChange={(v) => updateField("typewriterEffect", v)}
          />
        </div>
      </div>
      {config.typewriterEffect === true && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">打字速度 (ms/字)</label>
          <Input
            type="number"
            value={(config.typewriterSpeed as number | undefined) ?? 30}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              updateField("typewriterSpeed", Number.isFinite(n) && n > 0 ? n : 30);
            }}
            min={5}
            max={500}
            className="h-9"
          />
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          高亮關鍵字（用逗號分隔）
        </label>
        <Input
          value={((config.highlightKeywords as string[] | undefined) || []).join(", ")}
          onChange={(e) => {
            const kws = e.target.value
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean);
            updateField("highlightKeywords", kws.length > 0 ? kws : undefined);
          }}
          placeholder="例：任務, 賈村, 競技"
          className="h-9"
        />
      </div>

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// ====== 對話編輯器 ======

const DIALOGUE_EMOTIONS = ["neutral", "happy", "angry", "surprised", "sad", "thinking"] as const;
const EMOTION_LABELS: Record<string, string> = {
  neutral: "中性", happy: "開心", angry: "憤怒", surprised: "驚訝", sad: "難過", thinking: "思考",
};

export function DialogueEditor({ config, updateField, MediaUploadButton }: BaseEditorProps & WithMediaUpload) {
  const character = (config.character || {}) as Record<string, unknown>;
  const messages = (config.messages || []) as Array<Record<string, unknown>>;
  const emotionAvatars = (character.emotionAvatars || {}) as Record<string, string>;

  const updateMessages = (next: Array<Record<string, unknown>>) => {
    updateField("messages", next);
  };

  const addMessage = () => {
    updateMessages([...messages, { text: "", emotion: "neutral" }]);
  };

  const updateMessage = (i: number, patch: Record<string, unknown>) => {
    const next = [...messages];
    next[i] = { ...next[i], ...patch };
    updateMessages(next);
  };

  const removeMessage = (i: number) => {
    updateMessages(messages.filter((_, idx) => idx !== i));
  };

  const moveMessage = (i: number, dir: -1 | 1) => {
    const next = [...messages];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    updateMessages(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">角色名稱</label>
        <Input
          value={(character.name as string) || ""}
          onChange={(e) => updateField("character", { ...character, name: e.target.value })}
          placeholder="角色名稱"
          data-testid="config-character"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">角色頭像（預設）</label>
        <div className="flex gap-2 items-center">
          {Boolean(character.avatar) && (
            <img
              src={character.avatar as string}
              alt="頭像"
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <Input
            value={(character.avatar as string) || ""}
            onChange={(e) => updateField("character", { ...character, avatar: e.target.value })}
            placeholder="https://..."
            data-testid="config-avatar-url"
            className="flex-1"
          />
          <MediaUploadButton
            id="dialogue-avatar-upload"
            accept="image/*"
            onUploaded={(url) => updateField("character", { ...character, avatar: url })}
          />
        </div>
      </div>

      {/* 情緒頭像（可選） */}
      <details className="border rounded-lg p-3 bg-accent/5">
        <summary className="text-sm font-medium cursor-pointer">情緒頭像（可選）</summary>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {DIALOGUE_EMOTIONS.slice(1).map((emotion) => (
            <div key={emotion} className="flex items-center gap-2">
              {emotionAvatars[emotion] && (
                <img src={emotionAvatars[emotion]} alt={emotion} className="w-8 h-8 rounded-full object-cover" />
              )}
              <span className="text-xs w-8 shrink-0">{EMOTION_LABELS[emotion]}</span>
              <Input
                value={emotionAvatars[emotion] || ""}
                onChange={(e) => updateField("character", {
                  ...character,
                  emotionAvatars: { ...emotionAvatars, [emotion]: e.target.value },
                })}
                placeholder="URL"
                className="text-xs h-8"
              />
            </div>
          ))}
        </div>
      </details>

      {/* 訊息列表 */}
      <div className="border rounded-lg p-3 bg-accent/5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">對話訊息 ({messages.length} 則)</label>
          <Button size="sm" variant="outline" onClick={addMessage}>
            <Plus className="w-3 h-3 mr-1" />新增訊息
          </Button>
        </div>

        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            還沒有對話內容。點「新增訊息」開始編寫劇情。
          </p>
        )}

        <div className="space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className="bg-background border rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs shrink-0">#{i + 1}</Badge>
                <Select
                  value={(msg.emotion as string) || "neutral"}
                  onValueChange={(v) => updateMessage(i, { emotion: v })}
                >
                  <SelectTrigger className="h-8 flex-1 max-w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIALOGUE_EMOTIONS.map((e) => (
                      <SelectItem key={e} value={e}>{EMOTION_LABELS[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={(msg.delay as number | undefined) ?? ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updateMessage(i, { delay: Number.isFinite(n) ? n : undefined });
                  }}
                  placeholder="延遲(ms)"
                  className="h-8 w-24 text-xs"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveMessage(i, -1)} disabled={i === 0}>↑</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveMessage(i, 1)} disabled={i === messages.length - 1}>↓</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMessage(i)}>
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
              <Textarea
                value={(msg.text as string) || ""}
                onChange={(e) => updateMessage(i, { text: e.target.value })}
                placeholder="對話文字..."
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 進階設定 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">自動前進</span>
          <Switch
            checked={config.autoAdvance === true}
            onCheckedChange={(v) => updateField("autoAdvance", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">氣泡動畫</span>
          <Switch
            checked={config.bubbleAnimation !== false}
            onCheckedChange={(v) => updateField("bubbleAnimation", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">情緒指示</span>
          <Switch
            checked={config.showEmotionIndicator === true}
            onCheckedChange={(v) => updateField("showEmotionIndicator", v)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">打字速度 (ms/字)</label>
          <Input
            type="number"
            value={(config.typingSpeed as number | undefined) ?? 30}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              updateField("typingSpeed", Number.isFinite(n) && n > 0 ? n : 30);
            }}
            min={5}
            max={500}
            className="h-8"
          />
        </div>
      </div>

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// ====== GPS 任務編輯器 ======

export function GpsMissionEditor({ config, updateField, gameId }: BaseEditorProps & WithGameId) {
  const targetLocation = (config.targetLocation || {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">目標位置</label>
        <LocationPicker
          lat={targetLocation.lat || 25.033}
          lng={targetLocation.lng || 121.565}
          radius={(config.radius as number) || 50}
          onChange={(lat, lng) => updateField("targetLocation", { lat, lng })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">緯度</label>
          <Input
            type="number"
            step="0.0001"
            value={targetLocation.lat || 25.033}
            onChange={(e) => updateField("targetLocation", {
              ...targetLocation,
              lat: parseFloat(e.target.value),
            })}
            data-testid="config-lat"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">經度</label>
          <Input
            type="number"
            step="0.0001"
            value={targetLocation.lng || 121.565}
            onChange={(e) => updateField("targetLocation", {
              ...targetLocation,
              lng: parseFloat(e.target.value),
            })}
            data-testid="config-lng"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">觸發半徑 (公尺)</label>
        <Input
          type="number"
          value={(config.radius as number) || 50}
          onChange={(e) => updateField("radius", parseInt(e.target.value) || 50)}
          min={5}
          max={500}
          data-testid="config-radius"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">任務指示</label>
        <Textarea
          value={(config.instruction as string) || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="前往目標位置"
          rows={2}
          data-testid="config-gps-instruction"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">接近提示</span>
          <Switch
            checked={config.hotZoneHints !== false}
            onCheckedChange={(v) => updateField("hotZoneHints", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">接近音效</span>
          <Switch
            checked={config.proximitySound === true}
            onCheckedChange={(v) => updateField("proximitySound", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">顯示地圖</span>
          <Switch
            checked={config.showMap === true}
            onCheckedChange={(v) => updateField("showMap", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">啟用 QR Fallback</span>
          <Switch
            checked={config.qrFallback === true}
            onCheckedChange={(v) => updateField("qrFallback", v)}
          />
        </div>
      </div>

      {config.qrFallback === true && (
        <div>
          <label className="text-sm font-medium mb-2 block">備用 QR 代碼</label>
          <Input
            value={(config.fallbackQrCode as string) || ""}
            onChange={(e) => updateField("fallbackQrCode", e.target.value)}
            placeholder="GPS 不可用時玩家輸入此代碼通關"
            className="font-mono"
            data-testid="config-gps-fallback"
          />
          <p className="text-xs text-muted-foreground mt-1">
            玩家訊號差時可改用此代碼手動通關（建議貼在現場）
          </p>
        </div>
      )}

      <RewardsSection config={config} updateField={updateField} gameId={gameId} />
    </div>
  );
}

// ====== QR 掃描編輯器 ======

export function QrScanEditor({ config, updateField, gameId, page }: BaseEditorProps & WithGameId & { page: { id: string } }) {
  const alternativeCodes = (config.alternativeCodes || []) as string[];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">驗證代碼 (主要)</label>
        <Input
          value={(config.primaryCode as string) || (config.qrCodeId as string) || ""}
          onChange={(e) => {
            updateField("primaryCode", e.target.value);
            updateField("qrCodeId", e.target.value);
          }}
          placeholder="JC-LOC-001"
          data-testid="config-primary-code"
        />
        <p className="text-xs text-muted-foreground mt-1">
          玩家掃描 QR Code 後必須匹配的代碼
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">驗證模式</label>
        <Select
          value={(config.validationMode as string) || "case_insensitive"}
          onValueChange={(value) => updateField("validationMode", value)}
        >
          <SelectTrigger data-testid="select-validation-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="case_insensitive">不區分大小寫（預設）</SelectItem>
            <SelectItem value="exact">精確匹配</SelectItem>
            <SelectItem value="location_id">位置 ID 模式</SelectItem>
            <SelectItem value="regex">正則表達式</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {config.validationMode === 'exact' && '區分大小寫的精確匹配'}
          {config.validationMode === 'regex' && '使用正則表達式進行模式匹配'}
          {config.validationMode === 'location_id' && '只比較數字部分（如 JC-LOC-001 只比較 001）'}
          {(!config.validationMode || config.validationMode === 'case_insensitive') && '忽略大小寫進行匹配'}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">備用代碼 (可選)</label>
        <Textarea
          value={alternativeCodes.join("\n")}
          onChange={(e) => updateField("alternativeCodes", e.target.value.split("\n").filter((s: string) => s.trim()))}
          placeholder="每行一個備用代碼"
          rows={2}
          data-testid="config-alt-codes"
        />
        <p className="text-xs text-muted-foreground mt-1">
          額外可接受的代碼，每行一個
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">掃描指示</label>
        <Textarea
          value={(config.instruction as string) || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="請掃描檢查站的 QR Code"
          rows={2}
          data-testid="config-qr-instruction"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">位置提示 (可選)</label>
        <Input
          value={(config.locationHint as string) || ""}
          onChange={(e) => updateField("locationHint", e.target.value)}
          placeholder="在大門旁邊的柱子上"
          data-testid="config-location-hint"
        />
      </div>
      <QRCodeGenerator
        qrCodeId={(config.primaryCode as string) || (config.qrCodeId as string) || ""}
        gameId={gameId}
        pageId={page.id}
      />
      <RewardsSection config={config} updateField={updateField} gameId={gameId} />
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// ====== 選擇題驗證編輯器 ======

interface ChoiceOption {
  text: string;
  correct: boolean;
}

export function ChoiceVerifyEditor({ config, updateField }: BaseEditorProps) {
  const options = (config.options || []) as ChoiceOption[];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">問題</label>
        <Input
          value={(config.question as string) || ""}
          onChange={(e) => updateField("question", e.target.value)}
          placeholder="輸入問題"
          data-testid="config-choice-question"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">選項設定</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="space-y-1 border rounded p-2">
              <div className="flex gap-2 items-center">
                <Input
                  value={opt.text || ""}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[i] = { ...newOptions[i], text: e.target.value };
                    updateField("options", newOptions);
                  }}
                  placeholder={`選項 ${i + 1}`}
                  className="flex-1"
                  data-testid={`config-option-${i}`}
                />
                <Badge
                  variant={opt.correct ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const newOptions = [...options];
                    newOptions[i] = { ...newOptions[i], correct: !newOptions[i].correct };
                    updateField("options", newOptions);
                  }}
                >
                  {opt.correct ? "正確" : "錯誤"}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    const newOptions = options.filter((_, idx) => idx !== i);
                    updateField("options", newOptions);
                  }}
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
              <Input
                value={(opt as ChoiceOption & { explanation?: string }).explanation || ""}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i] = { ...newOptions[i], explanation: e.target.value };
                  updateField("options", newOptions);
                }}
                placeholder="選項解釋（玩家選中時顯示，可選）"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateField("options", [...options, { text: "", correct: false }]);
            }}
            data-testid="button-add-option"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增選項
          </Button>
        </div>
      </div>

      {/* 進階選項 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">選項隨機順序</span>
          <Switch
            checked={config.randomizeOptions === true}
            onCheckedChange={(v) => updateField("randomizeOptions", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">多選模式</span>
          <Switch
            checked={config.multiple === true}
            onCheckedChange={(v) => updateField("multiple", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">顯示解釋</span>
          <Switch
            checked={config.showExplanation === true}
            onCheckedChange={(v) => updateField("showExplanation", v)}
          />
        </div>
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
            className="h-8"
          />
        </div>
      </div>

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// ====== 影片編輯器 ======

export function VideoEditor({ config, updateField, MediaUploadButton }: BaseEditorProps & WithMediaUpload) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">影片 URL</label>
        <div className="flex gap-2">
          <Input
            value={(config.videoUrl as string) || ""}
            onChange={(e) => updateField("videoUrl", e.target.value)}
            placeholder="https://..."
            data-testid="config-video-url"
            className="flex-1"
          />
          <MediaUploadButton
            id="video-upload-input"
            accept="video/*"
            onUploaded={(url) => updateField("videoUrl", url)}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">支援上傳影片或輸入 Cloudinary URL</p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={(config.title as string) || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="影片標題"
          data-testid="config-video-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">描述（可選）</label>
        <Textarea
          value={(config.description as string) || ""}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="簡短說明影片內容"
          rows={2}
          data-testid="config-video-description"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">封面圖 URL（可選）</label>
        <div className="flex gap-2">
          <Input
            value={(config.poster as string) || ""}
            onChange={(e) => updateField("poster", e.target.value)}
            placeholder="影片未播放時顯示的圖片"
            className="flex-1"
            data-testid="config-video-poster"
          />
          <MediaUploadButton
            id="video-poster-upload"
            accept="image/*"
            onUploaded={(url) => updateField("poster", url)}
          />
        </div>
      </div>
      {Boolean(config.videoUrl) && (
        <div>
          <label className="text-sm font-medium mb-2 block">預覽</label>
          <video
            src={config.videoUrl as string}
            poster={(config.poster as string) || undefined}
            controls
            className="w-full rounded-lg max-h-48"
            data-testid="video-preview"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">自動播放</span>
          <Switch
            checked={config.autoPlay !== false}
            onCheckedChange={(v) => updateField("autoPlay", v)}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">允許跳過</span>
          <Switch
            checked={config.skipEnabled !== false && config.forceWatch !== true}
            onCheckedChange={(v) => updateField("skipEnabled", v)}
            disabled={config.forceWatch === true}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">強制看完</span>
          <Switch
            checked={config.forceWatch === true}
            onCheckedChange={(v) => {
              updateField("forceWatch", v);
              if (v) updateField("skipEnabled", false);
            }}
          />
        </div>
        <div className="flex items-center justify-between border rounded p-2">
          <span className="text-xs">結束自動前進</span>
          <Switch
            checked={config.autoCompleteOnEnd === true}
            onCheckedChange={(v) => updateField("autoCompleteOnEnd", v)}
          />
        </div>
      </div>
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
