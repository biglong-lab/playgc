import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        // 🔒 安全：admin / platform / revenue chunks 不 precache 到玩家裝置
        // 防止逆向工程（玩家從 PWA cache 看到所有 admin 邏輯）
        // 這些頁面只有 admin 才會載入，登入後動態 fetch 即可
        globIgnores: [
          "**/Admin*.js",
          "**/Platform*.js",
          "**/Revenue*.js",
          "**/Owner*.js",
          "**/MySubscription*.js",
        ],
        // 新 SW 立即接管：避免使用者卡在舊 JS bundle 導致 MIME / chunk load 錯誤
        skipWaiting: true,
        clientsClaim: true,
        // 清除舊的 precache，防止 /assets/*-hash.js 過時後 404 被 navigateFallback 接走
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // 遊戲核心 API — NetworkFirst（5 秒逾時後回傳快取）
          {
            urlPattern: /^\/api\/games\/[^/]+$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-games",
              expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 3600 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 章節 API — StaleWhileRevalidate（先快取再背景更新）
          {
            urlPattern: /^\/api\/games\/[^/]+\/chapters/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-chapters",
              expiration: { maxEntries: 60, maxAgeSeconds: 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 進行中 session — NetworkFirst
          {
            urlPattern: /^\/api\/sessions\/active/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-sessions",
              expiration: { maxEntries: 10, maxAgeSeconds: 30 * 60 },
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 🆕 2026-05-13 C：Background Sync — session progress 寫入
          //   玩家在訊號爛的地方（金門巷弄 / 山上 / 廟裡）寫進度時、
          //   workbox 自動 queue 到 IndexedDB、回線後 SW 背景自動重發（即使分頁關了）
          //   24 小時內未送出視為過期、避免無限累積
          {
            urlPattern: /^\/api\/sessions\/[^/]+\/progress/,
            handler: "NetworkOnly",
            method: "PATCH",
            options: {
              backgroundSync: {
                name: "chito-session-progress",
                options: {
                  maxRetentionTime: 24 * 60, // 分鐘
                },
              },
            },
          },
          // 🆕 拍照上傳也接 Background Sync（場域訊號問題救命）
          {
            urlPattern: /^\/api\/cloudinary\/(player-photo|burst-frame|composite-photo)/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "chito-photo-uploads",
                options: {
                  maxRetentionTime: 24 * 60,
                },
              },
            },
          },
          // 🚨 2026-04-24 v5 根治：圖片**完全不走 SW cache**
          // 歷史：CacheFirst 會 cache opaque response；NetworkFirst 雖自我修復，
          // 但 iOS Safari SW update 時序不穩，使用者 Cmd+R 容易看到舊版 SW + 舊 cache。
          // 決定：圖片交給瀏覽器原生 HTTP cache 管。
          //   - Cloudinary 回 Cache-Control: max-age=2592000（30 天）
          //   - 瀏覽器 disk cache 會自動用 etag 驗證
          //   - SW 不攔截 → 沒 cache 可能壞 → 永不破圖
          // 本地 /objects/uploads/ 也一樣，讓 nginx 的 Cache-Control 接手。
          //
          // 下面兩條規則以前在這裡，現在移除（沒註冊 = workbox 不攔截）
          // 若未來要加回 offline image cache，務必用 NetworkFirst + cacheableResponse.statuses: [200]
          // 且 img 必須加 crossOrigin="anonymous" 才不會存 opaque。
          // 🔧 Google Fonts cache rule 已移除（2026-05-01）
          //   原本 StaleWhileRevalidate fonts.gstatic.com，但部分網路（中華電信偶發、
          //   企業/學校 DNS）會擋 fonts.gstatic.com → workbox 拋 "no-response" 污染 console
          //   解法：讓瀏覽器自帶 HTTP cache 處理（Google Fonts 已有 max-age=31536000）
          //   字體載入失敗時 CSS @font-face 會自動 fallback 到 system font，不影響功能
        ],
        navigateFallback: "/index.html",
        // /assets/ 必須排除：當 hash 過時的 JS/CSS chunk 404 時，若 fallback 回 index.html
        // 瀏覽器載入會拋 "text/html is not a valid JavaScript MIME type"
        navigateFallbackDenylist: [/^\/api\//, /^\/objects\//, /^\/assets\//, /^\/icons\//, /\/sw\.js$/, /\/workbox-.*\.js$/],
      },
      manifest: {
        name: "CHITO",
        short_name: "CHITO",
        description: "CHITO — Real-world game platform for local venues. QR, GPS, photo and target missions.",
        theme_color: "#111827",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        // 🆕 PWA 啟動 — 走 SmartRedirect 流程（依 lastVisitedField 智能跳轉）
        // 不直接寫死 /home（無 fieldCode），避免依賴 cache 跑錯場域
        // ?launch=pwa 給 client 統計用（區分 PWA 啟動 vs 直接開網址）
        start_url: "/home?launch=pwa",
        scope: "/",
        lang: "zh-TW",
        icons: [
          { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // 🆕 2026-05-09 App Shortcuts — 長按 PWA icon 跳出快捷選單（Android / iOS 16.4+）
        //   url 帶 ?launch=pwa-shortcut-* 給 pwa-analytics 區分點擊來源
        shortcuts: [
          {
            name: "場域首頁",
            short_name: "場域",
            description: "回到上次玩過的場域",
            url: "/home?launch=pwa-shortcut-home",
            icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "對戰擂台",
            short_name: "對戰",
            description: "查看對戰時段與排行榜",
            url: "/battle?launch=pwa-shortcut-battle",
            icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "找適合的情境",
            short_name: "找情境",
            description: "3 問找出最適合的活動情境",
            url: "/find-scenario?launch=pwa-shortcut-find",
            icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
          // 🆕 2026-05-18：POS 工作站快捷（業主長按 icon → 直達 POS）
          {
            name: "POS 工作站",
            short_name: "POS",
            description: "現場掃描 / 收款 / 核銷",
            url: "/pos?launch=pwa-shortcut-pos",
            icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-toast",
          ],
          "vendor-data": ["@tanstack/react-query", "wouter", "zod"],
          "vendor-firebase": ["firebase/app", "firebase/auth"],
          "vendor-map": ["leaflet", "react-leaflet"],
          "vendor-charts": ["recharts"],
          "vendor-motion": ["framer-motion"],
          // 📦 lucide-react 整包 693 KB / gzip 125 KB
          // Tree-shake 受 lucide entry re-export 限制（全站 icon 都 tree-shake 不掉）
          // 集中打包反而對 cache 友善：一次下載後所有頁面共用
          // 改善方案需改全站 import 路徑（lucide-react/dist/esm/icons/*），工程大
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
