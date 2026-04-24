// 🏆 Client-side 紀念卡生成 — 純 canvas，100% 不靠 server
//
// 為什麼要 client 生成？
//   原本走 /api/cloudinary/composite-photo 把圖片+文字合成到 Cloudinary transformation URL
//   問題：
//     1. Cloudinary fetch mode 抓 SVG 有機率失敗
//     2. transformation URL 語法錯誤會生成無效 URL（看起來像破圖）
//     3. Free plan 超量 → API 拒絕
//     4. 網路不穩 → request hang
//
// client 端 canvas 繪製：永遠成功，base64 data URL 直接可用

export interface AchievementCardParams {
  fieldName: string;
  gameTitle: string;
  playerName?: string;
  score: number;
  subtitle?: string; // 如「章節完成」「任務完成」
  primaryColor?: string; // 預設 CHITO 橘
}

/**
 * 生成紀念卡（正方形 1080x1080 JPEG）
 * 用 canvas 繪製：漸層背景 + 標題 + 遊戲名 + 大分數
 */
export async function createAchievementCard(
  params: AchievementCardParams,
): Promise<string> {
  const {
    fieldName,
    gameTitle,
    playerName = "挑戰者",
    score,
    subtitle = "任務完成",
    primaryColor = "#ea580c",
  } = params;

  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context 無法建立");

  // ═══ 漸層背景 ═══
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, darkenColor(primaryColor, 0.35));
  grad.addColorStop(0.5, darkenColor(primaryColor, 0.15));
  grad.addColorStop(1, primaryColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ═══ 裝飾圓圈（背景紋理）═══
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 6; i++) {
    const r = 200 + i * 80;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // ═══ 頂部：🏆 + 副標題 ═══
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "bold 72px -apple-system, 'Noto Sans TC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏆", W / 2, 180);

  ctx.font = "600 48px -apple-system, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(subtitle, W / 2, 280);

  // ═══ 中央：遊戲名（可能會換行）═══
  ctx.font = "bold 56px -apple-system, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "white";
  const lines = wrapText(ctx, gameTitle, W - 120);
  let y = 420;
  for (const line of lines.slice(0, 2)) {
    ctx.fillText(line, W / 2, y);
    y += 70;
  }

  // ═══ 分數區（超大字）═══
  const scoreY = lines.length > 1 ? 620 : 580;
  ctx.font = "bold 36px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("獲得分數", W / 2, scoreY);

  ctx.font = "bold 180px -apple-system, 'SF Pro Display', sans-serif";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 20;
  ctx.fillText(String(score), W / 2, scoreY + 140);
  ctx.shadowBlur = 0;

  // ═══ 底部：場域名 + 玩家名 + 時間 ═══
  ctx.font = "500 36px -apple-system, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(`@${fieldName}`, W / 2, 910);

  ctx.font = "400 28px -apple-system, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
  ctx.fillText(`${playerName} · ${dateStr}`, W / 2, 970);

  // ═══ CHITO logo 文字（右下小字）═══
  ctx.textAlign = "right";
  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fillText("CHITO", W - 40, H - 40);

  return canvas.toDataURL("image/jpeg", 0.92);
}

// ═══ 工具函式 ═══

function darkenColor(hex: string, ratio: number): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - ratio)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - ratio)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - ratio)));
  return `rgb(${r}, ${g}, ${b})`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of text) {
    const test = current + char;
    const { width } = ctx.measureText(test);
    if (width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
