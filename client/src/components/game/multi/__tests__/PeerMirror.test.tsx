import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeerMirror } from "../PeerMirror";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "Alice", email: "alice@test.com" },
  }),
}));

const baseProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("PeerMirror", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<PeerMirror {...baseProps} config={{ title: "互相觀察" }} />);
    expect(screen.getByTestId("pm-title").textContent).toContain("互相觀察");
  });

  it("顯示預設標題", () => {
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-title").textContent).toContain("同伴之鏡");
  });

  it("顯示提示語", () => {
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-form")).toBeTruthy();
    expect(screen.getByTestId("pm-target-input")).toBeTruthy();
    expect(screen.getByTestId("pm-strength-picker")).toBeTruthy();
  });

  it("未填名字時提交按鈕 disabled", () => {
    render(<PeerMirror {...baseProps} />);
    fireEvent.click(screen.getByTestId("pm-strength-細心觀察"));
    const btn = screen.getByTestId("pm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("未選優點時提交按鈕 disabled", () => {
    render(<PeerMirror {...baseProps} />);
    fireEvent.change(screen.getByTestId("pm-target-input"), {
      target: { value: "Bob" },
    });
    const btn = screen.getByTestId("pm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填好名字和優點後可提交", () => {
    render(<PeerMirror {...baseProps} />);
    fireEvent.change(screen.getByTestId("pm-target-input"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByTestId("pm-strength-推動力"));
    const btn = screen.getByTestId("pm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<PeerMirror {...baseProps} />);
    fireEvent.change(screen.getByTestId("pm-target-input"), {
      target: { value: "Carol" },
    });
    fireEvent.click(screen.getByTestId("pm-strength-同理心"));
    fireEvent.change(screen.getByTestId("pm-note-input"), {
      target: { value: "她每次都耐心聆聽" },
    });
    fireEvent.click(screen.getByTestId("pm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { targetName: string; strength: string; note: string }[];
    };
    expect(call.entries[0].targetName).toBe("Carol");
    expect(call.entries[0].strength).toBe("同理心");
    expect(call.entries[0].note).toBe("她每次都耐心聆聽");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        targetName: "Bob", strength: "創意思考", note: "",
      }],
      revealed: false,
    };
    render(<PeerMirror {...baseProps} />);
    const el = screen.getByTestId("pm-my-entry");
    expect(el.textContent).toContain("Bob");
    expect(el.textContent).toContain("創意思考");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<PeerMirror {...baseProps} />);
    expect(screen.queryByTestId("pm-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<PeerMirror {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("pm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-empty")).toBeTruthy();
  });

  it("revealed 顯示收件人分組", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", targetName: "Bob", strength: "推動力", note: "" },
        { entryId: "u2-1", userId: "u2", userName: "Carol", targetName: "Bob", strength: "細心觀察", note: "" },
        { entryId: "u3-1", userId: "u3", userName: "Dave", targetName: "Alice", strength: "同理心", note: "" },
      ],
      revealed: true,
    };
    render(<PeerMirror {...baseProps} />);
    expect(screen.getByTestId("pm-result")).toBeTruthy();
    expect(screen.getByTestId("pm-recipient-list")).toBeTruthy();
    expect(screen.getByTestId("pm-recipient-Bob")).toBeTruthy();
    expect(screen.getByTestId("pm-recipient-Alice")).toBeTruthy();
    expect(screen.getByTestId("pm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pm-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("pm-card-u3-1")).toBeTruthy();
  });
});
