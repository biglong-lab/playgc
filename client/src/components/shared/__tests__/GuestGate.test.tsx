import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { ensure, claim } = vi.hoisted(() => ({
  ensure: { value: { status: "ready", error: null as string | null, retry: vi.fn() } },
  claim: { value: false },
}));

vi.mock("@/hooks/useEnsurePlayer", () => ({ useEnsurePlayer: () => ensure.value }));
vi.mock("@/hooks/useGuestClaimFinalizer", () => ({ useGuestClaimFinalizer: () => claim.value }));
vi.mock("@/hooks/useLoginHandlers", () => ({ useLoginHandlers: () => ({}) }));
vi.mock("@/components/landing/LoginDialog", () => ({
  LoginDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="login-dialog" /> : null),
}));

import GuestGate from "../GuestGate";

const Page = () => <div data-testid="page">遊戲內容</div>;

describe("GuestGate", () => {
  beforeEach(() => {
    ensure.value = { status: "ready", error: null, retry: vi.fn() };
    claim.value = false;
  });

  it("建立訪客身分中 → 顯示準備中，不渲染頁面", () => {
    ensure.value = { ...ensure.value, status: "loading" };
    render(<GuestGate><Page /></GuestGate>);
    expect(screen.getByText("準備遊戲中...")).toBeInTheDocument();
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
  });

  it("身分就緒 → 直接進頁面（不再有登入牆）", () => {
    render(<GuestGate><Page /></GuestGate>);
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("建立失敗 → 顯示重試，並可改用帳號登入（大型活動撞配額時的出路）", () => {
    ensure.value = { ...ensure.value, status: "error", error: "目前進場人數較多，請稍候再試，或改用帳號登入" };
    render(<GuestGate><Page /></GuestGate>);
    expect(screen.getByTestId("btn-guest-retry")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("btn-guest-login-instead"));
    expect(screen.getByTestId("login-dialog")).toBeInTheDocument();
  });

  it("跳頁登入回來有待認領 → 先保存紀錄、完成後才進頁面（避免先開新局）", () => {
    claim.value = true;
    const { rerender } = render(<GuestGate><Page /></GuestGate>);
    expect(screen.getByText("保存紀錄中...")).toBeInTheDocument();
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();

    claim.value = false;
    rerender(<GuestGate><Page /></GuestGate>);
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("已在頁面上（結算頁 popup 登入）→ 認領期間不打斷畫面", () => {
    const { rerender } = render(<GuestGate><Page /></GuestGate>);
    claim.value = true;
    rerender(<GuestGate><Page /></GuestGate>);
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });
});
