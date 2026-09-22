// 🏷️ 訪客暱稱寫入 — 只有匿名身分才覆寫 users.firstName
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockWhere } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: { getUser: mockGetUser } }));
vi.mock("../db", () => ({
  db: { update: () => ({ set: () => ({ where: mockWhere }) }) },
}));

import { persistGuestDisplayName } from "../services/guest-display-name";

describe("persistGuestDisplayName", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockWhere.mockReset();
  });

  it("訪客（anonymous）→ 寫入暱稱", async () => {
    mockGetUser.mockResolvedValue({ id: "a", email: "user-a@firebase.local", firstName: null });
    await persistGuestDisplayName("a", "探險家1234", "anonymous");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("🐛 審查：LINE 帳號（custom、DB 也是假信箱）→ 不覆寫真名", async () => {
    mockGetUser.mockResolvedValue({ id: "l", email: "user-line:U1@firebase.local", firstName: "王小明" });
    await persistGuestDisplayName("l", "探險家1234", "custom");
    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("沒有暱稱 / 同名 → 不寫", async () => {
    await persistGuestDisplayName("a", "  ", "anonymous");
    mockGetUser.mockResolvedValue({ id: "a", email: "user-a@firebase.local", firstName: "小明" });
    await persistGuestDisplayName("a", "小明", "anonymous");
    expect(mockWhere).not.toHaveBeenCalled();
  });
});
