// 🎟️ 訪客身分（2026-09-22 玩家動線優化 Phase 1）
//
// 業主需求：「善用不用登入的權限，讓使用者可以快速不用註冊就可以玩」
// 做法：玩家進入遊玩類頁面時，若尚未登入 → 背景建立 Firebase 匿名身分，
//       不再擋登入牆。後端 isAuthenticated 本來就接受匿名 token。
//
// 只在遊玩類頁面觸發（由 GuestGate 呼叫），一般瀏覽頁不建身分，
// 避免每個看官網的訪客都在 users 表產生一筆資料。

import { auth, signInAnonymously } from "@/lib/firebase";

/** 訪客暱稱 localStorage key（與既有大廳暱稱框、session 建立共用） */
export const GUEST_NAME_KEY = "anonymous_player_name";

/** 產生預設訪客暱稱，例如「探險家4271」（符合 validatePlayerName 2-20 字規則） */
export function generateGuestName(rand: () => number = Math.random): string {
  const suffix = Math.floor(rand() * 9000) + 1000;
  return `探險家${suffix}`;
}

/** 讀取訪客暱稱；沒有就產生一個並記住（同一支手機固定同一個名字） */
export function ensureGuestName(): string {
  try {
    const stored = localStorage.getItem(GUEST_NAME_KEY)?.trim();
    if (stored) return stored;
    const name = generateGuestName();
    localStorage.setItem(GUEST_NAME_KEY, name);
    return name;
  } catch {
    // 隱私模式可能拒寫 → 仍回傳一個可用名字
    return generateGuestName();
  }
}

/**
 * 送給伺服器的訪客暱稱（組隊 / 賽事顯示用）：只有訪客才送，正式帳號用自己的名字
 * 🐛 2026-09-22：正式帳號不被舊的訪客暱稱蓋掉（自 useTeamLobby 抽出共用，2026-09-23）
 */
export function guestNameForServer(isGuest: boolean): string | undefined {
  if (!isGuest) return undefined;
  try {
    return localStorage.getItem(GUEST_NAME_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

let inflight: Promise<void> | null = null;

/**
 * 確保目前有玩家身分：已登入（含既有訪客）直接返回；未登入 → 匿名登入。
 * - 先等 authStateReady：避免 Firebase 還在還原既有登入時就誤建新訪客
 * - 單一執行中 promise：多個元件同時呼叫只會登入一次
 */
export function ensureGuestIdentity(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    await auth.authStateReady();
    if (auth.currentUser) return;
    await signInAnonymously();
    ensureGuestName();
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
