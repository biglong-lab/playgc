import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamChecklist from "../TeamChecklist";
import type { TeamChecklistConfig, TeamChecklistState } from "../TeamChecklist";

const config: TeamChecklistConfig = {
  title: "訓練完成清單",
  subtitle: "全隊一起勾選完成",
  items: ["完成自我介紹", "認識3位新成員", "參與一項活動"],
  winOnComplete: true,
};

const emptyState: TeamChecklistState = { checked: [] };

describe("TeamChecklist", () => {
  it("顯示標題", () => {
    render(<TeamChecklist config={config} state={emptyState} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-title")).toHaveTextContent("訓練完成清單");
  });

  it("顯示 subtitle", () => {
    render(<TeamChecklist config={config} state={emptyState} onToggle={vi.fn()} />);
    expect(screen.getByText("全隊一起勾選完成")).toBeInTheDocument();
  });

  it("顯示進度 badge 0/3", () => {
    render(<TeamChecklist config={config} state={emptyState} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-progress")).toHaveTextContent("0/3");
  });

  it("顯示所有清單項目", () => {
    render(<TeamChecklist config={config} state={emptyState} onToggle={vi.fn()} />);
    for (const item of config.items) {
      expect(screen.getByTestId(`checklist-item-${item}`)).toBeInTheDocument();
    }
  });

  it("點擊項目呼叫 onToggle", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(<TeamChecklist config={config} state={emptyState} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId("checklist-item-完成自我介紹"));
    expect(onToggle).toHaveBeenCalledWith("完成自我介紹");
  });

  it("已勾選的項目顯示刪除線", () => {
    const state: TeamChecklistState = { checked: ["完成自我介紹"] };
    render(<TeamChecklist config={config} state={state} onToggle={vi.fn()} />);
    const btn = screen.getByTestId("checklist-item-完成自我介紹");
    const span = btn.querySelector("span");
    expect(span?.className).toContain("line-through");
  });

  it("進度 badge 顯示正確數量", () => {
    const state: TeamChecklistState = { checked: ["完成自我介紹", "認識3位新成員"] };
    render(<TeamChecklist config={config} state={state} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-progress")).toHaveTextContent("2/3");
  });

  it("全部完成顯示慶祝畫面", () => {
    const state: TeamChecklistState = { checked: config.items };
    render(<TeamChecklist config={config} state={state} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-complete")).toBeInTheDocument();
    expect(screen.getByText("全部完成！")).toBeInTheDocument();
  });

  it("自訂 celebrationText", () => {
    const cfg: TeamChecklistConfig = { ...config, celebrationText: "任務全達成，太棒了！" };
    const state: TeamChecklistState = { checked: config.items };
    render(<TeamChecklist config={cfg} state={state} onToggle={vi.fn()} />);
    expect(screen.getByText("任務全達成，太棒了！")).toBeInTheDocument();
  });

  it("使用預設標題", () => {
    const cfg: TeamChecklistConfig = { items: ["A", "B"] };
    render(<TeamChecklist config={cfg} state={emptyState} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-title")).toHaveTextContent("✅ 隊伍清單");
  });

  it("有進度條", () => {
    render(<TeamChecklist config={config} state={emptyState} onToggle={vi.fn()} />);
    expect(screen.getByTestId("team-checklist-bar")).toBeInTheDocument();
  });
});
