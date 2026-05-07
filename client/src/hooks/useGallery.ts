// 🖼️ useGallery — 從相簿選圖 hook
// 2026-05-07：相機統一改造的一部分
//
// 用法：
//   const { fileInputRef, openGallery, handleFileSelected } = useGallery({
//     onImage: (dataUrl, file) => { ... },
//   });
//
//   <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} hidden />
//   <button onClick={openGallery}>從相簿選</button>
//
// 用途：8 個拍照元件 + QR scan 統一相簿選圖入口
//
// 注意：
//   - 不加 capture="environment" 屬性（會逼用相機、不是相簿）
//   - max size 8MB（避免 base64 後過大）

import { useCallback, useRef } from "react";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

export interface UseGalleryOptions {
  /** 回調：圖片讀取成 dataURL 後觸發 */
  onImage?: (dataUrl: string, file: File) => void;
  /** 回調：失敗時觸發（檔案過大 / 不是圖片）*/
  onError?: (message: string) => void;
}

export interface UseGalleryResult {
  fileInputRef: React.RefObject<HTMLInputElement>;
  /** 觸發開啟相簿（程式化點擊 input）*/
  openGallery: () => void;
  /** input onChange handler */
  handleFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useGallery({ onImage, onError }: UseGalleryOptions = {}): UseGalleryResult {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openGallery = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // reset 讓同一個檔可重選
      event.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        onError?.("請選擇圖片檔");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        onError?.(`圖片過大（${(file.size / 1024 / 1024).toFixed(1)}MB）、上限 8MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (dataUrl) onImage?.(dataUrl, file);
      };
      reader.onerror = () => {
        onError?.("讀取檔案失敗");
      };
      reader.readAsDataURL(file);
    },
    [onImage, onError],
  );

  return { fileInputRef, openGallery, handleFileSelected };
}
