// 🎨 EditableCoverImage — 可編輯封面圖片元件
//
// 功能：
//   1. 一般使用者看到：純圖片（按 objectPosition 顯示焦點）
//   2. 管理員看到：右上角「編輯封面」按鈕
//      - 點擊後進入「編輯模式」
//      - 可拖拉調整焦點位置（mouse / touch 都支援）
//      - 浮動工具列：上傳新封面 / 重設位置 / 完成
//      - 拖拉時即時預覽，按「完成」才呼叫 onSave 持久化
//
// 用在：
//   - 場域 hero banner（FieldTheme.coverImagePosition）
//   - 遊戲卡片封面（games.coverImagePosition，下一輪會接）
//
// 安全：
//   - admin 才看得到編輯按鈕（從 props 傳入 isAdmin）
//   - 後端 zod 限制 objectPosition 只能是 "X% Y%" 格式

import { useState, useRef, useCallback, type ReactNode } from "react";
import { Move, Check, X, Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { compressImageToDataUrl } from "@/lib/image-compress";
import OptimizedImage from "@/components/shared/OptimizedImage";
import {
  DEFAULT_POSITION,
  formatPosition,
  parsePosition,
  positionFromPointer,
} from "@/lib/cover-position";

interface EditableCoverImageProps {
  /** 圖片 URL（null/undefined 顯示 fallback）*/
  readonly src: string | null | undefined;
  /** 圖片 alt */
  readonly alt: string;
  /** 焦點位置 CSS object-position（例 "50% 50%"），預設置中 */
  readonly position?: string;
  /** 是否為 admin（true 顯示編輯按鈕）*/
  readonly isAdmin: boolean;
  /** 上傳端點（POST 接受 { imageData } 回傳 { url }）*/
  readonly uploadEndpoint?: string;
  /** 儲存（呼叫後端 PATCH）*/
  readonly onSave: (data: {
    src?: string;
    position?: string;
  }) => Promise<void> | void;
  /** OptimizedImage preset */
  readonly preset?: "card" | "cover" | "icon" | "thumbnail";
  /** 自訂 className（外層 div）*/
  readonly className?: string;
  /** 圖片 fallback（沒 src 時顯示）*/
  readonly fallback?: ReactNode;
  /** 圖片上方覆蓋層（漸層 / 標題等）*/
  readonly children?: ReactNode;
  /** testId 前綴 */
  readonly testId?: string;
}

// 🆕 formatPosition / parsePosition / DEFAULT_POSITION 已抽到 @/lib/cover-position
//    並有單元測試保護（避免 toFixed / clamp / NaN 邊界 case 回歸）

export default function EditableCoverImage({
  src,
  alt,
  position = DEFAULT_POSITION,
  isAdmin,
  uploadEndpoint,
  onSave,
  preset = "cover",
  className = "",
  fallback,
  children,
  testId = "editable-cover",
}: EditableCoverImageProps) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [draftPosition, setDraftPosition] = useState(position);
  const [draftSrc, setDraftSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  const effectiveSrc = draftSrc ?? src;
  const effectivePosition = editMode ? draftPosition : position;

  // ─────────────────────────────────────────────
  // 拖拉處理
  // ─────────────────────────────────────────────
  const updatePositionFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      // 🆕 改用 lib/cover-position 的 positionFromPointer（含防除零 + clamp）
      setDraftPosition(positionFromPointer(clientX, clientY, el.getBoundingClientRect()));
    },
    [],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePositionFromEvent(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || !draggingRef.current) return;
    updatePositionFromEvent(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // ─────────────────────────────────────────────
  // 上傳處理
  // ─────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadEndpoint) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "檔案太大",
        description: "請選擇 5MB 以下的圖片",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // 上傳前本地壓縮 + base64 轉換（GIF/SVG 不壓）
      const imageData = await compressImageToDataUrl(file, "cover");

      // 🐛 fetchWithAdminAuth 已自動 parse JSON 並 throw on !ok
      // 不要再呼叫 .json() 或檢查 .ok，否則會炸 "res.json is not a function"
      const data = (await fetchWithAdminAuth(uploadEndpoint, {
        method: "POST",
        body: JSON.stringify({ imageData }),
      })) as { url?: string; secure_url?: string };
      const url = data.url || data.secure_url;
      if (!url) throw new Error("伺服器未回傳圖片 URL");
      setDraftSrc(url);
      toast({ title: "✅ 上傳成功", description: "請按「完成」儲存" });
    } catch (err) {
      toast({
        title: "上傳失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // reset input 讓同一檔案可以再選一次
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─────────────────────────────────────────────
  // 儲存 / 取消
  // ─────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        src: draftSrc ?? undefined,
        position: draftPosition,
      });
      setEditMode(false);
      setDraftSrc(null);
      toast({ title: "✅ 已儲存", description: "封面已更新" });
    } catch (err) {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setDraftPosition(position);
    setDraftSrc(null);
  };

  const handleResetPosition = () => {
    setDraftPosition("50% 50%");
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${
        editMode ? "cursor-move ring-2 ring-primary ring-offset-2" : ""
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid={testId}
      data-edit-mode={editMode}
    >
      {effectiveSrc ? (
        <OptimizedImage
          src={effectiveSrc}
          alt={alt}
          preset={preset}
          className="w-full h-full"
          loading="eager"
        />
      ) : (
        fallback
      )}

      {/* 焦點位置覆蓋層（OptimizedImage 沒透出 objectPosition，用 absolute img 蓋過去）
          ⚠️ 這是補救方案 — 因為 OptimizedImage 沒有 objectPosition prop
          長期應該改 OptimizedImage 支援 objectPosition */}
      {effectiveSrc && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${effectiveSrc})`,
            backgroundSize: "cover",
            backgroundPosition: effectivePosition,
            backgroundRepeat: "no-repeat",
            transition: editMode ? "none" : "background-position 0.3s ease",
          }}
          aria-hidden="true"
        />
      )}

      {/* 一般使用者覆蓋層（標題、漸層）— 編輯模式時藏起，避免擋拖拉 */}
      {!editMode && children}

      {/* 編輯模式：中央十字指示器 */}
      {editMode && effectiveSrc && (() => {
        const { x, y } = parsePosition(draftPosition);
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-10 h-10 rounded-full bg-primary/30 border-2 border-primary shadow-lg flex items-center justify-center">
              <Move className="w-5 h-5 text-white drop-shadow" />
            </div>
          </div>
        );
      })()}

      {/* Admin：編輯入口（右上角小按鈕） */}
      {isAdmin && !editMode && (
        <button
          type="button"
          onClick={() => {
            setEditMode(true);
            setDraftPosition(position);
          }}
          className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium border border-white/20 hover:bg-black/80 active:scale-95 transition-all flex items-center gap-1.5"
          data-testid={`${testId}-edit-trigger`}
          aria-label="編輯封面"
        >
          <Camera className="w-3.5 h-3.5" />
          編輯封面
        </button>
      )}

      {/* Admin：編輯模式工具列（底部） */}
      {isAdmin && editMode && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {uploadEndpoint && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                  className="gap-1.5 transition-transform active:scale-[0.95]"
                  data-testid={`${testId}-upload`}
                >
                  <Camera className="w-4 h-4" />
                  {uploading ? "上傳中..." : "換封面"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleResetPosition}
              disabled={uploading || saving}
              className="gap-1.5 transition-transform active:scale-[0.95]"
              data-testid={`${testId}-reset-position`}
              title="重設焦點到中央"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">重設位置</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              className="gap-1 text-white/90 hover:bg-white/10 active:scale-[0.95]"
              data-testid={`${testId}-cancel`}
            >
              <X className="w-4 h-4" />
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={uploading || saving}
              className="gap-1 bg-primary hover:bg-primary/90 active:scale-[0.95] shadow-lg"
              data-testid={`${testId}-save`}
            >
              <Check className="w-4 h-4" />
              {saving ? "儲存中..." : "完成"}
            </Button>
          </div>
        </div>
      )}

      {/* 編輯模式提示（頂部，admin 才看到）*/}
      {isAdmin && editMode && (
        <div
          className="absolute top-3 left-3 right-3 z-20 pointer-events-none"
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs leading-relaxed">
            <p className="font-medium">🎯 編輯封面焦點</p>
            <p className="opacity-80 mt-0.5">在圖片上點擊或拖曳以調整顯示焦點位置</p>
          </div>
        </div>
      )}
    </div>
  );
}
