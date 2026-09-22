import { describe, it, expect, vi, beforeEach } from "vitest";

// firebase mock：auth.currentUser 可控、signInAnonymously 可觀察
const { mockAuth, mockSignInAnonymously } = vi.hoisted(() => ({
  mockAuth: {
    currentUser: null as unknown,
    authStateReady: () => Promise.resolve(),
  },
  mockSignInAnonymously: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  auth: mockAuth,
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
}));

import {
  GUEST_NAME_KEY,
  generateGuestName,
  ensureGuestName,
  ensureGuestIdentity,
} from "../guest-identity";
import { validatePlayerName } from "@shared/lib/playerDisplay";

// setup.ts 的 localStorage 是空殼 vi.fn → 這裡接上記憶體實作，才能驗證「記住暱稱」
const memory = new Map<string, string>();
function useMemoryStorage() {
  memory.clear();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => memory.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
    memory.set(k, String(v));
  });
}

describe("generateGuestName", () => {
  it("產生「探險家」+ 4 位數，且通過暱稱驗證", () => {
    expect(generateGuestName(() => 0)).toBe("探險家1000");
    expect(generateGuestName(() => 0.9999)).toBe("探險家9999");
    expect(validatePlayerName(generateGuestName()).valid).toBe(true);
  });
});

describe("ensureGuestName", () => {
  beforeEach(() => useMemoryStorage());

  it("沒有暱稱時產生並記住", () => {
    const name = ensureGuestName();
    expect(name).toMatch(/^探險家\d{4}$/);
    expect(localStorage.getItem(GUEST_NAME_KEY)).toBe(name);
  });

  it("已有暱稱時沿用，不覆蓋玩家自訂的名字", () => {
    localStorage.setItem(GUEST_NAME_KEY, "小明");
    expect(ensureGuestName()).toBe("小明");
    expect(localStorage.getItem(GUEST_NAME_KEY)).toBe("小明");
  });
});

describe("ensureGuestIdentity", () => {
  beforeEach(() => {
    useMemoryStorage();
    mockAuth.currentUser = null;
    mockSignInAnonymously.mockReset();
    mockSignInAnonymously.mockImplementation(async () => {
      mockAuth.currentUser = { uid: "anon-1", isAnonymous: true };
      return mockAuth.currentUser;
    });
  });

  it("未登入 → 匿名登入並產生暱稱", async () => {
    await ensureGuestIdentity();
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(GUEST_NAME_KEY)).toMatch(/^探險家\d{4}$/);
  });

  it("已登入（Firebase 還原既有帳號）→ 不建立新訪客", async () => {
    mockAuth.currentUser = { uid: "real-user", isAnonymous: false };
    await ensureGuestIdentity();
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("同時多次呼叫只登入一次（避免建出多個訪客帳號）", async () => {
    await Promise.all([ensureGuestIdentity(), ensureGuestIdentity(), ensureGuestIdentity()]);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("匿名登入失敗 → 拋出錯誤、之後可重試", async () => {
    mockSignInAnonymously.mockRejectedValueOnce(new Error("訪客登入失敗，請重試"));
    await expect(ensureGuestIdentity()).rejects.toThrow("訪客登入失敗");
    await ensureGuestIdentity();
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(2);
  });
});
