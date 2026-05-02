import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getIdToken } from "./firebase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // 🟠 403 友善訊息：告訴使用者需要什麼權限（從 response 取或預設）
    if (res.status === 403) {
      let friendly = "此操作需要更高權限，請聯絡場域管理員升級您的角色";
      try {
        const parsed = JSON.parse(text);
        if (parsed.message) friendly = parsed.message + "（如需更多權限，請聯絡場域管理員）";
      } catch { /* 非 JSON 用預設 */ }
      throw new Error(friendly);
    }
    if (res.status === 401) {
      throw new Error("登入已失效，請重新登入");
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

// 🎬 預覽模式攔截白名單（preview 時 mutation 全部 mock pass）
//   GamePreview 進入時 set sessionStorage.previewMode='1'，unmount 清除
const AI_ENDPOINTS = [
  "/api/ai/verify-photo",
  "/api/ai/score-text",
  "/api/ai/compare-photos",
  "/api/ai/ocr-detect",
];

/** 寫入類 endpoint：preview 時跳過任何 mutation */
const WRITE_ENDPOINT_PREFIXES = [
  "/api/sessions",         // session lifecycle / progress / visits / chapter-complete
  "/api/locations",        // 地點打卡 PATCH/DELETE
  "/api/leaderboard",      // 排行榜寫入
  "/api/rewards",          // 獎勵發放
  "/api/redeem-codes",     // 兌換碼使用 / 消耗
  "/api/player/feedback",  // P11 玩家反饋（變體投票）— 實際路徑用斜線
  "/api/player/event",     // P11 事件日誌 — 實際路徑用斜線
  "/api/matches",          // 對戰場次寫入
];

function isAiEndpoint(url: string): boolean {
  return AI_ENDPOINTS.some((ep) => url.startsWith(ep));
}

function isWriteEndpoint(url: string): boolean {
  return WRITE_ENDPOINT_PREFIXES.some((p) => url.startsWith(p));
}

function isPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("previewMode") === "1";
  } catch {
    return false;
  }
}

/**
 * 🎬 預覽模式 mock response
 *   各 endpoint 期望結構不同，這裡塞所有可能欄位的 happy-path 值
 */
function makePreviewMockResponse(): Response {
  const body = {
    // 通用
    success: true,
    passed: true,
    preview: true,
    reason: "[預覽模式] AI 驗證已 mock 通過，正式上線會實際呼叫 AI",
    // verify-photo
    verified: true,
    confidence: 1.0,
    detectedObjects: ["preview-mock"],
    // ocr-detect
    detected: true,
    text: "[預覽] OCR 模擬結果",
    matchedKeywords: [],
    // compare-photos
    similar: true,
    similarity: 0.95,
    // score-text
    score: 100,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // 🎬 預覽模式攔截
  if (isPreviewMode()) {
    // 1. AI endpoint → mock pass（不打 OpenRouter / Vision，不寫 ai_usage_logs）
    if (isAiEndpoint(url)) {
      return makePreviewMockResponse();
    }
    // 2. 寫入類 mutation（POST/PATCH/DELETE）→ mock pass（不寫 sessions/locations/leaderboard...）
    //    GET 不攔截（讓預覽能讀真實資料如 game/page 內容）
    const writeMethod = method === "POST" || method === "PATCH" || method === "DELETE";
    if (writeMethod && isWriteEndpoint(url)) {
      return makePreviewMockResponse();
    }
  }

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  const doFetch = async (token: string | null) => {
    const reqHeaders = { ...headers };
    if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
    return fetch(url, {
      method,
      headers: reqHeaders,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  // 第一次：用 cached token
  let res = await doFetch(await getIdToken(false));

  // 🆕 2026-05-02：401 → force refresh token 重試一次
  //   Firebase ID token 1 小時過期，雖然 SDK 預設會 auto-refresh，
  //   但 SDK 端 cache 過期判斷與 server 端可能 race（特別是時鐘飄移），
  //   出現「cached token 看起來還沒過期但 server 認為已過期」的 401。
  //   force refresh 一次再 retry，多數情況可救回，避免讓使用者看到「登入已失效」紅卡。
  if (res.status === 401) {
    const fresh = await getIdToken(true);
    if (fresh) {
      res = await doFetch(fresh);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

/**
 * 🆕 apiRequest 的 timeout 版本 — 用 AbortController 設定超時
 *   用於長時間跑的 API（Cloudinary 上傳/合成）
 *   會自動帶 Firebase Auth token（跟 apiRequest 一樣）
 */
export async function apiRequestWithTimeout(
  method: string,
  url: string,
  data: unknown | undefined,
  timeoutMs: number,
): Promise<Response> {
  const token = await getIdToken();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: abort.signal,
    });
    await throwIfResNotOk(res);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const doFetch = async (token: string | null) => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(url, { credentials: "include", headers });
    };

    let res = await doFetch(await getIdToken(false));
    // 🆕 401 → force refresh + retry（同 apiRequest）
    if (res.status === 401) {
      const fresh = await getIdToken(true);
      if (fresh) res = await doFetch(fresh);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,   // 5 分鐘後標記為過期
      gcTime: 10 * 60 * 1000,     // 10 分鐘後清除快取
      retry: 1,                    // 網路波動時重試 1 次
      networkMode: "offlineFirst", // 離線時讓 Workbox SW 快取接管
    },
    mutations: {
      retry: false,
      networkMode: "online",       // mutations 離線時不自動重試
    },
  },
});
