// TeammatePanel 單元測試
//
// 覆蓋：兩種版型 / 自己高亮 / 4 種狀態 icon / 隊長標記 / 斷線樣式 /
//      分數顯示 / 頭像 fallback / 空清單

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TeammatePanel, { type TeammateStatus } from "../TeammatePanel";

const baseMember = (overrides: Partial<TeammateStatus> = {}): TeammateStatus => ({
  userId: "u1",
  displayName: "玩家 A",
  status: "idle",
  ...overrides,
});

describe("TeammatePanel", () => {
  it("空清單顯示提示文字", () => {
    render(<TeammatePanel members={[]} />);
    expect(screen.getByTestId("teammate-panel-empty")).toBeInTheDocument();
    expect(screen.getByText("尚無隊友資料")).toBeInTheDocument();
  });

  it("full variant 渲染所有成員", () => {
    const members = [
      baseMember({ userId: "u1", displayName: "阿明" }),
      baseMember({ userId: "u2", displayName: "小華" }),
      baseMember({ userId: "u3", displayName: "小美" }),
    ];
    render(<TeammatePanel members={members} />);

    expect(screen.getByTestId("teammate-panel-full")).toBeInTheDocument();
    expect(screen.getByTestId("teammate-u1")).toBeInTheDocument();
    expect(screen.getByTestId("teammate-u2")).toBeInTheDocument();
    expect(screen.getByTestId("teammate-u3")).toBeInTheDocument();
    expect(screen.getByText("阿明")).toBeInTheDocument();
    expect(screen.getByText("小華")).toBeInTheDocument();
    expect(screen.getByText("小美")).toBeInTheDocument();
  });

  it("compact variant 切換版型", () => {
    const members = [baseMember({ userId: "u1", displayName: "阿明" })];
    render(<TeammatePanel members={members} variant="compact" />);

    expect(screen.getByTestId("teammate-panel-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("teammate-panel-full")).not.toBeInTheDocument();
  });

  it("自己（myUserId）會額外顯示「（你）」標記（full variant）", () => {
    const members = [
      baseMember({ userId: "me", displayName: "我自己" }),
      baseMember({ userId: "other", displayName: "別人" }),
    ];
    render(<TeammatePanel members={members} myUserId="me" />);

    expect(screen.getByText("（你）")).toBeInTheDocument();
  });

  it("4 種狀態 icon 都有對應 testid", () => {
    const members: TeammateStatus[] = [
      baseMember({ userId: "u1", status: "idle" }),
      baseMember({ userId: "u2", status: "in_progress" }),
      baseMember({ userId: "u3", status: "completed" }),
      baseMember({ userId: "u4", status: "disconnected" }),
    ];
    render(<TeammatePanel members={members} />);

    expect(screen.getByTestId("status-idle")).toBeInTheDocument();
    expect(screen.getByTestId("status-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("status-completed")).toBeInTheDocument();
    expect(screen.getByTestId("status-disconnected")).toBeInTheDocument();
  });

  it("4 種狀態都顯示對應中文文字（full variant）", () => {
    const members: TeammateStatus[] = [
      baseMember({ userId: "u1", status: "idle" }),
      baseMember({ userId: "u2", status: "in_progress" }),
      baseMember({ userId: "u3", status: "completed" }),
      baseMember({ userId: "u4", status: "disconnected" }),
    ];
    render(<TeammatePanel members={members} />);

    expect(screen.getByText("等待中")).toBeInTheDocument();
    expect(screen.getByText("進行中")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("斷線")).toBeInTheDocument();
  });

  it("隊長會顯示皇冠 emoji", () => {
    const members = [
      baseMember({ userId: "leader", displayName: "隊長", isLeader: true }),
      baseMember({ userId: "member", displayName: "隊員", isLeader: false }),
    ];
    render(<TeammatePanel members={members} />);

    // 皇冠出現在隊長名字旁
    const leaderRow = screen.getByTestId("teammate-leader");
    expect(leaderRow.textContent).toContain("👑");
    const memberRow = screen.getByTestId("teammate-member");
    expect(memberRow.textContent).not.toContain("👑");
  });

  it("showScore 開啟時顯示分數，關閉時隱藏", () => {
    const members = [baseMember({ userId: "u1", displayName: "阿明", score: 42 })];
    const { rerender } = render(<TeammatePanel members={members} showScore />);

    expect(screen.getByText("42")).toBeInTheDocument();

    rerender(<TeammatePanel members={members} showScore={false} />);
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("無 avatarUrl 時顯示首字 fallback", () => {
    const members = [
      baseMember({ userId: "u1", displayName: "阿明" }),
      baseMember({ userId: "u2", displayName: "Bob" }),
    ];
    render(<TeammatePanel members={members} />);

    // 首字「阿」、「B」
    expect(screen.getByText("阿")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("有 avatarUrl 時顯示圖片", () => {
    const members = [
      baseMember({
        userId: "u1",
        displayName: "阿明",
        avatarUrl: "https://example.com/avatar.jpg",
      }),
    ];
    render(<TeammatePanel members={members} />);

    const img = screen.getByRole("img", { name: "阿明" });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("空字串 displayName 也能 render（回 ?）", () => {
    const members = [baseMember({ userId: "u1", displayName: "" })];
    render(<TeammatePanel members={members} />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("compact + showScore + 隊長 + 自己 全屬性混合渲染", () => {
    const members: TeammateStatus[] = [
      baseMember({
        userId: "me",
        displayName: "我",
        isLeader: true,
        score: 100,
        status: "completed",
      }),
      baseMember({
        userId: "u2",
        displayName: "隊友",
        score: 80,
        status: "in_progress",
      }),
    ];
    render(
      <TeammatePanel
        members={members}
        myUserId="me"
        variant="compact"
        showScore
      />,
    );

    expect(screen.getByTestId("teammate-panel-compact")).toBeInTheDocument();
    const meRow = screen.getByTestId("teammate-me");
    expect(meRow.textContent).toContain("我");
    expect(meRow.textContent).toContain("👑");
    expect(meRow.textContent).toContain("100");
    expect(screen.getByTestId("status-completed")).toBeInTheDocument();
    expect(screen.getByTestId("status-in-progress")).toBeInTheDocument();
  });
});
