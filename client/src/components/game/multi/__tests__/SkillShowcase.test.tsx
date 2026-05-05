import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillShowcase } from "../SkillShowcase";

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

const baseProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("SkillShowcase", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<SkillShowcase {...baseProps} config={{ title: "人才市集" }} />);
    expect(screen.getByTestId("ss-title").textContent).toContain("人才市集");
  });

  it("顯示預設標題", () => {
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-title").textContent).toContain("技能交流");
  });

  it("顯示已登記人數", () => {
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-count").textContent).toContain("0");
  });

  it("未提交前顯示表單", () => {
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-form")).toBeTruthy();
  });

  it("預設提交按鈕 disabled", () => {
    render(<SkillShowcase {...baseProps} />);
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("點選技能標籤後可啟用提交", () => {
    render(<SkillShowcase {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-offer-tag-簡報技巧"));
    fireEvent.click(screen.getByTestId("ss-learn-tag-資料分析"));
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("自行輸入技能後可提交", () => {
    render(<SkillShowcase {...baseProps} />);
    fireEvent.change(screen.getByTestId("ss-offer-custom"), { target: { value: "養蜂" } });
    fireEvent.change(screen.getByTestId("ss-learn-custom"), { target: { value: "釀酒" } });
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<SkillShowcase {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-offer-tag-程式開發"));
    fireEvent.click(screen.getByTestId("ss-learn-tag-設計思考"));
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { offerSkill: string; learnSkill: string }[] };
    expect(call.entries[0].offerSkill).toBe("程式開發");
    expect(call.entries[0].learnSkill).toBe("設計思考");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1",
        userId: "u1",
        userName: "Alice",
        offerSkill: "程式開發",
        learnSkill: "設計思考",
      }],
      revealed: false,
    };
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-my-entry")).toBeTruthy();
    expect(screen.getByTestId("ss-my-entry").textContent).toContain("程式開發");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<SkillShowcase {...baseProps} />);
    expect(screen.queryByTestId("ss-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SkillShowcase {...baseProps} isTeamLead />);
    expect(screen.getByTestId("ss-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕呼叫 updateState revealed=true", () => {
    render(<SkillShowcase {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ss-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true })
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-result")).toBeTruthy();
    expect(screen.getByTestId("ss-empty")).toBeTruthy();
  });

  it("revealed 顯示技能卡片與統計", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", offerSkill: "簡報技巧", learnSkill: "資料分析" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", offerSkill: "資料分析", learnSkill: "簡報技巧" },
      ],
      revealed: true,
    };
    render(<SkillShowcase {...baseProps} />);
    expect(screen.getByTestId("ss-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ss-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("ss-offer-stats")).toBeTruthy();
  });
});
