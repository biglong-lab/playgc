// 🎨 Client-side collage — 純前端用 canvas 把多張照片拼成一張
//
// 為什麼要有這個？
//   Cloudinary Multi API（GIF 合成）偶爾失敗或很慢
//   我們在 client 本來就有 5 張 base64（拍攝時存的）
//   可以立刻合成拼貼圖，不用等 server
//
// 用途：PhotoBurstFlow 拍完立刻拼好 5 張給使用者看
//      背景仍嘗試合成真 GIF（若成功再 replace）

export interface CollageOptions {
  /** 最大尺寸（長邊 px），避免 base64 太大 */
  maxSize?: number;
  /** 輸出品質（0-1，JPEG 壓縮）*/
  quality?: number;
  /** 排版模式 */
  layout?: "grid" | "horizontal" | "vertical";
}

/**
 * 把多張 base64 照片拼成一張（本地 canvas）
 * @param dataUrls base64 data URLs（通常是 canvas.toDataURL('image/jpeg') 來的）
 * @returns 合成後的 base64 data URL
 */
export async function createLocalCollage(
  dataUrls: string[],
  opts: CollageOptions = {},
): Promise<string> {
  const { maxSize = 1600, quality = 0.85, layout = "grid" } = opts;

  if (dataUrls.length === 0) {
    throw new Error("無照片可拼貼");
  }
  if (dataUrls.length === 1) {
    return dataUrls[0]; // 只有一張直接回傳
  }

  // 載入所有圖片
  const images = await Promise.all(
    dataUrls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        }),
    ),
  );

  // 決定排版（2x2、3x2、5x1 等）
  const count = images.length;
  let cols: number;
  let rows: number;

  if (layout === "horizontal") {
    cols = count;
    rows = 1;
  } else if (layout === "vertical") {
    cols = 1;
    rows = count;
  } else {
    // grid: 自動決定
    if (count <= 2) {
      cols = count;
      rows = 1;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else {
      cols = 4;
      rows = Math.ceil(count / 4);
    }
  }

  // 以第一張的比例為基準
  const first = images[0];
  const baseRatio = first.naturalWidth / first.naturalHeight;

  // 每格大小（以 maxSize 限制總寬度）
  let cellW = Math.floor(maxSize / cols);
  let cellH = Math.floor(cellW / baseRatio);

  // 若總高過大，再以總高限制
  if (cellH * rows > maxSize) {
    cellH = Math.floor(maxSize / rows);
    cellW = Math.floor(cellH * baseRatio);
  }

  const canvasW = cellW * cols;
  const canvasH = cellH * rows;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context 無法建立");

  // 黑色背景（有空格子時）
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 畫每張圖（cover fit — 填滿格子，可能裁切）
  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    drawImageCover(ctx, img, x, y, cellW, cellH);
  });

  return canvas.toDataURL("image/jpeg", quality);
}

/** 畫圖用 cover fit（object-fit: cover 效果）*/
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const destRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > destRatio) {
    // 圖比較寬 → 水平裁切
    sw = img.naturalHeight * destRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else if (imgRatio < destRatio) {
    // 圖比較高 → 垂直裁切
    sh = img.naturalWidth / destRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
