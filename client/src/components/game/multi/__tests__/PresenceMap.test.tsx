import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PresenceMap from "../PresenceMap";
import type { PresenceMapConfig, PresenceMapState } from "../PresenceMap";

const defaultConfig: PresenceMapConfig = {
  title: "🗺️ 個性地圖",
  xAxisLeft: "內向",
  xAxisRight: "外向",
  yAxisTop: "理性",
  yAxisBottom: "感性",
  showNames: true,
};

const alice = { userId: "u1", userName: "Alice", x: 30, y: 40 };
const bob = { userId: "u2", userName: "Bob", x: 70, y: 60 };

const emptyState: PresenceMapState = { dots: [] };
const filledState: PresenceMapState = { dots: [alice, bob] };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localDot: null,
  onCanvasClick: vi.fn(),
  onConfirm: vi.fn(),
};

describe("PresenceMap", () => {
  it("顯示標題", () => {
    render(<PresenceMap {...mockProps} />);
    expect(screen.getByTestId("pm-title")).toHaveTextContent("個性地圖");
  });

  it("顯示四個軸線標籤", () => {
    render(<PresenceMap {...mockProps} />);
    expect(screen.getByTestId("pm-x-left")).toHaveTextContent("內向");
    expect(screen.getByTestId("pm-x-right")).toHaveTextContent("外向");
    expect(screen.getByTestId("pm-y-top")).toHaveTextContent("理性");
    expect(screen.getByTestId("pm-y-bottom")).toHaveTextContent("感性");
  });

  it("顯示畫布", () => {
    render(<PresenceMap {...mockProps} />);
    expect(screen.getByTestId("pm-canvas")).toBeInTheDocument();
  });

  it("點擊畫布呼叫 onCanvasClick", () => {
    const onCanvasClick = vi.fn();
    render(<PresenceMap {...mockProps} onCanvasClick={onCanvasClick} />);
    fireEvent.click(screen.getByTestId("pm-canvas"));
    expect(onCanvasClick).toHaveBeenCalledWith(50, 50);
  });

  it("尚未放置時顯示提示文字", () => {
    render(<PresenceMap {...mockProps} />);
    expect(screen.getByTestId("pm-hint")).toBeInTheDocument();
  });

  it("有 localDot 時顯示預覽點", () => {
    render(<PresenceMap {...mockProps} localDot={{ x: 40, y: 60 }} />);
    expect(screen.getByTestId("pm-local-dot")).toBeInTheDocument();
  });

  it("沒有 localDot 時不顯示預覽點", () => {
    render(<PresenceMap {...mockProps} localDot={null} />);
    expect(screen.queryByTestId("pm-local-dot")).not.toBeInTheDocument();
  });

  it("有 localDot 時顯示確認按鈕", () => {
    render(<PresenceMap {...mockProps} localDot={{ x: 50, y: 50 }} />);
    expect(screen.getByTestId("pm-confirm-btn")).toBeInTheDocument();
  });

  it("沒有 localDot 時隱藏確認按鈕", () => {
    render(<PresenceMap {...mockProps} />);
    expect(screen.queryByTestId("pm-confirm-btn")).not.toBeInTheDocument();
  });

  it("點擊確認呼叫 onConfirm", () => {
    const onConfirm = vi.fn();
    render(<PresenceMap {...mockProps} localDot={{ x: 50, y: 50 }} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("pm-confirm-btn"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("已確認後顯示已確認訊息", () => {
    render(<PresenceMap {...mockProps} state={filledState} myUserId="u1" />);
    expect(screen.getByTestId("pm-placed-msg")).toBeInTheDocument();
  });

  it("已確認後隱藏確認按鈕", () => {
    render(<PresenceMap {...mockProps} state={filledState} myUserId="u1" localDot={{ x: 30, y: 40 }} />);
    expect(screen.queryByTestId("pm-confirm-btn")).not.toBeInTheDocument();
  });

  it("顯示其他人的標記點", () => {
    render(<PresenceMap {...mockProps} state={filledState} />);
    expect(screen.getByTestId("pm-dot-u2")).toBeInTheDocument();
  });

  it("顯示自己的標記點", () => {
    render(<PresenceMap {...mockProps} state={filledState} />);
    expect(screen.getByTestId("pm-dot-u1")).toBeInTheDocument();
  });

  it("顯示標記人數", () => {
    render(<PresenceMap {...mockProps} state={filledState} />);
    expect(screen.getByTestId("pm-count")).toHaveTextContent("2");
  });

  it("showNames=true 顯示名字標籤", () => {
    render(<PresenceMap {...mockProps} state={filledState} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("showNames=false 不顯示名字標籤", () => {
    const config = { ...defaultConfig, showNames: false };
    render(<PresenceMap {...mockProps} config={config} state={filledState} />);
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("有 localDot 時顯示預覽提示", () => {
    render(<PresenceMap {...mockProps} localDot={{ x: 50, y: 50 }} />);
    expect(screen.getByTestId("pm-preview-hint")).toBeInTheDocument();
  });
});
