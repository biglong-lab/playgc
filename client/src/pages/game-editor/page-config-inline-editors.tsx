// 頁面設定編輯器 — 內嵌子元件（TextCard、Dialogue、GPS、QR、Choice、Video）
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
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
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// ====== 對話編輯器 ======

export function DialogueEditor({ config, updateField, MediaUploadButton }: BaseEditorProps & WithMediaUpload) {
  const character = (config.character || {}) as Record<string, unknown>;
  const messages = (config.messages || []) as Array<Record<string, unknown>>;

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
        <label className="text-sm font-medium mb-2 block">角色頭像 (可選)</label>
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
      <div>
        <label className="text-sm font-medium mb-2 block">對話內容</label>
        <Textarea
          value={(messages[0]?.text as string) || ""}
          onChange={(e) => updateField("messages", [{ text: e.target.value }])}
          placeholder="對話內容..."
          rows={4}
          data-testid="config-dialogue"
        />
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
            <div key={i} className="flex gap-2 items-center">
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
      {Boolean(config.videoUrl) && (
        <div>
          <label className="text-sm font-medium mb-2 block">預覽</label>
          <video
            src={config.videoUrl as string}
            controls
            className="w-full rounded-lg max-h-48"
            data-testid="video-preview"
          />
        </div>
      )}
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
