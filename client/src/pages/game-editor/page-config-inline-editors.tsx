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
import { ensureAudioUrl } from "@/lib/cloudinary-audio";
import { LocationImporter } from "@/components/shared/LocationImporter";

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
            {/* 🎵 用 ensureAudioUrl 處理 Cloudinary /video/upload/ → 強制 .mp3 transcode
                ⚠️ 不要加 crossOrigin — Cloudinary /video/upload/ 不送 ACAO header
                會導致 CORS 擋掉整個請求 */}
            <audio
              src={ensureAudioUrl(config.backgroundAudio as string)}
              controls
              preload="auto"
              className="w-full"
              data-testid="audio-preview"
              onLoadedMetadata={(e) => {
                console.log("[audio-preview] ✅ metadata loaded", {
                  duration: e.currentTarget.duration,
                  src: e.currentTarget.currentSrc,
                });
              }}
              onError={(e) => {
                const audio = e.currentTarget;
                console.error("[audio-preview] ❌ load failed", {
                  errorCode: audio.error?.code,
                  errorMessage: audio.error?.message,
                  networkState: audio.networkState,
                  readyState: audio.readyState,
                  src: audio.currentSrc,
                });
              }}
              onCanPlay={() => {
                console.log("[audio-preview] ▶️ can play");
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              💡 若無法播放，請確認上傳的是音訊檔（mp3 / m4a / wav）—
              開瀏覽器 DevTools Console 看 [audio-preview] 訊息
            </p>
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

      {/* 情緒頭像（可選）— 每個情緒可貼 URL 或直接上傳圖片 */}
      <details className="border rounded-lg p-3 bg-accent/5">
        <summary className="text-sm font-medium cursor-pointer">情緒頭像（可選）</summary>
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          每個情緒可上傳不同的頭像，玩家對話時會依訊息的 emotion 欄位切換
        </p>
        <div className="grid grid-cols-1 gap-2 mt-3">
          {DIALOGUE_EMOTIONS.slice(1).map((emotion) => (
            <div key={emotion} className="flex items-center gap-2">
              {emotionAvatars[emotion] ? (
                <img
                  src={emotionAvatars[emotion]}
                  alt={emotion}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full border border-dashed border-muted-foreground/30 shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                  空
                </div>
              )}
              <span className="text-xs w-10 shrink-0 font-medium">
                {EMOTION_LABELS[emotion]}
              </span>
              <Input
                value={emotionAvatars[emotion] || ""}
                onChange={(e) => updateField("character", {
                  ...character,
                  emotionAvatars: { ...emotionAvatars, [emotion]: e.target.value },
                })}
                placeholder="貼上 URL 或用右側按鈕上傳"
                className="text-xs h-9 flex-1"
              />
              {/* 🆕 上傳按鈕（消除 raw URL 硬編寫） */}
              <MediaUploadButton
                id={`dialogue-emotion-avatar-${emotion}`}
                accept="image/*"
                onUploaded={(url) =>
                  updateField("character", {
                    ...character,
                    emotionAvatars: { ...emotionAvatars, [emotion]: url },
                  })
                }
              />
              {emotionAvatars[emotion] && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-destructive"
                  onClick={() => {
                    const next = { ...emotionAvatars };
                    delete next[emotion];
                    updateField("character", { ...character, emotionAvatars: next });
                  }}
                  title="清除此情緒的頭像"
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              )}
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
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">目標位置</label>
          {/* 🆕 從既有 Location entity 快速匯入座標 */}
          <LocationImporter
            gameId={gameId}
            mode="gps"
            buttonLabel="引用已建地點"
            onSelect={(loc) => {
              const lat = Number(loc.latitude);
              const lng = Number(loc.longitude);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                updateField("targetLocation", { lat, lng });
              }
              if (typeof loc.radius === "number" && loc.radius > 0) {
                updateField("radius", loc.radius);
              }
              if (loc.name && !config.locationName) {
                updateField("locationName", loc.name);
              }
            }}
          />
        </div>
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
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={(config.title as string) || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="掃描 QR Code"
          data-testid="config-qr-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">描述（可選）</label>
        <Textarea
          value={(config.description as string) || ""}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="此 QR 的故事背景或提示"
          rows={2}
          data-testid="config-qr-description"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">驗證代碼 (主要)</label>
          {/* 🆕 從既有 Location 引用 qrCodeData */}
          <LocationImporter
            gameId={gameId}
            mode="qr"
            buttonLabel="引用地點的 QR"
            onSelect={(loc) => {
              if (loc.qrCodeData) {
                updateField("primaryCode", loc.qrCodeData);
                updateField("qrCodeId", loc.qrCodeData);
              }
              if (loc.name && !config.title) {
                updateField("title", loc.name);
              }
            }}
          />
        </div>
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
      <div>
        <label className="text-sm font-medium mb-2 block">驗證成功訊息（可選）</label>
        <Input
          value={(config.successMessage as string) || ""}
          onChange={(e) => updateField("successMessage", e.target.value)}
          placeholder="QR Code 驗證成功！"
          data-testid="config-qr-success-message"
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
  explanation?: string;
  nextPageId?: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export function ChoiceVerifyEditor({
  config,
  updateField,
  allPages,
}: BaseEditorProps & { allPages?: Array<{ id: string; pageType: string; customName?: string | null }> }) {
  const options = (config.options || []) as ChoiceOption[];
  const questions = (config.questions || []) as QuizQuestion[];
  // 有 questions 陣列 → Quiz 模式；否則 legacy 單題
  const isQuizMode = questions.length > 0;

  const updateQuestion = (i: number, patch: Partial<QuizQuestion>) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    updateField("questions", next);
  };

  const addQuestion = () => {
    updateField("questions", [
      ...questions,
      { question: "", options: ["", ""], correctAnswer: 0 },
    ]);
  };

  const removeQuestion = (i: number) => {
    updateField("questions", questions.filter((_, idx) => idx !== i));
  };

  const switchToQuizMode = () => {
    // 若原本 legacy 有 options，轉換為第一題
    const seeded: QuizQuestion[] = options.length > 0
      ? [{
          question: (config.question as string) || "題目 1",
          options: options.map((o) => o.text || ""),
          correctAnswer: Math.max(0, options.findIndex((o) => o.correct)),
        }]
      : [{ question: "題目 1", options: ["選項 A", "選項 B"], correctAnswer: 0 }];
    updateField("questions", seeded);
    updateField("options", []);
  };

  const switchToLegacyMode = () => {
    updateField("questions", []);
  };

  return (
    <div className="space-y-4">
      {/* 模式切換 */}
      <div className="border rounded-lg p-3 bg-accent/5 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">
            {isQuizMode ? "Quiz 測驗模式（多題連續）" : "Legacy 單題模式"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {isQuizMode
              ? `${questions.length} 題，通過率 ${Math.round((config.passingScore as number ?? 0.6) * 100)}% 通關`
              : "一題多選項，每選項可有自己的 nextPageId 分支"}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={isQuizMode ? switchToLegacyMode : switchToQuizMode}
        >
          切換至 {isQuizMode ? "單題" : "Quiz"} 模式
        </Button>
      </div>

      {isQuizMode ? (
        <QuizQuestionsEditor
          questions={questions}
          onUpdate={updateQuestion}
          onAdd={addQuestion}
          onRemove={removeQuestion}
          passingScore={(config.passingScore as number) ?? 0.6}
          onPassingScoreChange={(v) => updateField("passingScore", v)}
        />
      ) : (
        <LegacyOptionsEditor
          config={config}
          updateField={updateField}
          options={options}
          allPages={allPages}
        />
      )}

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
          <div className="min-w-0">
            <p className="text-xs">顯示解釋</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {isQuizMode
                ? "每題下方可填各題解釋"
                : "開啟後下方會出現「答題後解釋」欄位"}
            </p>
          </div>
          <Switch
            checked={config.showExplanation === true}
            onCheckedChange={(v) => updateField("showExplanation", v)}
            data-testid="switch-show-explanation"
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

      {/* 🆕 顯示解釋開啟時 → 全域解釋文字（答題後顯示，解釋正確答案的由來） */}
      {config.showExplanation === true && !isQuizMode && (
        <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
          <label className="text-xs font-medium mb-2 block">答題後的解釋</label>
          <Textarea
            value={(config.explanation as string) || ""}
            onChange={(e) => updateField("explanation", e.target.value)}
            placeholder="說明正確答案的由來（答對 / 答錯後都會顯示給玩家看）"
            rows={3}
            className="text-sm"
            data-testid="config-choice-explanation"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            玩家提交答案後會看到這段解釋；個別選項也可填各自的回饋（選項下方）
          </p>
        </div>
      )}

      {/* 🆕 Quiz 模式專屬進階選項（multiple / partialCredit / rewardPerQuestion） */}
      {isQuizMode && (
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <div className="flex items-center justify-between border rounded p-2">
            <div className="flex flex-col">
              <span className="text-xs">允許多選</span>
              <span className="text-[10px] text-muted-foreground">每題可勾選多個答案</span>
            </div>
            <Switch
              checked={config.multiple === true}
              onCheckedChange={(v) => updateField("multiple", v)}
            />
          </div>
          <div className="flex items-center justify-between border rounded p-2">
            <div className="flex flex-col">
              <span className="text-xs">部分分數</span>
              <span className="text-[10px] text-muted-foreground">半對給 50% 分數</span>
            </div>
            <Switch
              checked={config.partialCredit === true}
              onCheckedChange={(v) => updateField("partialCredit", v)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">每題答對獎勵</label>
            <Input
              type="number"
              value={(config.rewardPerQuestion as number | undefined) ?? 10}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                updateField("rewardPerQuestion", Number.isFinite(n) && n >= 0 ? n : 10);
              }}
              min={0}
              className="h-8"
              placeholder="10"
            />
          </div>
        </div>
      )}

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// Quiz 模式（questions 陣列）編輯子元件
function QuizQuestionsEditor({
  questions,
  onUpdate,
  onAdd,
  onRemove,
  passingScore,
  onPassingScoreChange,
}: {
  questions: QuizQuestion[];
  onUpdate: (i: number, patch: Partial<QuizQuestion>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  passingScore: number;
  onPassingScoreChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">題目列表</label>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="w-3 h-3 mr-1" />新增題目
        </Button>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="border rounded p-3 space-y-2 bg-background">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs shrink-0">第 {qi + 1} 題</Badge>
            <Input
              value={q.question}
              onChange={(e) => onUpdate(qi, { question: e.target.value })}
              placeholder="輸入題目"
              className="flex-1 h-8"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(qi)}>
              <XIcon className="w-3 h-3" />
            </Button>
          </div>

          <div className="space-y-1 pl-6">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex gap-2 items-center">
                <input
                  type="radio"
                  checked={q.correctAnswer === oi}
                  onChange={() => onUpdate(qi, { correctAnswer: oi })}
                  className="shrink-0"
                />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const nextOpts = [...q.options];
                    nextOpts[oi] = e.target.value;
                    onUpdate(qi, { options: nextOpts });
                  }}
                  placeholder={`選項 ${oi + 1}`}
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    const nextOpts = q.options.filter((_, i) => i !== oi);
                    const nextCorrect = q.correctAnswer > oi ? q.correctAnswer - 1
                      : q.correctAnswer === oi ? 0 : q.correctAnswer;
                    onUpdate(qi, { options: nextOpts, correctAnswer: nextCorrect });
                  }}
                  disabled={q.options.length <= 2}
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => onUpdate(qi, { options: [...q.options, ""] })}
            >
              <Plus className="w-3 h-3 mr-1" />新增選項
            </Button>
          </div>

          <Input
            value={q.explanation || ""}
            onChange={(e) => onUpdate(qi, { explanation: e.target.value })}
            placeholder="題目解釋（可選）"
            className="h-8 text-xs"
          />
        </div>
      ))}

      <div className="flex items-center gap-2 border rounded p-2">
        <label className="text-xs text-muted-foreground shrink-0">通過率</label>
        <Input
          type="number"
          value={Math.round(passingScore * 100)}
          onChange={(e) => {
            const pct = parseInt(e.target.value, 10);
            if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
              onPassingScoreChange(pct / 100);
            }
          }}
          min={0}
          max={100}
          className="h-8 w-20"
        />
        <span className="text-xs text-muted-foreground">% 的題目答對才算通過</span>
      </div>
    </div>
  );
}

