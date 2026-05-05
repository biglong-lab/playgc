import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StampCard from "../StampCard";
import type { StampCardConfig, StampCardState } from "../StampCard";

const defaultConfig: StampCardConfig = {
  title: "🎴 集點卡",
  subtitle: "完成所有任務集滿章",
  slots: [
    { id: "s1", label: "景點一", emoji: "🏯" },
    { id: "s2", label: "景點二", emoji: "🌸" },
    { id: "s3", label: "景點三", emoji: "🗺️" },
  ],
  rewardText: "兌換限定周邊",
  celebrationText: "恭喜集齊三關！",
};

const emptyState: StampCardState = { stamps: [] };
const mockOnStamp = vi.fn(() => Promise.resolve());

describe("StampCard", () => {
  it("顯示標題", () => {
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-card-title")).toHaveTextContent("集點卡");
  });

  it("顯示副標題", () => {
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-subtitle")).toHaveTextContent("完成所有任務集滿章");
  });

  it("顯示進度徽章 0/3", () => {
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-progress")).toHaveTextContent("0/3");
  });

  it("顯示三個集點格", () => {
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-slot-s1")).toBeInTheDocument();
    expect(screen.getByTestId("stamp-slot-s2")).toBeInTheDocument();
    expect(screen.getByTestId("stamp-slot-s3")).toBeInTheDocument();
  });

  it("點擊未蓋章格呼叫 onStamp", async () => {
    const onStamp = vi.fn(() => Promise.resolve());
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={onStamp} />);
    fireEvent.click(screen.getByTestId("stamp-slot-s1"));
    await waitFor(() => {
      expect(onStamp).toHaveBeenCalledWith("s1");
    });
  });

  it("已蓋章的格子為停用狀態", () => {
    const state: StampCardState = {
      stamps: [{ userId: "u1", userName: "我", stampedIds: ["s1"] }],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-slot-s1")).toBeDisabled();
    expect(screen.getByTestId("stamp-slot-s2")).not.toBeDisabled();
  });

  it("進度正確反映（1/3）", () => {
    const state: StampCardState = {
      stamps: [{ userId: "u1", userName: "我", stampedIds: ["s2"] }],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-progress")).toHaveTextContent("1/3");
  });

  it("集滿時顯示完成畫面", () => {
    const state: StampCardState = {
      stamps: [{ userId: "u1", userName: "我", stampedIds: ["s1", "s2", "s3"] }],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-completed")).toBeInTheDocument();
    expect(screen.getByTestId("stamp-completed")).toHaveTextContent("恭喜集齊三關！");
  });

  it("集滿時顯示獎勵文字", () => {
    const state: StampCardState = {
      stamps: [{ userId: "u1", userName: "我", stampedIds: ["s1", "s2", "s3"] }],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-completed")).toHaveTextContent("兌換限定周邊");
  });

  it("集滿時不顯示集點格", () => {
    const state: StampCardState = {
      stamps: [{ userId: "u1", userName: "我", stampedIds: ["s1", "s2", "s3"] }],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.queryByTestId("stamp-grid")).not.toBeInTheDocument();
  });

  it("顯示已集滿人數", () => {
    const state: StampCardState = {
      stamps: [
        { userId: "u1", userName: "甲", stampedIds: ["s1", "s2", "s3"] },
        { userId: "u2", userName: "乙", stampedIds: ["s1"] },
      ],
    };
    render(<StampCard config={defaultConfig} state={state} myUserId="u3" myUserName="丙" onStamp={mockOnStamp} />);
    expect(screen.getByTestId("stamp-completed-count")).toHaveTextContent("1");
  });

  it("無副標題時不顯示", () => {
    const cfg = { ...defaultConfig, subtitle: undefined };
    render(<StampCard config={cfg} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.queryByTestId("stamp-subtitle")).not.toBeInTheDocument();
  });

  it("沒有集滿時不顯示完成人數", () => {
    render(<StampCard config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onStamp={mockOnStamp} />);
    expect(screen.queryByTestId("stamp-completed-count")).not.toBeInTheDocument();
  });
});
