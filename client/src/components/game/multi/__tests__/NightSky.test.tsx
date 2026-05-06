import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NightSky } from "../NightSky";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("NightSky", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-title").textContent).toBe("夜空星願");
  });

  it("顯示自定義標題", () => {
    render(<NightSky {...defaultProps} config={{ title: "許願星空" }} />);
    expect(screen.getByTestId("nsk-title").textContent).toBe("許願星空");
  });

  it("顯示提示文字", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-prompt")).toBeTruthy();
  });

  it("顯示已許願人數", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-form")).toBeTruthy();
  });

  it("顯示 5 個星星類型", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-star-grid")).toBeTruthy();
    expect(screen.getByTestId("nsk-star-shooting")).toBeTruthy();
    expect(screen.getByTestId("nsk-star-north")).toBeTruthy();
    expect(screen.getByTestId("nsk-star-twin")).toBeTruthy();
    expect(screen.getByTestId("nsk-star-supernova")).toBeTruthy();
    expect(screen.getByTestId("nsk-star-satellite")).toBeTruthy();
  });

  it("顯示夢想輸入框", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-dream-input")).toBeTruthy();
  });

  it("未填夢想時提交按鈕禁用", () => {
    render(<NightSky {...defaultProps} />);
    expect((screen.getByTestId("nsk-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<NightSky {...defaultProps} />);
    fireEvent.change(screen.getByTestId("nsk-dream-input"), { target: { value: "夢想" } });
    expect((screen.getByTestId("nsk-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<NightSky {...defaultProps} />);
    fireEvent.change(screen.getByTestId("nsk-dream-input"), { target: { value: "希望能環遊世界" } });
    expect((screen.getByTestId("nsk-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換星星類型", () => {
    render(<NightSky {...defaultProps} />);
    fireEvent.click(screen.getByTestId("nsk-star-north"));
    expect(screen.getByTestId("nsk-star-north").className).toContain("blue-100");
  });

  it("提交後呼叫 updateState 含 starType 和 dream", () => {
    render(<NightSky {...defaultProps} />);
    fireEvent.click(screen.getByTestId("nsk-star-supernova"));
    fireEvent.change(screen.getByTestId("nsk-dream-input"), { target: { value: "創業成功改變世界" } });
    fireEvent.click(screen.getByTestId("nsk-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; starType: string; dream: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].starType).toBe("supernova");
    expect(s.entries[0].dream).toBe("創業成功改變世界");
  });

  it("已提交後顯示我的星願", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", starType: "north", dream: "成為家人心中穩定的依靠" }], revealed: false };
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", starType: "north", dream: "成為家人心中穩定的依靠" }], revealed: false };
    render(<NightSky {...defaultProps} />);
    expect(screen.queryByTestId("nsk-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<NightSky {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("nsk-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<NightSky {...defaultProps} />);
    expect(screen.queryByTestId("nsk-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 nsk-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有星願", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", starType: "twin", dream: "找到與我並肩同行的夥伴" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", starType: "satellite", dream: "默默守護我最愛的人們" },
      ],
      revealed: true,
    };
    render(<NightSky {...defaultProps} />);
    expect(screen.getByTestId("nsk-result")).toBeTruthy();
    expect(screen.getByTestId("nsk-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("nsk-card-u2-1")).toBeTruthy();
  });
});
