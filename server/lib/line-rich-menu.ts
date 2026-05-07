// LINE Rich Menu management — Phase δ W3 D5
//
// 功能：
//   - createBookingRichMenu: 建立 6 鍵預約 rich menu
//   - generateRichMenuImage: 動態產生 2500×1686 PNG（sharp + SVG）
//   - uploadRichMenuImage: 上傳圖到 LINE
//   - setDefaultRichMenu: 設成所有訂閱者預設
//   - listRichMenus / deleteRichMenu: 管理用
//
// 6 個按鈕（postback data）：
//   1. action=booking_book      📅 我要預約
//   2. action=booking_my        🎫 我的預約
//   3. action=game_start        🎮 開始遊戲
//   4. action=points_my         ⭐ 我的點數
//   5. action=coupons_my        🎁 我的優惠券
//   6. action=help              ❓ 客服 / 說明
//
// 玩家點按鈕 → webhook 收到 type=postback、handler 處理 + reply（不扣 quota）

import sharp from "sharp";

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_DATA_API = "https://api-data.line.me/v2/bot";

const RICH_MENU_WIDTH = 2500;
const RICH_MENU_HEIGHT = 1686; // LINE 標準大尺寸
const ROWS = 2;
const COLS = 3;
const CELL_WIDTH = RICH_MENU_WIDTH / COLS;
const CELL_HEIGHT = RICH_MENU_HEIGHT / ROWS;

interface RichMenuButton {
  action: string;       // postback data
  emoji: string;
  label: string;
  hint: string;
  bgColor: string;
}

const BOOKING_BUTTONS: RichMenuButton[] = [
  { action: "booking_book", emoji: "📅", label: "預約場次", hint: "體驗活動", bgColor: "#3b82f6" },
  { action: "battle_register", emoji: "🎯", label: "水彈報名", hint: "PK 賽事", bgColor: "#ef4444" },
  { action: "game_start", emoji: "🎮", label: "開始遊戲", hint: "現場進場後", bgColor: "#10b981" },
  { action: "booking_my", emoji: "🎫", label: "我的預約", hint: "查看 / 取消", bgColor: "#8b5cf6" },
  { action: "coupons_my", emoji: "🎁", label: "我的優惠券", hint: "查看券包", bgColor: "#ec4899" },
  { action: "help", emoji: "❓", label: "客服 / 說明", hint: "問題反映", bgColor: "#6b7280" },
];

interface LineRichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: "postback"; data: string; displayText: string };
}

interface LineRichMenuPayload {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: LineRichMenuArea[];
}

/**
 * 建立 6 鍵 booking rich menu payload
 */
function buildPayload(): LineRichMenuPayload {
  const areas: LineRichMenuArea[] = [];
  BOOKING_BUTTONS.forEach((btn, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    areas.push({
      bounds: {
        x: Math.round(col * CELL_WIDTH),
        y: Math.round(row * CELL_HEIGHT),
        width: Math.round(CELL_WIDTH),
        height: Math.round(CELL_HEIGHT),
      },
      action: {
        type: "postback",
        data: `action=${btn.action}`,
        displayText: btn.label,
      },
    });
  });

  return {
    size: { width: RICH_MENU_WIDTH, height: RICH_MENU_HEIGHT },
    selected: true,
    name: "booking-main-menu",
    chatBarText: "選單",
    areas,
  };
}

/**
 * 用 SVG + sharp 產生 6 格 rich menu PNG
 *
 * 設計：
 *   - 2 列 × 3 欄
 *   - 每格 emoji（大）+ 文字標籤（小）+ hint（更小）
 *   - 純色背景（按鈕間有細分隔線）
 */
