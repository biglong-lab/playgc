// 頁面設定編輯器 - 各種頁面類型的設定表單（主分發器）
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import ButtonConfigEditor from "./ButtonConfigEditor";
import ConditionalVerifyEditor from "./ConditionalVerifyEditor";
import TimeBombEditor from "./TimeBombEditor";
import LockEditor from "./LockEditor";
import MotionChallengeEditor from "./MotionChallengeEditor";
import VoteEditor from "./VoteEditor";
import { RewardsSection, LocationSettingsSection } from "./page-config-shared";
import type { PageConfigEditorProps } from "./types";

export default function PageConfigEditor({
  page,
  allPages,
  gameId,
  handleMediaUpload,
  isUploading,
  onUpdate
}: PageConfigEditorProps) {
  const config = page.config as any;

  const updateField = (field: string, value: any) => {
    onUpdate({ ...config, [field]: value });
  };

  // 共用的媒體上傳按鈕
  const MediaUploadButton = ({ id, accept, onUploaded }: {
    id: string;
    accept: string;
    onUploaded: (url: string) => void;
  }) => (
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
              value={config.requiredHits || 5}
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
              value={config.timeLimit || 60}
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
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="請拍攝..."
              rows={4}
              data-testid="config-instruction"
            />
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
              value={config.question || ""}
              onChange={(e) => updateField("question", e.target.value)}
              placeholder="輸入問題"
              data-testid="config-question"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">正確答案 (多個用逗號分隔)</label>
            <Input
              value={(config.answers || []).join(", ")}
              onChange={(e) => updateField("answers", e.target.value.split(",").map((s: string) => s.trim()))}
              placeholder="答案1, 答案2"
              data-testid="config-answers"
            />
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

// ====== 內嵌輕量子元件 ======

interface MediaUploadButtonProps {
  id: string;
  accept: string;
  onUploaded: (url: string) => void;
}

// 文字卡編輯器
function TextCardEditor({ config, updateField, gameId, MediaUploadButton }: {
  config: any;
  updateField: (field: string, value: any) => void;
  gameId: string;
  MediaUploadButton: React.FC<MediaUploadButtonProps>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="輸入標題"
          data-testid="config-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">內容</label>
        <Textarea
          value={config.content || ""}
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
            value={config.backgroundImage || ""}
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
        {config.backgroundImage && (
          <div className="mt-2">
            <img
              src={config.backgroundImage}
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
          value={config.layout || "center"}
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
            value={config.backgroundAudio || ""}
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
        {config.backgroundAudio && (
          <div className="mt-2">
            <audio
              src={config.backgroundAudio}
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

// 對話編輯器
function DialogueEditor({ config, updateField, MediaUploadButton }: {
  config: any;
  updateField: (field: string, value: any) => void;
  MediaUploadButton: React.FC<MediaUploadButtonProps>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">角色名稱</label>
        <Input
          value={config.character?.name || ""}
          onChange={(e) => updateField("character", { ...config.character, name: e.target.value })}
          placeholder="角色名稱"
          data-testid="config-character"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">角色頭像 (可選)</label>
        <div className="flex gap-2 items-center">
          {config.character?.avatar && (
            <img
              src={config.character.avatar}
              alt="頭像"
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <Input
            value={config.character?.avatar || ""}
            onChange={(e) => updateField("character", { ...config.character, avatar: e.target.value })}
            placeholder="https://..."
            data-testid="config-avatar-url"
            className="flex-1"
          />
          <MediaUploadButton
            id="dialogue-avatar-upload"
            accept="image/*"
            onUploaded={(url) => updateField("character", { ...config.character, avatar: url })}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">對話內容</label>
        <Textarea
          value={config.messages?.[0]?.text || ""}
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

// GPS 任務編輯器
function GpsMissionEditor({ config, updateField, gameId }: {
  config: any;
  updateField: (field: string, value: any) => void;
  gameId: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">目標位置</label>
        <LocationPicker
          lat={config.targetLocation?.lat || 25.033}
          lng={config.targetLocation?.lng || 121.565}
          radius={config.radius || 50}
          onChange={(lat, lng) => updateField("targetLocation", { lat, lng })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">緯度</label>
          <Input
            type="number"
            step="0.0001"
            value={config.targetLocation?.lat || 25.033}
            onChange={(e) => updateField("targetLocation", {
              ...config.targetLocation,
              lat: parseFloat(e.target.value)
            })}
            data-testid="config-lat"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">經度</label>
          <Input
            type="number"
            step="0.0001"
            value={config.targetLocation?.lng || 121.565}
            onChange={(e) => updateField("targetLocation", {
              ...config.targetLocation,
              lng: parseFloat(e.target.value)
            })}
            data-testid="config-lng"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">觸發半徑 (公尺)</label>
        <Input
          type="number"
          value={config.radius || 50}
          onChange={(e) => updateField("radius", parseInt(e.target.value) || 50)}
          min={5}
          max={500}
          data-testid="config-radius"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">任務指示</label>
        <Textarea
          value={config.instruction || ""}
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

// QR 掃描編輯器
function QrScanEditor({ config, updateField, gameId, page }: {
  config: any;
  updateField: (field: string, value: any) => void;
  gameId: string;
  page: { id: string };
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">驗證代碼 (主要)</label>
        <Input
          value={config.primaryCode || config.qrCodeId || ""}
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
          value={config.validationMode || "case_insensitive"}
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
          value={(config.alternativeCodes || []).join("\n")}
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
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="請掃描檢查站的 QR Code"
          rows={2}
          data-testid="config-qr-instruction"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">位置提示 (可選)</label>
        <Input
          value={config.locationHint || ""}
          onChange={(e) => updateField("locationHint", e.target.value)}
          placeholder="在大門旁邊的柱子上"
          data-testid="config-location-hint"
        />
      </div>
      <QRCodeGenerator
        qrCodeId={config.primaryCode || config.qrCodeId || ""}
        gameId={gameId}
        pageId={page.id}
      />
      <RewardsSection config={config} updateField={updateField} gameId={gameId} />
      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}

// 選擇題驗證編輯器
function ChoiceVerifyEditor({ config, updateField }: {
  config: any;
  updateField: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">問題</label>
        <Input
          value={config.question || ""}
          onChange={(e) => updateField("question", e.target.value)}
          placeholder="輸入問題"
          data-testid="config-choice-question"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">選項設定</label>
        <div className="space-y-2">
          {(config.options || []).map((opt: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={opt.text || ""}
                onChange={(e) => {
                  const newOptions = [...config.options];
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
                  const newOptions = [...config.options];
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
              updateField("options", [...(config.options || []), { text: "", correct: false }]);
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

// 影片編輯器
function VideoEditor({ config, updateField, MediaUploadButton }: {
  config: any;
  updateField: (field: string, value: any) => void;
  MediaUploadButton: React.FC<MediaUploadButtonProps>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">影片 URL</label>
        <div className="flex gap-2">
          <Input
            value={config.videoUrl || ""}
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
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="影片標題"
          data-testid="config-video-title"
        />
      </div>
      {config.videoUrl && (
        <div>
          <label className="text-sm font-medium mb-2 block">預覽</label>
          <video
            src={config.videoUrl}
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
