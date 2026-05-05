import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RandomTeam from "../RandomTeam";
import type { RandomTeamConfig, RandomTeamState, WaitingMember, MemberAssignment } from "../RandomTeam";

const defaultConfig: RandomTeamConfig = {
  title: "🎲 工作坊分組",
  subtitle: "隨機分組，公平競賽",
  teams: [
    { id: "t1", name: "A 組", emoji: "🔵", color: "blue" },
    { id: "t2", name: "B 組", emoji: "🔴", color: "red" },
  ],
  startText: "開始分組！",
};

const waitingState: RandomTeamState = {
  waiting: [],
  assignments: [],
  phase: "waiting",
  hostUserId: null,
};

const w1: WaitingMember = { userId: "u1", userName: "Alice" };
const w2: WaitingMember = { userId: "u2", userName: "Bob" };

const assignedState = (assignments: MemberAssignment[]): RandomTeamState => ({
  waiting: [w1, w2],
  assignments,
  phase: "assigned",
  hostUserId: "u1",
});

const mockJoin = vi.fn(() => Promise.resolve());
const mockShuffle = vi.fn(() => Promise.resolve());
const mockReset = vi.fn(() => Promise.resolve());

describe("RandomTeam", () => {
  it("顯示標題", () => {
    render(<RandomTeam config={defaultConfig} state={waitingState} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("random-team-title")).toHaveTextContent("工作坊分組");
  });

  it("顯示副標題", () => {
    render(<RandomTeam config={defaultConfig} state={waitingState} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("random-team-subtitle")).toHaveTextContent("隨機分組，公平競賽");
  });

  it("waiting phase 顯示加入按鈕", () => {
    render(<RandomTeam config={defaultConfig} state={waitingState} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("join-waiting-btn")).toBeInTheDocument();
  });

  it("點擊加入呼叫 onJoinWaiting", async () => {
    const onJoin = vi.fn(() => Promise.resolve());
    render(<RandomTeam config={defaultConfig} state={waitingState} myUserId="u1" onJoinWaiting={onJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    fireEvent.click(screen.getByTestId("join-waiting-btn"));
    await waitFor(() => expect(onJoin).toHaveBeenCalled());
  });

  it("已加入顯示等待訊息", () => {
    const state: RandomTeamState = { ...waitingState, waiting: [w1] };
    render(<RandomTeam config={defaultConfig} state={state} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("joined-waiting")).toBeInTheDocument();
  });

  it("顯示等待人數", () => {
    const state: RandomTeamState = { ...waitingState, waiting: [w1, w2] };
    render(<RandomTeam config={defaultConfig} state={state} myUserId="u3" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("waiting-count")).toHaveTextContent("2");
  });

  it("顯示等待者 badge", () => {
    const state: RandomTeamState = { ...waitingState, waiting: [w1, w2] };
    render(<RandomTeam config={defaultConfig} state={state} myUserId="u3" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("waiting-badge-u1")).toBeInTheDocument();
    expect(screen.getByTestId("waiting-badge-u2")).toBeInTheDocument();
  });

  it("2 人以上顯示分組按鈕", () => {
    const state: RandomTeamState = { ...waitingState, waiting: [w1, w2] };
    render(<RandomTeam config={defaultConfig} state={state} myUserId="u3" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("shuffle-btn")).toBeInTheDocument();
  });

  it("點擊分組呼叫 onShuffle", async () => {
    const onShuffle = vi.fn(() => Promise.resolve());
    const state: RandomTeamState = { ...waitingState, waiting: [w1, w2] };
    render(<RandomTeam config={defaultConfig} state={state} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={onShuffle} onReset={mockReset} />);
    fireEvent.click(screen.getByTestId("shuffle-btn"));
    await waitFor(() => expect(onShuffle).toHaveBeenCalled());
  });

  it("assigned phase 顯示我的隊伍", () => {
    const assignments: MemberAssignment[] = [
      { userId: "u1", userName: "Alice", teamId: "t1" },
      { userId: "u2", userName: "Bob", teamId: "t2" },
    ];
    render(<RandomTeam config={defaultConfig} state={assignedState(assignments)} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("my-team-result")).toHaveTextContent("A 組");
  });

  it("顯示各隊伍名單", () => {
    const assignments: MemberAssignment[] = [
      { userId: "u1", userName: "Alice", teamId: "t1" },
      { userId: "u2", userName: "Bob", teamId: "t2" },
    ];
    render(<RandomTeam config={defaultConfig} state={assignedState(assignments)} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("team-roster-t1")).toBeInTheDocument();
    expect(screen.getByTestId("team-roster-t2")).toBeInTheDocument();
  });

  it("顯示成員在隊伍中", () => {
    const assignments: MemberAssignment[] = [
      { userId: "u1", userName: "Alice", teamId: "t1" },
    ];
    render(<RandomTeam config={defaultConfig} state={assignedState(assignments)} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("member-u1")).toHaveTextContent("Alice");
  });

  it("host 看到重新分組按鈕", () => {
    render(<RandomTeam config={defaultConfig} state={assignedState([])} myUserId="u1" onJoinWaiting={mockJoin} onShuffle={mockShuffle} onReset={mockReset} />);
    expect(screen.getByTestId("reset-btn")).toBeInTheDocument();
  });
});
