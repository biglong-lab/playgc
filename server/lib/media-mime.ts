// 🔒 媒體上傳 magic-byte 驗證
//
// 背景：各上傳端點原本只驗 data URL 前綴（data:image/...），
// 前綴是 client 自己宣稱的、可偽造 — 惡意內容可掛 image 前綴繞過。
// 本檔解碼 base64 開頭位元組、比對真實檔案簽名（magic bytes），
// 在 cloudinary.ts 四個上傳關卡點（uploadImage/Video/Audio/ImageWithTag）統一強制。
//
// 設計原則：
// - 非 data URL（http URL、publicId 等 server 端自產來源）直接放行（信任邊界在 client base64）
// - 白名單制：認不出簽名 = 拒絕
// - SVG 屬文字格式無 magic bytes、僅接受 <svg / <?xml 開頭（跨域 <img> 載入不執行 script、風險可接受）

export type MediaCategory = "image" | "video" | "audio";

export class MediaTypeMismatchError extends Error {
  constructor(expected: MediaCategory, detected: string) {
    super(`檔案內容與宣稱類型不符（宣稱 ${expected}、實際 ${detected}）`);
    this.name = "MediaTypeMismatchError";
  }
}

/** 解出 data URL 的 base64 內文開頭位元組（最多 takeBytes 個） */
function decodeHeadBytes(dataUrl: string, takeBytes = 48): Buffer | null {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return null;
  const head64 = dataUrl.slice(commaIdx + 1, commaIdx + 1 + Math.ceil((takeBytes * 4) / 3) + 4);
  try {
    const buf = Buffer.from(head64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Buffer, text: string, offset = 0): boolean {
  return startsWith(buf, text.split("").map((c) => c.charCodeAt(0)), offset);
}

/** ISO-BMFF（mp4/mov/heic/avif/m4a 家族）：offset 4 是 "ftyp" */
function isoBmffBrand(buf: Buffer): string | null {
  if (!ascii(buf, "ftyp", 4)) return null;
  return buf.slice(8, 12).toString("ascii").trim().toLowerCase();
}

const IMAGE_BRANDS = ["heic", "heix", "heif", "hevc", "mif1", "msf1", "avif", "avis"];
const AUDIO_BRANDS = ["m4a"];

/** 依 magic bytes 偵測媒體大類；認不出回 "unknown" */
export function detectMediaCategory(buf: Buffer): MediaCategory | "unknown" {
  // --- image ---
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image"; // JPEG
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return "image"; // PNG
  if (ascii(buf, "GIF8")) return "image"; // GIF
  if (ascii(buf, "RIFF") && ascii(buf, "WEBP", 8)) return "image"; // WebP
  if (ascii(buf, "BM")) return "image"; // BMP
  const head = buf.slice(0, 24).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image"; // SVG

  // --- ISO-BMFF 家族（依 brand 分流 image/audio/video）---
  const brand = isoBmffBrand(buf);
  if (brand) {
    if (IMAGE_BRANDS.some((b) => brand.startsWith(b))) return "image";
    if (AUDIO_BRANDS.some((b) => brand.startsWith(b))) return "audio";
    return "video"; // mp4/mov/3gp 等其餘 brand
  }

  // --- video ---
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return "video"; // WebM/MKV
  if (ascii(buf, "RIFF") && ascii(buf, "AVI ", 8)) return "video"; // AVI

  // --- audio ---
  if (ascii(buf, "ID3")) return "audio"; // MP3 (ID3 tag)
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio"; // MP3 frame sync
  if (ascii(buf, "RIFF") && ascii(buf, "WAVE", 8)) return "audio"; // WAV
  if (ascii(buf, "OggS")) return "audio"; // OGG
  if (ascii(buf, "fLaC")) return "audio"; // FLAC

  return "unknown";
}

/**
 * 驗證 data URL 的實際內容屬於預期媒體大類
 *
 * @param dataUrl  client 傳來的 base64 data URL；非 data: 開頭（server 端 URL）直接放行
 * @param expected 預期大類
 * @throws MediaTypeMismatchError 內容簽名與預期不符或無法辨識
 */
export function assertDataUrlCategory(dataUrl: string, expected: MediaCategory): void {
  if (!dataUrl.startsWith("data:")) return; // server 端自產來源（URL/publicId）不在此驗
  const buf = decodeHeadBytes(dataUrl);
  if (!buf) throw new MediaTypeMismatchError(expected, "無法解碼");
  const detected = detectMediaCategory(buf);
  if (detected !== expected) throw new MediaTypeMismatchError(expected, detected);
}
