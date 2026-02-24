// PurchaseSuccess 頁面元件測試
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock wouter
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/purchase/success?txId=tx-001", mockSetLocation],
  useParams: () => ({}),
}));

// Mock window.location.search
const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, search: "?txId=tx-001" },
    writable: true,
  });
});

import PurchaseSuccess from "../PurchaseSuccess";

function createWrapper(queryData?: { status: string; gameId: string; chapterId: string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false,
      },
    },
  });

  if (queryData) {
    queryClient.setQueryData(["/api/transactions/tx-001/status"], queryData);
  }

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("PurchaseSuccess 頁面", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("付款完成 → 顯示成功訊息", () => {
    render(<PurchaseSuccess />, {
      wrapper: createWrapper({ status: "completed", gameId: "game-1", chapterId: null }),
    });

    expect(screen.getByText("付款成功！")).toBeInTheDocument();
    expect(screen.getByText("感謝您的購買，遊戲已自動解鎖。")).toBeInTheDocument();
  });

  it("有 gameId → 顯示「開始遊玩」按鈕", () => {
    render(<PurchaseSuccess />, {
      wrapper: createWrapper({ status: "completed", gameId: "game-1", chapterId: null }),
    });

    expect(screen.getByText("開始遊玩")).toBeInTheDocument();
  });

  it("付款失敗 → 顯示失敗訊息", () => {
    render(<PurchaseSuccess />, {
      wrapper: createWrapper({ status: "failed", gameId: "game-1", chapterId: null }),
    });

    expect(screen.getByText("付款失敗")).toBeInTheDocument();
  });

  it("無 txId → 顯示回到首頁", () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, search: "" },
      writable: true,
    });

    render(<PurchaseSuccess />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("回到首頁")).toBeInTheDocument();
  });
});
