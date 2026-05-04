import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KeepSquadDialog from "../KeepSquadDialog";

describe("KeepSquadDialog", () => {
  const defaults = {
    open: true,
    onOpenChange: () => {},
    pending: false,
    onConfirm: () => {},
  };

  it("open=true 時顯示對話框", () => {
    render(<KeepSquadDialog {...defaults} />);
    expect(screen.getByTestId("keep-squad-dialog")).toBeInTheDocument();
    expect(screen.getByText(/保留隊伍下次再用/)).toBeInTheDocument();
  });

  it("input 預設值帶入 defaultName", () => {
    render(<KeepSquadDialog {...defaults} defaultName="公司勇者隊" />);
    const input = screen.getByTestId("input-squad-name") as HTMLInputElement;
    expect(input.value).toBe("公司勇者隊");
  });

  it("空名稱時保留按鈕 disabled", () => {
    render(<KeepSquadDialog {...defaults} defaultName="" />);
    const btn = screen.getByTestId("btn-keep-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入名稱後保留按鈕可按", () => {
    render(<KeepSquadDialog {...defaults} defaultName="" />);
    const input = screen.getByTestId("input-squad-name");
    fireEvent.change(input, { target: { value: "勇者" } });
    const btn = screen.getByTestId("btn-keep-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點「保留」觸發 onConfirm + 帶 trim 後的 name", () => {
    const onConfirm = vi.fn();
    render(<KeepSquadDialog {...defaults} onConfirm={onConfirm} defaultName="  測試  " />);
    fireEvent.click(screen.getByTestId("btn-keep-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ name: "測試", tag: undefined });
  });

  it("輸入 tag 後一起帶入", () => {
    const onConfirm = vi.fn();
    render(<KeepSquadDialog {...defaults} onConfirm={onConfirm} defaultName="勇者" />);
    fireEvent.change(screen.getByTestId("input-squad-tag"), { target: { value: "hero" } });
    fireEvent.click(screen.getByTestId("btn-keep-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ name: "勇者", tag: "HERO" });
  });

  it("tag 自動轉大寫", () => {
    render(<KeepSquadDialog {...defaults} defaultName="X" />);
    const input = screen.getByTestId("input-squad-tag") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.value).toBe("ABC");
  });

  it("name 50 字上限", () => {
    render(<KeepSquadDialog {...defaults} defaultName="" />);
    const input = screen.getByTestId("input-squad-name") as HTMLInputElement;
    expect(input.maxLength).toBe(50);
  });

  it("tag 10 字上限", () => {
    render(<KeepSquadDialog {...defaults} defaultName="X" />);
    const input = screen.getByTestId("input-squad-tag") as HTMLInputElement;
    expect(input.maxLength).toBe(10);
  });

  it("pending 時兩個按鈕都 disabled", () => {
    render(<KeepSquadDialog {...defaults} pending={true} defaultName="勇者" />);
    expect((screen.getByTestId("btn-keep-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-keep-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("點「不保留」觸發 onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<KeepSquadDialog {...defaults} onOpenChange={onOpenChange} defaultName="X" />);
    fireEvent.click(screen.getByTestId("btn-keep-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
