// 頁面設定編輯器 - 各種頁面類型的設定表單
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Gift, MapPin, Plus, Trash2, Puzzle
} from "lucide-react";
import type { Page } from "@shared/schema";
import ItemRewardPicker from "@/components/ItemRewardPicker";
import LocationPicker from "@/components/LocationPicker";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import ButtonConfigEditor from "./ButtonConfigEditor";
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

  // 獎勵設定區塊
  const RewardsSection = () => (
    <div className="pt-4 mt-4 border-t border-border">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Gift className="w-4 h-4" />
        完成獎勵
      </h4>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">獎勵分數</label>
          <Input
            type="number"
            value={config.rewardPoints || 0}
            onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 0)}
            min={0}
            max={1000}
            data-testid="config-reward-points"
          />
        </div>
        <ItemRewardPicker
          gameId={gameId}
          selectedItems={config.rewardItems || []}
          onChange={(items) => updateField("rewardItems", items)}
          maxItems={3}
        />
      </div>
    </div>
  );

  // 位置設定區塊
  const LocationSettingsSection = () => {
    const locationSettings = config.locationSettings || { enabled: false };

    const updateLocationSettings = (field: string, value: any) => {
      updateField("locationSettings", {
        ...locationSettings,
        [field]: value
      });
    };

    return (
      <div className="pt-4 mt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            地圖定位設置
          </h4>
          <Switch
            checked={locationSettings.enabled || false}
            onCheckedChange={(checked) => updateLocationSettings("enabled", checked)}
            data-testid="config-location-enabled"
          />
        </div>

        {locationSettings.enabled && (
          <div className="space-y-4 animate-in fade-in-50">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="showOnMap"
                checked={locationSettings.showOnMap !== false}
                onCheckedChange={(checked) => updateLocationSettings("showOnMap", checked)}
              />
              <label htmlFor="showOnMap" className="text-sm">在地圖上顯示標記</label>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">地點名稱</label>
              <Input
                value={locationSettings.locationName || ""}
                onChange={(e) => updateLocationSettings("locationName", e.target.value)}
                placeholder="輸入地點名稱"
                data-testid="config-location-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">緯度</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={locationSettings.latitude || ""}
                  onChange={(e) => updateLocationSettings("latitude", parseFloat(e.target.value) || null)}
                  placeholder="24.4369"
                  data-testid="config-location-lat"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">經度</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={locationSettings.longitude || ""}
                  onChange={(e) => updateLocationSettings("longitude", parseFloat(e.target.value) || null)}
                  placeholder="118.3179"
                  data-testid="config-location-lng"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">觸發範圍 (公尺)</label>
              <Input
                type="number"
                value={locationSettings.radius || 50}
                onChange={(e) => updateLocationSettings("radius", parseInt(e.target.value) || 50)}
                min={5}
                max={500}
                data-testid="config-location-radius"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">導航指示</label>
              <Input
                value={locationSettings.instructions || ""}
                onChange={(e) => updateLocationSettings("instructions", e.target.value)}
                placeholder="請前往此地點完成任務"
                data-testid="config-location-instructions"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">圖標類型</label>
              <Select
                value={locationSettings.iconType || "default"}
                onValueChange={(value) => updateLocationSettings("iconType", value)}
              >
                <SelectTrigger data-testid="config-location-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">預設</SelectItem>
                  <SelectItem value="qr">QR 掃描</SelectItem>
                  <SelectItem value="photo">拍照</SelectItem>
                  <SelectItem value="shooting">射擊</SelectItem>
                  <SelectItem value="gps">GPS 定位</SelectItem>
                  <SelectItem value="puzzle">謎題</SelectItem>
                  <SelectItem value="star">星標</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    );
  };

  switch (page.pageType) {
    case "text_card":
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
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="textcard-image-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'image');
                    if (url) {
                      updateField("backgroundImage", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('textcard-image-upload')?.click()}
                data-testid="button-upload-textcard-image"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
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
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                id="textcard-audio-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'audio');
                    if (url) {
                      updateField("backgroundAudio", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('textcard-audio-upload')?.click()}
                data-testid="button-upload-audio"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
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
          <LocationSettingsSection />
        </div>
      );

    case "dialogue":
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
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="dialogue-avatar-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'image');
                    if (url) {
                      updateField("character", { ...config.character, avatar: url });
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('dialogue-avatar-upload')?.click()}
                data-testid="button-upload-avatar"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
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
          <LocationSettingsSection />
        </div>
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
          <RewardsSection />
          <LocationSettingsSection />
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
          <RewardsSection />
          <LocationSettingsSection />
        </div>
      );

    case "gps_mission":
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
          <RewardsSection />
        </div>
      );

    case "qr_scan":
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
          <RewardsSection />
          <LocationSettingsSection />
        </div>
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
          <LocationSettingsSection />
        </div>
      );

    case "choice_verify":
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
          <LocationSettingsSection />
        </div>
      );

    case "conditional_verify":
      return <ConditionalVerifyEditor config={config} updateField={updateField} LocationSettingsSection={LocationSettingsSection} />;

    case "button":
      return (
        <div className="space-y-4">
          <ButtonConfigEditor config={config} updateField={updateField} allPages={allPages} />
          <LocationSettingsSection />
        </div>
      );

    case "video":
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
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id="video-upload-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'video');
                    if (url) {
                      updateField("videoUrl", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('video-upload-input')?.click()}
                data-testid="button-upload-video"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
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
          <LocationSettingsSection />
        </div>
      );

    case "time_bomb":
      return <TimeBombEditor config={config} updateField={updateField} LocationSettingsSection={LocationSettingsSection} />;

    case "lock":
      return <LockEditor config={config} updateField={updateField} LocationSettingsSection={LocationSettingsSection} />;

    case "motion_challenge":
      return <MotionChallengeEditor config={config} updateField={updateField} LocationSettingsSection={LocationSettingsSection} />;

    case "vote":
      return <VoteEditor config={config} updateField={updateField} LocationSettingsSection={LocationSettingsSection} />;

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

