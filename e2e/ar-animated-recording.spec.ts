/**
 * 🎞️ AR 動態貼圖錄影鏈驗證（CHITO 1bc34792 / 26ecaf3a）
 *
 * 驗什麼：動態貼圖（Cloudinary GIF/WebP）→ 解幀 → drawArFrame 合成 →
 *   MediaRecorder 錄出的影片「每一段都不一樣」= 貼圖真的在動。
 *   歷次複測只靠肉眼看成品，這裡改成像素指紋自動判定。
 *
 * 做法：用專案真實模組（Vite dev server 動態 import），相機來源以
 *   canvas.captureStream 產生的「靜止畫面」替代 —— 背景不動，
 *   任何幀差都只可能來自貼圖。
 *
 * 前置：dev server（npm run dev）；build 版沒有 /src 模組圖 → 自動 skip。
 */
import { test, expect } from "@playwright/test";

// 生產在用的動態貼圖（KMTI 第 39 頁「AR｜沙美五柱風獅爺」）
const ANIMATED_STICKER =
  "https://res.cloudinary.com/djdhedstt/image/upload/v1781765186/jiachun-game/games/2b2759a3-6061-47a0-b699-f9541714a550/images/eeahvlms2tn4mdi3xmz0.gif";

test("動態貼圖錄影成品是動的（非靜態第一幀）", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "需要 MediaRecorder + ImageDecoder");
  test.setTimeout(90_000);

  await page.goto("/legal");
  const modulesOk = await page
    .evaluate(() => import("/src/components/game/solo/ar-sticker/animatedSticker.ts").then(() => true))
    .catch(() => false);
  test.skip(!modulesOk, "非 dev server（無 /src 模組圖）");

  const result = await page.evaluate(async (stickerUrl) => {
    const anim = await import("/src/components/game/solo/ar-sticker/animatedSticker.ts");
    const draw = await import("/src/components/game/solo/ar-sticker/drawArFrame.ts");

    const sticker = await anim.loadAnimatedSticker(stickerUrl);
    if (!sticker) return { error: "loadAnimatedSticker 回 null（解幀失敗）" };

    // 靜止的假相機來源：畫一次純色的 canvas → captureStream → <video>
    const bg = document.createElement("canvas");
    bg.width = 640; bg.height = 480;
    const bgCtx = bg.getContext("2d")!;
    bgCtx.fillStyle = "#303030";
    bgCtx.fillRect(0, 0, bg.width, bg.height);
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true;
    video.srcObject = bg.captureStream(5);
    await video.play();
    await new Promise((r) => setTimeout(r, 300));

    const canvas = document.createElement("canvas");
    const opts = {
      stickers: [{ imageUrl: stickerUrl, position: "center" as const, sizeRatio: 1 }],
      preloadedStickers: [null],
      useFaceTracking: false,
      faceAnchor: null,
      isMirror: false,
      pageOpacity: 1,
      gestureTransform: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 },
      applyGesture: false,
    };

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
    const start = performance.now();
    rec.start();
    let raf = 0;
    const loop = () => {
      draw.drawArFrame(canvas, video, {
        ...opts,
        stickerFrames: [sticker.getFrameAt(performance.now() - start)],
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    await new Promise((r) => setTimeout(r, 2500));
    cancelAnimationFrame(raf);
    rec.stop();
    await stopped;
    sticker.close();

    // 回放成品、抽樣像素指紋
    const out = document.createElement("video");
    out.src = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    out.muted = true;
    await new Promise((res, rej) => { out.onloadedmetadata = res; out.onerror = rej; });
    const prints: string[] = [];
    for (const t of [0.2, 0.6, 1.0, 1.4, 1.8]) {
      if (t >= out.duration) break;
      out.currentTime = t;
      await new Promise((res) => { out.onseeked = res; });
      const c = document.createElement("canvas");
      c.width = 48; c.height = 48;
      c.getContext("2d")!.drawImage(out, 0, 0, 48, 48);
      prints.push(c.toDataURL().slice(-140));
    }
    return {
      frames: sticker.frames.length,
      width: sticker.width,
      samples: prints.length,
      distinct: new Set(prints).size,
    };
  }, ANIMATED_STICKER);

  expect(result.error, result.error).toBeUndefined();
  expect(result.samples ?? 0).toBeGreaterThanOrEqual(3);
  // 成品若是靜態第一幀 → distinct 會是 1
  expect(result.distinct ?? 0).toBeGreaterThan(1);
});

test("Cloudinary 縮圖轉換只作用在該作用的 URL", async ({ page }) => {
  await page.goto("/legal");
  const modulesOk = await page
    .evaluate(() => import("/src/components/game/solo/ar-sticker/animatedSticker.ts").then(() => true))
    .catch(() => false);
  test.skip(!modulesOk, "非 dev server（無 /src 模組圖）");

  const r = await page.evaluate(async () => {
    const { cloudinaryAnimatedVariant: v } = await import(
      "/src/components/game/solo/ar-sticker/animatedSticker.ts"
    );
    const base = "https://res.cloudinary.com/demo/image/upload/";
    return {
      gif: v(`${base}v1/a.gif`),
      webp: v(`${base}v1/a.webp`),
      png: v(`${base}v1/a.png`),
      already: v(`${base}w_300/v1/a.gif`),
      external: v("https://example.com/a.gif"),
    };
  });

  expect(r.gif).toContain("f_webp,fl_awebp,w_540");
  expect(r.webp).toContain("f_webp,fl_awebp,w_540");
  expect(r.png).toBeNull();     // 靜態格式不轉
  expect(r.already).toBeNull(); // 已有轉換參數不疊加
  expect(r.external).toBeNull(); // 非 Cloudinary 不動
});
