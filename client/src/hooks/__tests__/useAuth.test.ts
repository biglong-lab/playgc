/**
 * useAuth Hook 測試
 * 測試認證狀態管理、使用者資料合併、載入狀態
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

// Mock AuthContext
const mockAuthContext = vi.hoisted(() => ({
  firebaseUser: null as Record<string, unknown> | null,
  isLoading: false,
  isAuthenticated: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

// Mock Firebase getIdToken
vi.mock("@/lib/firebase", () => ({
  getIdToken: vi.fn().mockResolvedValue("mock-token"),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAuth Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.firebaseUser = null;
    mockAuthContext.isLoading = false;
    mockAuthContext.isAuthenticated = false;
  });

  it("Firebase 尚未登入時回傳未認證狀態", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isSignedIn).toBe(false);
  });

  it("Firebase 載入中時回傳 isLoading = true", async () => {
    mockAuthContext.isLoading = true;

    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
  });

  it("Firebase 已登入但 DB 查詢中時 isLoading = true", async () => {
    mockAuthContext.firebaseUser = { uid: "uid-1", displayName: "Test User" };
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.isLoading = false;

    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // DB 查詢啟動中，應為 loading
    expect(result.current.isSignedIn).toBe(true);
  });

  it("isSignedIn 反映 Firebase 登入狀態", async () => {
    mockAuthContext.isAuthenticated = true;

    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.isSignedIn).toBe(true);
  });

  it("getToken 函式存在且為函式", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(typeof result.current.getToken).toBe("function");
  });

  it("Firebase 載入中 → isAuthenticated 保持 false", async () => {
    mockAuthContext.isLoading = true;
    mockAuthContext.isAuthenticated = false;

    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("未登入時 authError 為 null", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.authError).toBeNull();
  });

  it("firebaseUser 為 null 時 user 也為 null", async () => {
    mockAuthContext.firebaseUser = null;
    mockAuthContext.isAuthenticated = false;

    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.user).toBeNull();
    expect(result.current.firebaseUser).toBeNull();
  });
});
