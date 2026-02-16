// queryClient 工具函式 - 單元測試
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase 的 getIdToken
vi.mock("./firebase", () => ({
  getIdToken: vi.fn().mockResolvedValue(null),
}));

import { apiRequest, getQueryFn, queryClient } from "./queryClient";
import { getIdToken } from "./firebase";

const mockGetIdToken = vi.mocked(getIdToken);

describe("apiRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetIdToken.mockResolvedValue(null);
    global.fetch = vi.fn();
  });

  it("成功的 GET 請求", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const res = await apiRequest("GET", "/api/test");
    expect(res.ok).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
  });

  it("POST 請求帶 JSON body", async () => {
    const mockResponse = new Response("{}", { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("POST", "/api/test", { name: "foo" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "foo" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("帶 Firebase token 的請求", async () => {
    mockGetIdToken.mockResolvedValue("test-firebase-token");
    const mockResponse = new Response("{}", { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("GET", "/api/protected");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/protected",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-firebase-token",
        }),
      })
    );
  });

  it("無 token 時不帶 Authorization header", async () => {
    mockGetIdToken.mockResolvedValue(null);
    const mockResponse = new Response("{}", { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("GET", "/api/public");

    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("回傳非 ok 狀態時拋出錯誤", async () => {
    const mockResponse = new Response("Not Found", { status: 404 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/missing")).rejects.toThrow("404");
  });

  it("伺服器 500 錯誤時拋出", async () => {
    const mockResponse = new Response("Internal Server Error", { status: 500 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/error")).rejects.toThrow("500");
  });

  it("401 Unauthorized 拋出含狀態碼的錯誤", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/auth")).rejects.toThrow(
      "401: Unauthorized"
    );
  });
});

describe("getQueryFn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetIdToken.mockResolvedValue(null);
    global.fetch = vi.fn();
  });

  it("on401: throw — 401 時拋出錯誤", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });

    await expect(
      queryFn({
        queryKey: ["/api/test"],
        meta: undefined,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("401");
  });

  it("on401: returnNull — 401 時回傳 null", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "returnNull" });

    const result = await queryFn({
      queryKey: ["/api/test"],
      meta: undefined,
      signal: new AbortController().signal,
    });
    expect(result).toBeNull();
  });

  it("成功時回傳 JSON 資料", async () => {
    const data = { user: { id: "1", name: "Hung" } };
    const mockResponse = new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });

    const result = await queryFn({
      queryKey: ["/api/user"],
      meta: undefined,
      signal: new AbortController().signal,
    });
    expect(result).toEqual(data);
  });

  it("queryKey 組合成 URL", async () => {
    const mockResponse = new Response("{}", { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });

    await queryFn({
      queryKey: ["/api/games", "123", "pages"],
      meta: undefined,
      signal: new AbortController().signal,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/games/123/pages",
      expect.anything()
    );
  });

  it("帶 Firebase token", async () => {
    mockGetIdToken.mockResolvedValue("my-token");
    const mockResponse = new Response("{}", { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });

    await queryFn({
      queryKey: ["/api/test"],
      meta: undefined,
      signal: new AbortController().signal,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      })
    );
  });
});

describe("queryClient 設定", () => {
  it("queryClient 已建立", () => {
    expect(queryClient).toBeDefined();
  });

  it("預設不自動 refetch", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.refetchInterval).toBe(false);
  });

  it("預設不重試", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("staleTime 設為 Infinity", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(Infinity);
  });
});
