import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkGameOwnership, requireAdminRole } from "../routes/utils";
import type { AuthenticatedRequest } from "../routes/types";

// Mock storage 模組
vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getGame: vi.fn(),
  },
}));

import { storage } from "../storage";

const mockStorage = storage as {
  getUser: ReturnType<typeof vi.fn>;
  getGame: ReturnType<typeof vi.fn>;
};

function createMockRequest(userId?: string): AuthenticatedRequest {
  return {
    user: userId ? { claims: { sub: userId } } : undefined,
  } as AuthenticatedRequest;
}

describe("checkGameOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登入使用者回傳 401", async () => {
    const req = createMockRequest();
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(false);
    expect(result.status).toBe(401);
  });

  it("找不到使用者回傳 401", async () => {
    mockStorage.getUser.mockResolvedValue(undefined);
    const req = createMockRequest("user-1");
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(false);
    expect(result.status).toBe(401);
  });

  it("找不到遊戲回傳 404", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "user-1", role: "player" });
    mockStorage.getGame.mockResolvedValue(undefined);
    const req = createMockRequest("user-1");
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(false);
    expect(result.status).toBe(404);
  });

  it("admin 使用者可以存取任何遊戲", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockStorage.getGame.mockResolvedValue({
      id: "game-1",
      creatorId: "other-user",
    });
    const req = createMockRequest("admin-1");
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(true);
  });

  it("遊戲建立者可以存取自己的遊戲", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: "creator-1",
      role: "creator",
    });
    mockStorage.getGame.mockResolvedValue({
      id: "game-1",
      creatorId: "creator-1",
    });
    const req = createMockRequest("creator-1");
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(true);
  });

  it("非建立者無法存取他人的遊戲", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: "user-1",
      role: "creator",
    });
    mockStorage.getGame.mockResolvedValue({
      id: "game-1",
      creatorId: "other-user",
    });
    const req = createMockRequest("user-1");
    const result = await checkGameOwnership(req, "game-1");

    expect(result.authorized).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe("requireAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登入使用者回傳未授權", async () => {
    const req = createMockRequest();
    const result = await requireAdminRole(req);

    expect(result.authorized).toBe(false);
  });

  it("非 admin 使用者回傳未授權", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "user-1", role: "player" });
    const req = createMockRequest("user-1");
    const result = await requireAdminRole(req);

    expect(result.authorized).toBe(false);
  });

  it("admin 使用者回傳授權", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "admin-1", role: "admin" });
    const req = createMockRequest("admin-1");
    const result = await requireAdminRole(req);

    expect(result.authorized).toBe(true);
    expect(result.user).toBeDefined();
  });
});
