import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamAnimal } from "../TeamAnimal";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

describe("TeamAnimal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-title").textContent).toContain("團隊隱喻");
    expect(screen.getByTestId("ta-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <TeamAnimal {...defaultProps} config={{ title: "動物隱喻", prompt: "你的動物是？" }} />,
    );
    expect(screen.getByTestId("ta-title").textContent).toContain("動物隱喻");
    expect(screen.getByTestId("ta-prompt").textContent).toContain("你的動物是？");
  });

  it("顯示提交數量", () => {
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-count").textContent).toContain("0");
  });

  it("顯示兩個輸入欄", () => {
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-subject-input")).toBeTruthy();
    expect(screen.getByTestId("ta-reason-input")).toBeTruthy();
    expect(screen.getByTestId("ta-submit-btn")).toBeTruthy();
  });

  it("兩欄皆空時提交鈕禁用", () => {
    render(<TeamAnimal {...defaultProps} />);
    const btn = screen.getByTestId("ta-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填一欄時提交鈕禁用", () => {
    render(<TeamAnimal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ta-subject-input"), { target: { value: "老虎" } });
    expect((screen.getByTestId("ta-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("兩欄都填後提交", () => {
    render(<TeamAnimal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ta-subject-input"), { target: { value: "老虎" } });
    fireEvent.change(screen.getByTestId("ta-reason-input"), { target: { value: "勇猛果敢" } });
    fireEvent.click(screen.getByTestId("ta-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].subject).toBe("老虎");
    expect(arg.entries[0].reason).toBe("勇猛果敢");
  });

  it("已提交顯示我的隱喻", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", subject: "老虎", reason: "勇猛" }],
      revealed: false,
    };
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("ta-subject-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<TeamAnimal {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ta-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<TeamAnimal {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ta-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<TeamAnimal {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ta-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示卡片牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", subject: "老虎", reason: "勇猛" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", subject: "貓頭鷹", reason: "智慧" },
      ],
      revealed: true,
    };
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-result")).toBeTruthy();
    expect(screen.getByTestId("ta-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ta-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamAnimal {...defaultProps} />);
    expect(screen.getByTestId("ta-empty")).toBeTruthy();
  });
});
