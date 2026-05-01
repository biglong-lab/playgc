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
  "/api/player-feedback",  // P11 玩家反饋（事件 / 變體投票）
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
  // 🎬 預覽模式攔截：AI endpoint 直接 mock pass，不發送請求
  if (isPreviewMode() && isAiEndpoint(url)) {
    return makePreviewMockResponse();
  }

  const token = await getIdToken();
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

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
    const token = await getIdToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

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