// 碎片收集編輯器
function ConditionalVerifyEditor({
  config,
  updateField,
  LocationSettingsSection
}: {
  config: any;
  updateField: (field: string, value: any) => void;
  LocationSettingsSection: () => JSX.Element;
}) {
  const fragments = config.fragments || [];

  const updateFragments = (newFragments: any[]) => {
    updateField("fragments", newFragments);
    if (config.fragmentType !== 'custom') {
      const targetCode = newFragments.map((f: any) => f.value).join('');
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

      <LocationSettingsSection />
    </div>
  );
}

// 拆彈任務編輯器
function TimeBombEditor({
  config,
  updateField,
  LocationSettingsSection
}: {
  config: any;
  updateField: (field: string, value: any) => void;
  LocationSettingsSection: () => JSX.Element;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="拆彈任務"
          data-testid="config-bomb-title"
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
          data-testid="config-bomb-time"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">任務說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="在時間內完成所有任務來拆除炸彈!"
          rows={2}
          data-testid="config-bomb-instruction"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-3 block flex items-center gap-2">
          任務列表
          <Badge variant="secondary" className="text-xs">{(config.tasks || []).length} 個任務</Badge>
        </label>
        <div className="space-y-2">
          {(config.tasks || []).map((task: any, i: number) => (
            <div key={i} className="bg-accent/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <Badge variant="outline">任務 {i + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newTasks = config.tasks.filter((_: any, idx: number) => idx !== i);
                    updateField("tasks", newTasks);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Select
                value={task.type || "tap"}
                onValueChange={(value) => {
                  const newTasks = [...config.tasks];
                  newTasks[i] = { ...newTasks[i], type: value };
                  updateField("tasks", newTasks);
                }}
              >
                <SelectTrigger data-testid={`config-task-type-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tap">快速點擊</SelectItem>
                  <SelectItem value="input">輸入答案</SelectItem>
                  <SelectItem value="choice">選擇題</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={task.question || ""}
                onChange={(e) => {
                  const newTasks = [...config.tasks];
                  newTasks[i] = { ...newTasks[i], question: e.target.value };
                  updateField("tasks", newTasks);
                }}
                placeholder="問題或說明"
                data-testid={`config-task-question-${i}`}
              />
              {task.type === "tap" && (
                <Input
                  type="number"
                  value={task.targetCount || 10}
                  onChange={(e) => {
                    const newTasks = [...config.tasks];
                    newTasks[i] = { ...newTasks[i], targetCount: parseInt(e.target.value) || 10 };
                    updateField("tasks", newTasks);
                  }}
                  placeholder="目標點擊次數"
                  data-testid={`config-task-count-${i}`}
                />
              )}
              {task.type === "input" && (
                <Input
                  value={task.answer || ""}
                  onChange={(e) => {
                    const newTasks = [...config.tasks];
                    newTasks[i] = { ...newTasks[i], answer: e.target.value };
                    updateField("tasks", newTasks);
                  }}
                  placeholder="正確答案"
                  data-testid={`config-task-answer-${i}`}
                />
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateField("tasks", [...(config.tasks || []), { type: "tap", question: "", targetCount: 10 }]);
            }}
            data-testid="button-add-task"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增任務
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">成功訊息</label>
          <Input
            value={config.successMessage || ""}
            onChange={(e) => updateField("successMessage", e.target.value)}
            placeholder="炸彈已拆除!"
            data-testid="config-bomb-success"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">失敗訊息</label>
          <Input
            value={config.failureMessage || ""}
            onChange={(e) => updateField("failureMessage", e.target.value)}
            placeholder="時間到!"
            data-testid="config-bomb-failure"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 50}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 50)}
          min={0}
          data-testid="config-bomb-points"
        />
      </div>
      <LocationSettingsSection />
    </div>
  );
}

// 密碼鎖編輯器
function LockEditor({
  config,
  updateField,
  LocationSettingsSection
}: {
  config: any;
  updateField: (field: string, value: any) => void;
  LocationSettingsSection: () => JSX.Element;
}) {
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
      <LocationSettingsSection />
    </div>
  );
}

// 體感挑戰編輯器
function MotionChallengeEditor({
  config,
  updateField,
  LocationSettingsSection
}: {
  config: any;
  updateField: (field: string, value: any) => void;
  LocationSettingsSection: () => JSX.Element;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="體感挑戰"
          data-testid="config-motion-title"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">挑戰類型</label>
        <Select
          value={config.challengeType || "shake"}
          onValueChange={(value) => updateField("challengeType", value)}
        >
          <SelectTrigger data-testid="config-motion-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shake">搖晃手機</SelectItem>
            <SelectItem value="tilt">傾斜手機</SelectItem>
            <SelectItem value="jump">跳躍 (垂直移動)</SelectItem>
            <SelectItem value="rotate">旋轉手機</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">目標值</label>
        <Input
          type="number"
          value={config.targetValue || 20}
          onChange={(e) => updateField("targetValue", parseInt(e.target.value) || 20)}
          min={1}
          max={100}
          data-testid="config-motion-target"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {config.challengeType === "shake" ? "搖晃次數" :
           config.challengeType === "tilt" || config.challengeType === "rotate" ? "傾斜角度" : "移動次數"}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
        <Input
          type="number"
          value={config.timeLimit || 30}
          onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 30)}
          min={5}
          max={120}
          data-testid="config-motion-time"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="搖晃你的手機來完成挑戰!"
          rows={2}
          data-testid="config-motion-instruction"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">成功訊息</label>
          <Input
            value={config.successMessage || ""}
            onChange={(e) => updateField("successMessage", e.target.value)}
            placeholder="挑戰成功!"
            data-testid="config-motion-success"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">失敗訊息</label>
          <Input
            value={config.failureMessage || ""}
            onChange={(e) => updateField("failureMessage", e.target.value)}
            placeholder="時間到!"
            data-testid="config-motion-failure"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints || 15}
          onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 15)}
          min={0}
          data-testid="config-motion-points"
        />
      </div>
      <LocationSettingsSection />
    </div>
  );
}

// 投票編輯器
function VoteEditor({
  config,
  updateField,
  LocationSettingsSection
}: {
  config: any;
  updateField: (field: string, value: any) => void;
  LocationSettingsSection: () => JSX.Element;
}) {
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
      <LocationSettingsSection />
    </div>
  );
}
