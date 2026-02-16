/**
 * 前端元件測試工具 — 封裝 customRender，自動包裹 Providers
 */
import { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * 建立測試用 QueryClient — 停用自動 retry 避免測試懸掛
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  readonly children: ReactNode;
}

/**
 * 建立包含所有 Provider 的 wrapper
 */
function createWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  readonly queryClient?: QueryClient;
}

/**
 * 自訂 render — 自動包裹 QueryClientProvider
 * 使用方式：
 *   const { getByText } = customRender(<MyComponent />);
 */
export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions,
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const Wrapper = createWrapper(queryClient);

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

/**
 * 建立模擬使用者資料
 */
export function createMockUser(overrides?: Record<string, unknown>) {
  return {
    id: "user-1",
    firebaseUid: "firebase-uid-1",
    firstName: "測試",
    lastName: "使用者",
    email: "test@example.com",
    profileImageUrl: null,
    role: "player",
    isAnonymous: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 建立模擬遊戲資料
 */
export function createMockGame(overrides?: Record<string, unknown>) {
  return {
    id: "game-1",
    title: "測試遊戲",
    description: "這是測試遊戲",
    slug: "test-game",
    coverImageUrl: null,
    difficulty: "medium",
    estimatedDuration: 30,
    maxPlayers: 10,
    gameMode: "individual",
    gameStructure: "linear",
    status: "published",
    isPublished: true,
    fieldId: "field-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 建立模擬頁面資料
 */
export function createMockPage(overrides?: Record<string, unknown>) {
  return {
    id: "page-1",
    gameId: "game-1",
    title: "測試頁面",
    pageType: "text_card",
    sortOrder: 0,
    config: { content: "測試內容" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Re-export testing-library 方法
export { screen, waitFor, fireEvent, within, act } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