export async function generateRichMenuImage(): Promise<Buffer> {
  const cells = BOOKING_BUTTONS.map((btn, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL_WIDTH;
    const y = row * CELL_HEIGHT;
    const cx = x + CELL_WIDTH / 2;
    return `
      <rect x="${x}" y="${y}" width="${CELL_WIDTH}" height="${CELL_HEIGHT}" fill="${btn.bgColor}" />
      <text x="${cx}" y="${y + CELL_HEIGHT * 0.42}" text-anchor="middle" font-size="240" fill="white" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${btn.emoji}</text>
      <text x="${cx}" y="${y + CELL_HEIGHT * 0.68}" text-anchor="middle" font-size="100" fill="white" font-weight="bold" font-family="PingFang TC, Noto Sans TC, sans-serif">${btn.label}</text>
      <text x="${cx}" y="${y + CELL_HEIGHT * 0.82}" text-anchor="middle" font-size="50" fill="rgba(255,255,255,0.85)" font-family="PingFang TC, Noto Sans TC, sans-serif">${btn.hint}</text>
    `;
  }).join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${RICH_MENU_WIDTH}" height="${RICH_MENU_HEIGHT}" viewBox="0 0 ${RICH_MENU_WIDTH} ${RICH_MENU_HEIGHT}">
  <rect width="${RICH_MENU_WIDTH}" height="${RICH_MENU_HEIGHT}" fill="#0f172a" />
  ${cells}
  <line x1="${CELL_WIDTH}" y1="0" x2="${CELL_WIDTH}" y2="${RICH_MENU_HEIGHT}" stroke="rgba(0,0,0,0.2)" stroke-width="4" />
  <line x1="${CELL_WIDTH * 2}" y1="0" x2="${CELL_WIDTH * 2}" y2="${RICH_MENU_HEIGHT}" stroke="rgba(0,0,0,0.2)" stroke-width="4" />
  <line x1="0" y1="${CELL_HEIGHT}" x2="${RICH_MENU_WIDTH}" y2="${CELL_HEIGHT}" stroke="rgba(0,0,0,0.2)" stroke-width="4" />
</svg>`;

  // 轉 PNG（LINE 接受 jpg/png、< 1MB；2500×1686 png 約 80-200 KB）
  const buffer = await sharp(Buffer.from(svg))
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  return buffer;
}

// ============================================================================
// LINE API operations
// ============================================================================

function getAccessToken(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN 未設定");
  return t;
}

/**
 * 建立 rich menu（拿到 richMenuId 後續上傳圖、設 default）
 */
export async function createRichMenu(): Promise<{ richMenuId: string }> {
  const token = getAccessToken();
  const res = await fetch(`${LINE_API_BASE}/richmenu`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload()),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`createRichMenu 失敗 (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { richMenuId: data.richMenuId };
}

/**
 * 上傳圖到指定 richMenuId
 */
export async function uploadRichMenuImage(richMenuId: string, image: Buffer): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${LINE_DATA_API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/png",
      "Content-Length": String(image.length),
    },
    body: new Uint8Array(image),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`uploadRichMenuImage 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * 設成所有訂閱者預設
 */
export async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`setDefaultRichMenu 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * 一鍵建立 + 上傳 + 設預設
 */
export async function setupBookingRichMenu(): Promise<{
  richMenuId: string;
  imageBytes: number;
}> {
  const image = await generateRichMenuImage();
  const { richMenuId } = await createRichMenu();
  await uploadRichMenuImage(richMenuId, image);
  await setDefaultRichMenu(richMenuId);
  return { richMenuId, imageBytes: image.length };
}

/**
 * 列出現有 rich menus（debug / 清理用）
 */
export async function listRichMenus(): Promise<Array<{ richMenuId: string; name: string }>> {
  const token = getAccessToken();
  const res = await fetch(`${LINE_API_BASE}/richmenu/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`listRichMenus 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.richmenus || []).map((m: { richMenuId: string; name: string }) => ({
    richMenuId: m.richMenuId,
    name: m.name,
  }));
}

/**
 * 刪除 rich menu（清舊版用）
 */
export async function deleteRichMenu(richMenuId: string): Promise<void> {
  const token = getAccessToken();
  await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 給 webhook 用：知道有哪些 action
export const KNOWN_RICH_MENU_ACTIONS = BOOKING_BUTTONS.map((b) => b.action);
