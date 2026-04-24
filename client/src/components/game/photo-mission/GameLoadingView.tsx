// ⏳ 共用載入畫面 — 替代散落各元件的 spinner + 文字組合
//
// 比原本 UploadingView 更豐富：
//   - 可傳遞具體進度（N/M）
//   - 可傳遞預估時間
//   - 全螢幕沉浸式
//
// 使用場景：
//   - 上傳照片中
//   - 合成紀念照中
//   - AI 驗證中
//   - MediaPipe 模型載入中

import { Loader2 } from "lucide-react";

export interface GameLoadingViewProps {
  /** 主標題，如「上傳照片中」「AI 驗證中」 */
  title: string;
  /** 副文字（具體狀態）*/
  subtitle?: string;
  /** 進度數字（如 3/5）*/
  current?: number;
  total?: number;
  /** 預估時間文字（「通常 2-5 秒」）*/
  estimatedTime?: string;
  /** 彩色進度條（0-100，未指定則不顯示）*/
  percent?: number;
  /** 額外內容（如跳過按鈕）*/
  children?: React.ReactNode;
  testId?: string;
}

export default function GameLoadingView({
  title,
  subtitle,
  current,
  total,
  estimatedTime,
  percent,
  children,
  testId = "game-loading-view",
}: GameLoadingViewProps) {
  return (
    <div
      className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center p-6 gap-5"
      data-testid={testId}
    >
      {/* 大型旋轉 icon */}
      <Loader2 className="w-16 h-16 text-primary animate-spin" />

      {/* 主標題 */}
      <div className="text-center space-y-2">
        <p className="text-2xl font-bold">{title}</p>
        {subtitle && (
          <p className="text-sm text-primary font-medium">{subtitle}</p>
        )}
      </div>

      {/* 數字進度 */}
      {current !== undefined && total !== undefined && (
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-center text-sm text-muted-foreground">
            <span>
              <span className="font-number font-bold text-foreground">
                {current}
              </span>{" "}
              / {total}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(100, (current / total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 百分比進度條（無 current/total 時用）*/}
      {percent !== undefined && current === undefined && (
        <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}

      {/* 預估時間 */}
      {estimatedTime && (
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {estimatedTime}
        </p>
      )}

      {/* 額外內容（跳過按鈕等）*/}
      {children}
    </div>
  );
}
