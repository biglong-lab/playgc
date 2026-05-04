import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DisbandSquadDialog from "../DisbandSquadDialog";

describe("DisbandSquadDialog", () => {
  const defaults = {
    open: true,
    onOpenChange: () => {},
    squadName: "公司勇者隊",
    pending: false,
    onConfirm: () => {},
  };

  it("open=true 時顯示對話框", () => {
    render(<DisbandSquadDialog {...defaults} />);
    expect(screen.getByTestId("disband-squad-dialog")).toBeInTheDocument();
    expect(screen.getByText("確認解散隊伍")).toBeInTheDocument();
  });

  it("顯示要解散的 squadName", () => {
    render(<DisbandSquadDialog {...defaults} />);
    // squadName 出現在 description + warning + label 多處
    const matches = screen.getAllByText(/公司勇者隊/);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("4 個警告項目都顯示", () => {
    render(<DisbandSquadDialog {...defaults} />);
    expect(screen.getByText(/隊伍即時解散、所有成員會自動退出/)).toBeInTheDocument();
    expect(screen.getByText(/180 天無法重複使用/)).toBeInTheDocument();
    expect(screen.getByText(/已累積的戰績仍保留/)).toBeInTheDocument();
    expect(screen.getByText(/此操作無法復原/)).toBeInTheDocument();
  });

  it("輸入空時確認按鈕 disabled", () => {
    render(<DisbandSquadDialog {...defaults} />);
    const btn = screen.getByTestId("btn-disband-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入錯誤名稱時確認按鈕仍 disabled", () => {
    render(<DisbandSquadDialog {...defaults} />);
    fireEvent.change(screen.getByTestId("input-disband-confirm-name"), {
      target: { value: "其他名字" },
    });
    const btn = screen.getByTestId("btn-disband-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/輸入內容與隊名不符/)).toBeInTheDocument();
  });

  it("輸入正確名稱後確認按鈕啟用", () => {
    render(<DisbandSquadDialog {...defaults} />);
    fireEvent.change(screen.getByTestId("input-disband-confirm-name"), {
      target: { value: "公司勇者隊" },
    });
    const btn = screen.getByTestId("btn-disband-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("輸入名稱前後有空白也算對（trim）", () => {
    render(<DisbandSquadDialog {...defaults} />);
    fireEvent.change(screen.getByTestId("input-disband-confirm-name"), {
      target: { value: "  公司勇者隊  " },
    });
    const btn = screen.getByTestId("btn-disband-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點確認觸發 onConfirm", () => {
    const onConfirm = vi.fn();
    render(<DisbandSquadDialog {...defaults} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("input-disband-confirm-name"), {
      target: { value: "公司勇者隊" },
    });
    fireEvent.click(screen.getByTestId("btn-disband-confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("點取消觸發 onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<DisbandSquadDialog {...defaults} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("btn-disband-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pending=true 時兩個按鈕都 disabled", () => {
    render(<DisbandSquadDialog {...defaults} pending={true} />);
    expect((screen.getByTestId("btn-disband-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-disband-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("close dialog 時清空輸入欄", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<DisbandSquadDialog {...defaults} onOpenChange={onOpenChange} />);
    const input = screen.getByTestId("input-disband-confirm-name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("btn-disband-cancel"));
    // close → 重開時 input 應為空
    rerender(<DisbandSquadDialog {...defaults} open={false} onOpenChange={onOpenChange} />);
    rerender(<DisbandSquadDialog {...defaults} open={true} onOpenChange={onOpenChange} />);
    const reopened = screen.getByTestId("input-disband-confirm-name") as HTMLInputElement;
    expect(reopened.value).toBe("");
  });
});
