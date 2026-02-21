// 頁面設定編輯器 - 各種頁面類型的設定表單（主分發器）
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import ButtonConfigEditor from "./ButtonConfigEditor";
import ConditionalVerifyEditor from "./ConditionalVerifyEditor";
import TimeBombEditor from "./TimeBombEditor";
import LockEditor from "./LockEditor";
import MotionChallengeEditor from "./MotionChallengeEditor";
import VoteEditor from "./VoteEditor";
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
