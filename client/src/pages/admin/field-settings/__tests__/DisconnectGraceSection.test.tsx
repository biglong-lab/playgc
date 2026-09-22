// ⏱️ 場域設定 › 多人遊戲斷線寬限期 — 不再提示「需重啟」、範圍與後端共用
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import DisconnectGraceSection from "../DisconnectGraceSection";

function renderSection(overrides: Partial<Parameters<typeof DisconnectGraceSection>[0]> = {}) {
  const props = {
    graceSec: 30,
    autoLeaveSec: 120,
    pauseStrategy: "leader_decide" as const,
    onGraceSecChange: vi.fn(),
    onAutoLeaveSecChange: vi.fn(),
    onPauseStrategyChange: vi.fn(),
    ...overrides,
  };
  render(<DisconnectGraceSection {...props} />);
  return props;
}

describe("DisconnectGraceSection", () => {
  it("不再出現「需重啟」「環境變數」提示，改說明儲存後 30 秒內生效", () => {
    renderSection();
    expect(screen.queryByText(/重啟/)).not.toBeInTheDocument();
    expect(screen.queryByText(/DISCONNECT_GRACE_MS/)).not.toBeInTheDocument();
    expect(screen.getByTestId("grace-apply-hint")).toHaveTextContent("30 秒內生效");
  });

  it("輸入範圍與後端一致：寬限 5～600、自動離開 30～600", () => {
    renderSection();
    const grace = screen.getByTestId("input-disconnect-grace");
    const autoLeave = screen.getByTestId("input-auto-leave-grace");
    expect(grace).toHaveAttribute("min", "5");
    expect(grace).toHaveAttribute("max", "600");
    expect(autoLeave).toHaveAttribute("min", "30");
    expect(autoLeave).toHaveAttribute("max", "600");
  });

  it("輸入值回傳給上層；清空時回預設值", () => {
    const props = renderSection();
    fireEvent.change(screen.getByTestId("input-disconnect-grace"), { target: { value: "45" } });
    expect(props.onGraceSecChange).toHaveBeenCalledWith(45);
    fireEvent.change(screen.getByTestId("input-auto-leave-grace"), { target: { value: "" } });
    expect(props.onAutoLeaveSecChange).toHaveBeenCalledWith(120);
  });

  it("暫停策略切換回傳給上層", () => {
    const props = renderSection();
    fireEvent.change(screen.getByTestId("select-pause-strategy"), { target: { value: "never_pause" } });
    expect(props.onPauseStrategyChange).toHaveBeenCalledWith("never_pause");
  });
});
