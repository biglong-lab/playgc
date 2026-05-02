import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScoreboardAnnouncement from "../ScoreboardAnnouncement";

const sampleAnnouncements = [
  { id: "a1", text: "後浦小隊 +50 分", type: "score" as const, ts: Date.now() - 5000 },
  { id: "a2", text: "活動下半場開始", type: "info" as const, ts: Date.now() - 3000 },
  { id: "a3", text: "Alice 突破 1000 分！", type: "celebrate" as const, ts: Date.now() },
];

describe("ScoreboardAnnouncement", () => {
  it("hostMode 0 announcements 顯示等待提示", () => {
    render(<ScoreboardAnnouncement config={{}} hostMode={true} state={{ announcements: [] }} />);
    expect(screen.getByText(/等待第一則宣告/)).toBeInTheDocument();
  });

  it("hostMode 含 admin 表單（input + 播報按鈕）", () => {
    render(<ScoreboardAnnouncement config={{}} hostMode={true} state={{ announcements: [] }} />);
    expect(screen.getByTestId("input-announce-text")).toBeInTheDocument();
    expect(screen.getByTestId("btn-add-announce")).toBeInTheDocument();
  });

  it("hostMode 點播報按鈕觸發 onBroadcastState", () => {
    const onBroadcast = vi.fn();
    render(
      <ScoreboardAnnouncement
        config={{}}
        hostMode={true}
        state={{ announcements: [] }}
        onBroadcastState={onBroadcast}
      />,
    );
    fireEvent.change(screen.getByTestId("input-announce-text"), { target: { value: "測試訊息" } });
    fireEvent.click(screen.getByTestId("btn-add-announce"));
    expect(onBroadcast).toHaveBeenCalled();
    const newState = onBroadcast.mock.calls[0][0];
    expect(newState.announcements).toHaveLength(1);
    expect(newState.announcements[0].text).toBe("測試訊息");
  });

  it("玩家版型唯讀顯示最近公告", () => {
    render(
      <ScoreboardAnnouncement
        config={{ title: "活動公告" }}
        hostMode={false}
        state={{ announcements: sampleAnnouncements }}
      />,
    );
    expect(screen.getByText("活動公告")).toBeInTheDocument();
    expect(screen.getByText("後浦小隊 +50 分")).toBeInTheDocument();
    expect(screen.getByText("活動下半場開始")).toBeInTheDocument();
    expect(screen.getByText("Alice 突破 1000 分！")).toBeInTheDocument();
  });

  it("玩家版型 0 announcements 顯示等待", () => {
    render(<ScoreboardAnnouncement config={{}} hostMode={false} state={{ announcements: [] }} />);
    expect(screen.getByText(/等待主辦方公告/)).toBeInTheDocument();
  });

  it("空白訊息 disable 播報按鈕", () => {
    render(<ScoreboardAnnouncement config={{}} hostMode={true} state={{ announcements: [] }} />);
    const btn = screen.getByTestId("btn-add-announce") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
