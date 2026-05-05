import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectShowcase from "../ProjectShowcase";
import type { ProjectShowcaseConfig, ProjectShowcaseState } from "../ProjectShowcase";

const defaultConfig: ProjectShowcaseConfig = {
  title: "🚀 專案展示",
  prompt: "展示你的成果！",
  maxProjectsPerPerson: 2,
  maxTitleLength: 30,
  maxDescLength: 150,
  allowVoteOwn: false,
  emojiReactions: ["🔥", "⭐"],
  showVoteCount: true,
};

const emptyState: ProjectShowcaseState = { projects: [] };

const project1 = {
  id: "p1",
  submitterId: "u2",
  submitterName: "Bob",
  title: "AI 助手",
  description: "用 GPT 建立的客服機器人",
  votes: [],
  submittedAt: 1000,
};

const project2 = {
  id: "p2",
  submitterId: "u1",
  submitterName: "Alice",
  title: "數位地圖",
  description: "互動式校園地圖",
  votes: [{ userId: "u2", emoji: "🔥", votedAt: 2000 }],
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftTitle: "",
  draftDesc: "",
  draftLink: "",
  showForm: false,
  onTitleChange: vi.fn(),
  onDescChange: vi.fn(),
  onLinkChange: vi.fn(),
  onToggleForm: vi.fn(),
  onSubmitProject: vi.fn(),
  onVote: vi.fn(),
};

describe("ProjectShowcase", () => {
  it("顯示標題", () => {
    render(<ProjectShowcase {...mockProps} />);
    expect(screen.getByTestId("ps-title")).toHaveTextContent("專案展示");
  });

  it("顯示提示語", () => {
    render(<ProjectShowcase {...mockProps} />);
    expect(screen.getByTestId("ps-prompt")).toHaveTextContent("展示你的成果！");
  });

  it("空列表時顯示空狀態", () => {
    render(<ProjectShowcase {...mockProps} />);
    expect(screen.getByTestId("ps-empty")).toBeInTheDocument();
  });

  it("顯示新增按鈕（未達上限）", () => {
    render(<ProjectShowcase {...mockProps} />);
    expect(screen.getByTestId("ps-add-btn")).toBeInTheDocument();
  });

  it("點擊新增呼叫 onToggleForm", () => {
    const onToggleForm = vi.fn();
    render(<ProjectShowcase {...mockProps} onToggleForm={onToggleForm} />);
    fireEvent.click(screen.getByTestId("ps-add-btn"));
    expect(onToggleForm).toHaveBeenCalled();
  });

  it("showForm=true 時顯示表單", () => {
    render(<ProjectShowcase {...mockProps} showForm={true} />);
    expect(screen.getByTestId("ps-form")).toBeInTheDocument();
  });

  it("表單為空時提交按鈕 disabled", () => {
    render(<ProjectShowcase {...mockProps} showForm={true} />);
    expect(screen.getByTestId("ps-submit-btn")).toBeDisabled();
  });

  it("填寫標題和描述後提交按鈕啟用", () => {
    render(<ProjectShowcase {...mockProps} showForm={true} draftTitle="AI 助手" draftDesc="很棒的專案" />);
    expect(screen.getByTestId("ps-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmitProject", () => {
    const onSubmitProject = vi.fn();
    render(
      <ProjectShowcase {...mockProps} showForm={true} draftTitle="AI 助手" draftDesc="描述" onSubmitProject={onSubmitProject} />,
    );
    fireEvent.click(screen.getByTestId("ps-submit-btn"));
    expect(onSubmitProject).toHaveBeenCalled();
  });

  it("點擊取消呼叫 onToggleForm", () => {
    const onToggleForm = vi.fn();
    render(<ProjectShowcase {...mockProps} showForm={true} onToggleForm={onToggleForm} />);
    fireEvent.click(screen.getByTestId("ps-cancel-btn"));
    expect(onToggleForm).toHaveBeenCalled();
  });

  it("有專案時顯示列表", () => {
    const state: ProjectShowcaseState = { projects: [project1] };
    render(<ProjectShowcase {...mockProps} state={state} />);
    expect(screen.getByTestId("ps-project-p1")).toBeInTheDocument();
  });

  it("顯示專案標題", () => {
    const state: ProjectShowcaseState = { projects: [project1] };
    render(<ProjectShowcase {...mockProps} state={state} />);
    expect(screen.getByTestId("ps-ptitle-p1")).toHaveTextContent("AI 助手");
  });

  it("顯示專案描述", () => {
    const state: ProjectShowcaseState = { projects: [project1] };
    render(<ProjectShowcase {...mockProps} state={state} />);
    expect(screen.getByTestId("ps-desc-p1")).toHaveTextContent("用 GPT 建立的客服機器人");
  });

  it("allowVoteOwn=false 自己的專案不顯示投票按鈕", () => {
    const state: ProjectShowcaseState = { projects: [project2] };
    render(<ProjectShowcase {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("ps-vote-p2-🔥")).not.toBeInTheDocument();
  });

  it("別人的專案顯示投票按鈕", () => {
    const state: ProjectShowcaseState = { projects: [project1] };
    render(<ProjectShowcase {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("ps-vote-p1-🔥")).toBeInTheDocument();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const state: ProjectShowcaseState = { projects: [project1] };
    render(<ProjectShowcase {...mockProps} state={state} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("ps-vote-p1-🔥"));
    expect(onVote).toHaveBeenCalledWith("p1", "🔥");
  });

  it("顯示投票數", () => {
    const state: ProjectShowcaseState = { projects: [project2] };
    render(<ProjectShowcase {...mockProps} state={state} myUserId="u3" />);
    expect(screen.getByTestId("ps-total-votes-p2")).toHaveTextContent("1");
  });

  it("達到上限後顯示已達上限", () => {
    const myProjects = [
      { ...project1, submitterId: "u1", id: "m1" },
      { ...project1, submitterId: "u1", id: "m2" },
    ];
    const state: ProjectShowcaseState = { projects: myProjects };
    render(<ProjectShowcase {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("ps-max-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("ps-add-btn")).not.toBeInTheDocument();
  });
});
