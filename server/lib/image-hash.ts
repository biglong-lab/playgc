// 📸 Perceptual Hash (dHash) — 計算圖片的 64-bit 視覺指紋
//
// 用途：
//   給定 Cloudinary URL，回傳 16 hex chars 的 dHash 字串
//   兩張相似圖片（同景點、不同角度/光線）會有相近 hash
//   兩張完全不同圖片的 hash 距離會很大
//
// 演算法（dHash）：
//   1. 用 sharp 把圖縮成 9x8 灰階
//   2. 對每行相鄰像素做比較：左 > 右 = 1，否則 = 0
//   3. 8 行 × 8 bit = 64 bits = 16 hex chars
//
// 為何 dHash 不用 pHash（DCT-based）：
//   - dHash 計算快 5-10 倍（不用 DCT）
//   - 對「縮放、亮度、輕微角度」依然 robust
//   - 對遊戲場景的辨識足夠（玩家拍古蹟、地標）
import sharp from "sharp";

/**
 * 從圖片 URL 計算 dHash（64-bit）
 *
 * @param imageUrl Cloudinary 或其他可下載的 URL
 * @param timeoutMs 下載超時（預設 10 秒）
 * @returns 16 hex chars 字串，下載失敗回 null
 */
export async function computeImageHash(
  imageUrl: string,
  timeoutMs = 10_000,
): Promise<string | null> {
  try {
    // 下載圖片
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    const res = await fetch(imageUrl, { signal: abort.signal }).finally(() =>
      clearTimeout(timer),
    );
    if (!res.ok) {
      console.warn(`[image-hash] 下載失敗 ${res.status}: ${imageUrl}`);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // 縮成 9x8 灰階（dHash 標準尺寸：寬 +1 才能做相鄰比較）
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 計算 dHash：每行 8 個 bit（左 > 右 = 1）
    let bits = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        bits += left > right ? "1" : "0";
      }
    }

    // 轉 16 hex chars
    return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[image-hash] 下載超時: ${imageUrl}`);
    } else {
      console.error("[image-hash] 計算失敗:", err);
    }
    return null;
  }
}

/**
 * 計算兩個 hex hash 的 Hamming 距離（不同 bit 數量）
 *
 * @param a 16 hex chars
 * @param b 16 hex chars
 * @returns 0-64（0=完全相同，64=完全相反）
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * 是否視為「相似圖片」
 * 距離 < 5 → 同景點不同角度（命中 cache）
 * 距離 5-10 → 部分相似
 * 距離 > 10 → 不同景物
 */
export function isSimilarHash(a: string, b: string, threshold = 5): boolean {
  return hammingDistance(a, b) < threshold;
}
