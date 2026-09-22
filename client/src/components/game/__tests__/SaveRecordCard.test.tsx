import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

const { authState, mockPrefetch, mockArm } = vi.hoisted(() => ({
  authState: { firebaseUser: null as { isAnonymous: boolean; uid: string } | null },
  mockPrefetch: vi.fn(),
  mockArm: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useLoginHandlers", () => ({ useLoginHandlers: () => ({}) }));
vi.mock("@/components/landing/EmbeddedBrowserWarning", () => ({ isEmbeddedBrowser: () => false }));
vi.mock("@/components/landing/LoginDialog", () => ({
  LoginDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="login-dialog">{title}</div> : null,
}));
vi.mock("@/lib/guest-claim", () => ({
  GUEST_CLAIMED_EVENT: "chito:guest-claimed",
  prefetchGuestClaimTicket: (...a: unknown[]) => mockPrefetch(...a),
  armGuestClaim: (...a: unknown[]) => mockArm(...a),
}));

import SaveRecordCard from "../SaveRecordCard";

describe("SaveRecordCard 結算頁保存紀錄", () => {
  beforeEach(() => {
    authState.firebaseUser = { isAnonymous: true, uid: "anon-1" };
    mockPrefetch.mockReset().mockResolvedValue(true);
    mockArm.mockReset().mockReturnValue(true);
  });

  it("正式帳號玩家不顯示", () => {
    authState.firebaseUser = { isAnonymous: false, uid: "real-1" };
    const { container } = render(<SaveRecordCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("訪客顯示卡片，並預先取得認領憑證", () => {
    render(<SaveRecordCard />);
    expect(screen.getByText("保存這次紀錄")).toBeInTheDocument();
    expect(mockPrefetch).toHaveBeenCalled();
  });

  it("按「登入保存紀錄」→ 武裝認領並開啟登入框（不含訪客選項）", async () => {
    render(<SaveRecordCard />);
    fireEvent.click(screen.getByTestId("button-save-record"));
    expect(await screen.findByTestId("login-dialog")).toHaveTextContent("登入保存紀錄");
    expect(mockArm).toHaveBeenCalled();
  });

  it("按「先不用」→ 收起卡片", () => {
    render(<SaveRecordCard />);
    fireEvent.click(screen.getByTestId("button-save-record-dismiss"));
    expect(screen.queryByTestId("save-record-card")).not.toBeInTheDocument();
  });

  it("認領完成事件 → 顯示已保存", async () => {
    render(<SaveRecordCard />);
    act(() => {
      window.dispatchEvent(new CustomEvent("chito:guest-claimed", { detail: { ok: true, moved: {} } }));
    });
    await waitFor(() => expect(screen.getByTestId("save-record-done")).toBeInTheDocument());
  });

  it("認領失敗事件 → 誠實顯示沒有保存成功", async () => {
    render(<SaveRecordCard />);
    act(() => {
      window.dispatchEvent(new CustomEvent("chito:guest-claimed", { detail: { ok: false, message: "保存連結已失效" } }));
    });
    expect(await screen.findByText(/沒有保存成功：保存連結已失效/)).toBeInTheDocument();
  });
});
