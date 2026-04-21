// 遊戲編輯器共用型別
import type { Page } from "@shared/schema";

export interface DragItem {
  type: string;
  id: string;
  index: number;
}

export interface GameEvent {
  id: string;
  gameId?: string;
  name: string;
  eventType: string;
  triggerConfig: Record<string, unknown>;
  rewardConfig: Record<string, unknown>;
}

export interface PageConfigEditorProps {
  page: Page;
  allPages: Page[];
  gameId: string;
  handleMediaUpload: (file: File, type: 'video' | 'audio' | 'image') => Promise<string | null>;
  isUploading: boolean;
  onUpdate: (config: Record<string, unknown>) => void;
  /** 更新頁面 metadata（非 config 內的，例如 customName） */
  onUpdatePageMeta?: (partial: Partial<Page>) => void;
}
