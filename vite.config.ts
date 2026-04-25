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
          // Google Fonts — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
        start_url: "/home",
        scope: "/",
        lang: "zh-TW",
        icons: [
          { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
