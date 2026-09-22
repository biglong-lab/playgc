// 🚫 後台取消預約對話框 — 原因必填 ≥5 字（即時提示）+ 確認步驟（不用原生 prompt / confirm）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import CancelBookingDialog from "../CancelBookingDialog";

const BOOKING = { bookingCode: "BK001", displayName: "王小明", slotStart: "2026-09-23T06:00:00.000Z" };

function renderDialog(onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <CancelBookingDialog open booking={BOOKING} isPending={false} onOpenChange={onOpenChange} onConfirm={onConfirm} />,
  );
  return { onConfirm, onOpenChange };
}

const reasonInput = () => screen.getByTestId("input-cancel-reason");
const typeReason = (text: string) => fireEvent.change(reasonInput(), { target: { value: text } });

describe("CancelBookingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("尚未填原因 → 提示必填、下一步不能按", () => {
    renderDialog();
    expect(screen.getByTestId("cancel-reason-hint")).toHaveTextContent("請填寫取消原因（至少 5 個字）");
    expect(screen.getByTestId("button-cancel-next")).toBeDisabled();
  });

  it("輸入不足 5 字 → 即時提示還差幾個字", () => {
    renderDialog();
    typeReason("下雨");
    expect(screen.getByTestId("cancel-reason-hint")).toHaveTextContent("還差 3 個字");
    expect(screen.getByTestId("button-cancel-next")).toBeDisabled();
  });

  it("填滿 5 字 → 可按下一步，進入確認步驟顯示影響與原因、尚未送出", () => {
    const { onConfirm } = renderDialog();
    typeReason("颱風停業中");
    fireEvent.click(screen.getByTestId("button-cancel-next"));
    expect(screen.getByTestId("cancel-confirm-summary")).toHaveTextContent("BK001");
    expect(screen.getByTestId("cancel-confirm-summary")).toHaveTextContent("LINE");
    expect(screen.getByTestId("cancel-confirm-summary")).toHaveTextContent("颱風停業中");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("確認步驟按「確定取消預約」→ 以去頭尾空白的原因送出", () => {
    const { onConfirm } = renderDialog();
    typeReason("  颱風停業中  ");
    fireEvent.click(screen.getByTestId("button-cancel-next"));
    fireEvent.click(screen.getByTestId("button-cancel-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("颱風停業中");
  });

  it("確認步驟按「返回修改」→ 回到填寫、保留原因", () => {
    const { onConfirm } = renderDialog();
    typeReason("颱風停業中");
    fireEvent.click(screen.getByTestId("button-cancel-next"));
    fireEvent.click(screen.getByTestId("button-cancel-back"));
    expect((reasonInput() as HTMLTextAreaElement).value).toBe("颱風停業中");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("按「先不取消」→ 關閉對話框、不送出", () => {
    const { onConfirm, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("button-cancel-dismiss"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
