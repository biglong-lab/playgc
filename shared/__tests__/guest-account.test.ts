import { describe, it, expect } from "vitest";
import { isGuestAccount } from "../lib/guest-account";

describe("isGuestAccount", () => {
  it("匿名訪客（假信箱、隨機 uid）→ 是", () => {
    expect(isGuestAccount({ id: "rZuY6rAbc123", email: "user-rZuY6rAbc123@firebase.local" })).toBe(true);
  });

  it("LINE 帳號（假信箱但 uid 是 line:）→ 不是", () => {
    expect(isGuestAccount({ id: "line:U12345", email: "user-line:U12345@firebase.local" })).toBe(false);
  });

  it("Google / Email 帳號（真信箱）→ 不是", () => {
    expect(isGuestAccount({ id: "abc", email: "someone@gmail.com" })).toBe(false);
  });

  it("查無使用者 → 不是（不誤擋）", () => {
    expect(isGuestAccount(null)).toBe(false);
  });
});
