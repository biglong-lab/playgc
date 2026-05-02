// 📱 LINE LIFF wrapper（W14 D1）
//
// 設計：lazy load LIFF SDK from CDN（不裝 npm 套件、避免 bundle 增加）
// 文件：https://developers.line.biz/en/docs/liff/
//
// 環境變數（前端）：
//   VITE_LIFF_ID_PLAY     - 給玩家用的 LIFF ID（對應 /liff/play/...）
//
// 注意：
//   - LIFF 必須在 LINE app 內或 LIFF browser 開啟
//   - 桌機瀏覽器訪問 → fallback 到一般 /play/:sessionId

const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface LiffSdk {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  getProfile: () => Promise<LiffProfile>;
  closeWindow: () => void;
  ready: Promise<void>;
}

declare global {
  interface Window {
    liff?: LiffSdk;
  }
}

let sdkLoaded: Promise<LiffSdk> | null = null;

/** Lazy load LIFF SDK from CDN */
function loadSdk(): Promise<LiffSdk> {
  if (sdkLoaded) return sdkLoaded;
  if (window.liff) return Promise.resolve(window.liff);

  sdkLoaded = new Promise<LiffSdk>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LIFF_SDK_URL}"]`);
    if (existing) {
      // 已在載入中
      const check = setInterval(() => {
        if (window.liff) {
          clearInterval(check);
          resolve(window.liff);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (window.liff) resolve(window.liff);
        else reject(new Error("LIFF SDK 載入超時"));
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.src = LIFF_SDK_URL;
    script.charset = "utf-8";
    script.onload = () => {
      if (window.liff) resolve(window.liff);
      else reject(new Error("LIFF SDK 載入後仍找不到 window.liff"));
    };
    script.onerror = () => reject(new Error("LIFF SDK 載入失敗（CDN 不可達？）"));
    document.head.appendChild(script);
  });

  return sdkLoaded;
}

export interface LiffInitResult {
  /** 是否在 LINE 環境內（LINE app / LIFF browser）*/
  isInClient: boolean;
  /** 是否已登入 */
  isLoggedIn: boolean;
  /** 使用者 profile（需登入後才有）*/
  profile: LiffProfile | null;
  /** SDK 實例（進階用）*/
  sdk: LiffSdk;
}

/**
 * 初始化 LIFF 並取得使用者狀態
 *
 * @example
 *   const { profile, isInClient } = await initLiff(import.meta.env.VITE_LIFF_ID_PLAY);
 *   if (profile) console.log(`歡迎 ${profile.displayName}`);
 */
export async function initLiff(liffId: string): Promise<LiffInitResult> {
  if (!liffId) throw new Error("liffId 必填（請設定 VITE_LIFF_ID_PLAY）");

  const sdk = await loadSdk();
  await sdk.init({ liffId });

  const isInClient = sdk.isInClient();
  const isLoggedIn = sdk.isLoggedIn();
  let profile: LiffProfile | null = null;

  if (isLoggedIn) {
    try {
      profile = await sdk.getProfile();
    } catch (err) {
      console.warn("[liff] getProfile 失敗:", err);
    }
  }

  return { isInClient, isLoggedIn, profile, sdk };
}

/**
 * 觸發 LINE 登入（如未登入）
 */
export function triggerLineLogin(sdk: LiffSdk, redirectUri?: string): void {
  if (sdk.isLoggedIn()) return;
  sdk.login({ redirectUri: redirectUri || window.location.href });
}

/**
 * 關閉 LIFF window（玩家完成遊戲後可呼叫）
 */
export function closeLiffWindow(sdk: LiffSdk): void {
  if (!sdk.isInClient()) {
    console.warn("[liff] 非 LINE app 環境、無法關閉 window");
    return;
  }
  sdk.closeWindow();
}