// Legacy 單題模式編輯子元件
function LegacyOptionsEditor({
  config,
  updateField,
  options,
  allPages,
}: {
  config: Record<string, unknown>;
  updateField: (field: string, value: unknown) => void;
  options: ChoiceOption[];
  allPages?: Array<{ id: string; pageType: string; customName?: string | null }>;
}) {
  return (
    <>
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
                value={opt.explanation || ""}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i] = { ...newOptions[i], explanation: e.target.value };
                  updateField("options", newOptions);
                }}
                placeholder="選項解釋（玩家選中時顯示，可選）"
                className="h-8 text-xs"
              />
              {/* 🆕 每選項獨立 nextPageId：讓「答對 → 主線」、「答錯 → 懲罰頁」成為可能 */}
              {allPages && allPages.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground shrink-0">
                    選此項跳至:
                  </label>
                  <select
                    value={opt.nextPageId || "_default"}
                    onChange={(e) => {
                      const newOptions = [...options];
                      const v = e.target.value;
                      newOptions[i] = {
                        ...newOptions[i],
                        nextPageId: v === "_default" ? undefined : v,
                      };
                      updateField("options", newOptions);
                    }}
                    className="flex-1 h-7 text-xs rounded border bg-background px-2"
                  >
                    <option value="_default">（預設 — 依全域 nextPageId）</option>
                    {allPages.map((p, idx) => {
                      const label = p.customName?.trim() || p.pageType;
                      return (
                        <option key={p.id} value={p.id}>
                          #{idx + 1} {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
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
    </>
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
