import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import cluster from "cluster";
import os from "os";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startBattleScheduler } from "./services/battle-scheduler";
import { startDormancyScheduler } from "./services/dormancy-scheduler";
import { startAchievementScheduler } from "./services/achievement-scheduler";
import { startLifecycleScheduler } from "./services/lifecycle-scheduler";
import { startMonthlyResetScheduler } from "./services/monthly-reset-scheduler";
import { startRewardRetryWorker } from "./services/reward-retry-worker";

// 型別擴充：Express 需要訪問 raw body（Stripe webhook 等）
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 頂層日誌工具（cluster primary / worker 都可用）
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const workerTag = cluster.worker ? `[w${cluster.worker.id}]` : "";
  console.log(`${formattedTime} [${source}]${workerTag} ${message}`);
}

// =============================================================================
// Cluster 模式（多核心利用）
// =============================================================================
// 啟用方式：設定環境變數 CLUSTER_WORKERS
//   CLUSTER_WORKERS=0       預設，單 process（現況）
//   CLUSTER_WORKERS=4       fork 4 個 worker（4 核心主機全榨）
//   CLUSTER_WORKERS=auto    依 os.cpus() 自動決定
// =============================================================================
function resolveWorkerCount(): number {
  const raw = process.env.CLUSTER_WORKERS;
  if (!raw || raw === "0") return 0;
  if (raw === "auto") return os.cpus().length;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const CLUSTER_WORKERS = resolveWorkerCount();

// Primary process：fork workers 後就結束（不跑 Express）
// 注意：WebSocket 連線由 Node cluster 自動分配到不同 worker，
// 同一條 WS connection 會固定在同一 worker（TCP 層 round-robin）
// 所以 session/team/match 房間廣播在單 worker 內仍可運作，無需 Redis
if (CLUSTER_WORKERS > 0 && cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} 啟動，fork ${CLUSTER_WORKERS} 個 worker`);

  // 排程器只在 primary 跑一份（避免每個 worker 都重複執行）
  startBattleScheduler();
  startDormancyScheduler();
  startAchievementScheduler();
  startLifecycleScheduler();
  startMonthlyResetScheduler();
  startRewardRetryWorker();

  for (let i = 0; i < CLUSTER_WORKERS; i++) {
    cluster.fork();
  }

  // Worker 異常退出 → 自動重啟
  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `[cluster] Worker ${worker.process.pid} 退出 (code=${code}, signal=${signal})，重新 fork`,
    );
    cluster.fork();
  });

  // Primary 不進入 Express 流程
  // 使用 process.exit 會導致 worker 一起死，所以用阻塞式等待
  // cluster module 會自動保持 primary alive
} else {
  // 以下是 worker（或單 process 模式）跑的程式碼
  startApp();
}

function startApp() {
  const workerId = cluster.worker?.id ?? "single";
  if (CLUSTER_WORKERS > 0) {
    console.log(`[cluster] Worker ${process.pid} (id=${workerId}) 啟動`);
  }

const app = express();

// 信任反向代理（Nginx），讓 rate limiter 正確取得客戶端 IP
app.set("trust proxy", 1);

const httpServer = createServer(app);

// 除錯用 health check（在所有 middleware 之前）
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const allowedOrigins: string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3333", "http://localhost:3000"];

// 安全標頭 — CSP 在 production 才啟用，dev 由 Vite 處理
const isProd = process.env.NODE_ENV === "production";

app.use(helmet({
  contentSecurityPolicy: isProd
    ? {
        useDefaults: true,
        directives: {
          // 預設：僅同源
          defaultSrc: ["'self'"],
          // Script：同源 + Firebase/Google OAuth + Recur + MediaPipe WASM
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Vite 產生的 inline script（未來可移除）
            "'wasm-unsafe-eval'", // 🆕 MediaPipe WebAssembly 需要
            "https://apis.google.com",
            "https://*.firebaseapp.com",
            "https://*.googleapis.com",
            "https://accounts.google.com",
            "https://cdn.jsdelivr.net", // 🆕 MediaPipe tasks-vision WASM from jsdelivr
          ],
          // Style：同源 + Google Fonts
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Tailwind + Radix UI
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          // 圖片：同源 + Cloudinary + Leaflet tiles + data:/blob:
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://res.cloudinary.com",
            "https://*.tile.openstreetmap.org",
            "https://unpkg.com",
            "https://*.googleusercontent.com",
          ],
          // XHR/WebSocket：同源 + Firebase + Recur + WebSocket + MediaPipe CDN
          connectSrc: [
            "'self'",
            "https://*.firebaseapp.com",
            "https://*.googleapis.com",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://www.googleapis.com",
            "https://storage.googleapis.com", // 🆕 MediaPipe face_landmarker.task model
            "https://cdn.jsdelivr.net", // 🆕 MediaPipe WASM fetch
            "https://api.recur.tw",
            "wss://game.homi.cc",
            "ws://localhost:*",
          ],
          // iframe：Firebase OAuth 需要
          frameSrc: [
            "'self'",
            "https://*.firebaseapp.com",
            "https://accounts.google.com",
          ],
          // Worker：PWA service worker
          workerSrc: ["'self'", "blob:"],
          // 禁止物件（Flash 等）
          objectSrc: ["'none'"],
          // 禁止被 iframe 嵌入（已由 X-Frame-Options 覆蓋）
          frameAncestors: ["'self'"],
          // 升級到 HTTPS
          upgradeInsecureRequests: [],
        },
      }
    : false, // dev 關閉 CSP（Vite HMR）
  crossOriginEmbedderPolicy: false, // 允許載入外部資源（Cloudinary、Leaflet）
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }, // 允許 Firebase OAuth popup 回傳 postMessage
}));

app.use(cors({
  origin: (origin, callback) => {
    // 無 origin = 同源請求或非瀏覽器請求（curl、伺服器間呼叫），允許通過
    if (!origin) {
      callback(null, true);
    } else if (allowedOrigins.some((allowed) => origin === allowed)) {
      callback(null, true);
    } else {
      callback(new Error("CORS 不允許此來源"));
    }
  },
  credentials: true,
}));

app.use(cookieParser());

// === 多人併發 Rate Limit 策略（目標：撐住 500 人同時玩）===
//
// 分層設計：
// 1. 全域（本層）：IP-based 僅防 DDoS / 爬蟲，限制放寬
//    - 同場域 Wi-Fi 500 人共用一個公網 IP → 必須放得很寬
//    - 假設每人每 15 分鐘約 200 次 API（遊戲中 progress/chat 等）
//    - 500 人 × 200 次 = 100,000 次 → 上限設 50000 留安全邊際
//    - 真正的業務邏輯防刷改到 route 層用 user ID 限速
// 2. auth endpoints（下面單獨設定）：防密碼爆破，嚴格
// 3. 未來在 route 層補 per-user limit（progress / chat 等熱路徑）

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 全域 IP 限制 — 僅防 DDoS / 爬蟲，業務邏輯防刷交給 per-user rate limit
  // 壓測實測：500 人 × 每人 200 次/15min = 100,000 次 → 上限 200,000 預留 2x 邊際
  max: Number(process.env.RATE_LIMIT_MAX) || 200000,
  standardHeaders: true,
  legacyHeaders: false,
  // 健康檢查 / admin 不計入
  skip: (req) =>
    req.path === "/api/health" ||
    req.path === "/api/health/detail" ||
    req.path.startsWith("/api/admin/"),
  message: { message: "請求次數過多，請稍後再試（若為場域多人同時使用，請聯繫管理員）" },
});

// 登入端點：每 IP 每 15 分鐘 30 次（放寬自 10，同場域多人首次登入）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "登入嘗試次數過多，請稍後再試" },
});

app.use("/api/", apiLimiter);
app.use("/api/admin/login", authLimiter);
app.use("/api/admin/firebase-login", authLimiter);

// 公開健康檢查（壓力測試 / 監控工具用）—— 不經過 rate limit
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// 🆕 版本 endpoint — 讓前端比對 PWA 是否為最新 bundle，不符就強制清快取
//   GIT_SHA 由 deploy script 從 Docker build 階段注入
app.get("/api/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({
    commit: process.env.GIT_SHA || "unknown",
    buildTime: process.env.BUILD_TIME || "unknown",
    timestamp: Date.now(),
  });
});

// 詳細健康檢查（DB pool 狀態，幫助壓測觀察瓶頸）
app.get("/api/health/detail", async (_req, res) => {
  // 動態載入避免循環依賴
  const { pool } = await import("./db");
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dbPool: {
      total: pool.totalCount,      // 連線池目前連線數
      idle: pool.idleCount,        // 閒置可用連線
      waiting: pool.waitingCount,  // 等待連線的 request 數（若 > 0 代表 pool 吃緊）
      max: Number(process.env.DB_POOL_MAX) || 80, // pool 上限（與 db.ts 對齊）
    },
  });
});

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

  // log 使用頂層宣告的 _log（同名避免 refactor 影響）

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    log(`錯誤: ${status} - ${message}`, "error");
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5050", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      // 排程器：cluster 模式已由 primary 執行，此處只在單 process 模式啟動
      if (CLUSTER_WORKERS === 0) {
        startBattleScheduler();
        startDormancyScheduler();
        startAchievementScheduler();
        startLifecycleScheduler();
        startMonthlyResetScheduler();
        startRewardRetryWorker();
      }
    },
  );
})();
} // ← startApp() 結尾
