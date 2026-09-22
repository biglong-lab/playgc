// 🎟️ 訪客紀錄認領 — 前端流程（2026-09-22 玩家動線優化 Phase 3）
//
// 1. 結算頁（訪客）掛載 → prefetchGuestClaimTicket()：先向後端拿認領憑證存 sessionStorage
//    （先拿好，按登入時才能同步開 Google popup，不被瀏覽器擋）
// 2. 玩家按「登入保存紀錄」→ armGuestClaim()：標記「玩家要保存」
// 3. 登入成功（popup / Email / LINE 跳頁回來都一樣）→ GuestGate 呼叫 finalizeGuestClaim()
//    以正式帳號帶憑證認領 → 訪客紀錄搬到正式帳號
//
// 只有「玩家按過保存」的憑證才會被認領（armed），避免同一台手機之後有人登入就把紀錄帶走。
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";

const STORAGE_KEY = "chito_guest_claim";
/** 比後端 30 分鐘略短，留時間差 */
const TICKET_FRESH_MS = 25 * 60 * 1000;

/** 認領完成事件（結算頁保存卡據此顯示「已保存」） */
export const GUEST_CLAIMED_EVENT = "chito:guest-claimed";

interface PendingClaim {
  ticket: string;
  issuedAt: number;
  armed: boolean;
}

function read(): PendingClaim | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingClaim;
    if (!parsed?.ticket || Date.now() - parsed.issuedAt > TICKET_FRESH_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(claim: PendingClaim | null): void {
  try {
    if (claim) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(claim));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* 隱私模式：認領無法跨頁，popup 登入仍可在本頁完成 */ }
}

/** 訪客在結算頁：預先取得認領憑證（已有新鮮的就不重拿） */
export async function prefetchGuestClaimTicket(): Promise<boolean> {
  if (read()) return true;
  try {
    const res = await apiRequest("POST", "/api/me/guest-claim-ticket", {});
    const data = (await res.json()) as { ticket?: string };
    if (!data.ticket) return false;
    write({ ticket: data.ticket, issuedAt: Date.now(), armed: false });
    return true;
  } catch {
    return false;
  }
}

/** 玩家按「登入保存紀錄」：標記要認領（回傳是否有可用憑證） */
export function armGuestClaim(): boolean {
  const claim = read();
  if (!claim) return false;
  write({ ...claim, armed: true });
  return true;
}

/** 玩家取消登入 → 解除保存標記（避免同分頁之後換別人登入把紀錄帶走） */
export function disarmGuestClaim(): void {
  const claim = read();
  if (claim?.armed) write({ ...claim, armed: false });
}

/** 有待認領（玩家按過保存、憑證未過期） */
export function hasArmedGuestClaim(): boolean {
  return read()?.armed === true;
}

export type ClaimResult =
  | { ok: true; moved: Record<string, number> }
  /** retryable = 憑證仍保留（網路 / 429 / 5xx），可再試；false = 憑證已失效、已清除 */
  | { ok: false; message: string; retryable: boolean };

let inflight: Promise<ClaimResult> | null = null;

/** 以目前（正式）帳號認領；成功或憑證失效都會清除，避免重複打 */
export function finalizeGuestClaim(): Promise<ClaimResult> {
  if (inflight) return inflight;
  const claim = read();
  if (!claim?.armed) return Promise.resolve({ ok: false, message: "沒有待保存的紀錄", retryable: false });

  inflight = (async (): Promise<ClaimResult> => {
    try {
      const res = await apiRequest("POST", "/api/me/claim-guest", { ticket: claim.ticket });
      const data = (await res.json()) as { moved?: Record<string, number> };
      write(null);
      // 紀錄換了主人 → 相關查詢重抓
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/rewards"] });
      const result: ClaimResult = { ok: true, moved: data.moved ?? {} };
      window.dispatchEvent(new CustomEvent(GUEST_CLAIMED_EVENT, { detail: result }));
      return result;
    } catch (err) {
      // 🐛 2026-09-22 審查 HIGH：只有 400（憑證失效 / 身分不符）才清除；
      //   網路、429、5xx 保留憑證 → 可重試，不讓訪客紀錄因一時失敗變孤兒
      const definitive = err instanceof ApiError && err.status === 400;
      if (definitive) write(null);
      const message = err instanceof Error && err.message ? err.message : "保存紀錄失敗";
      const result: ClaimResult = { ok: false, message, retryable: !definitive };
      window.dispatchEvent(new CustomEvent(GUEST_CLAIMED_EVENT, { detail: result }));
      return result;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
