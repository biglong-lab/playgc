import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GuestbookDigital from "../GuestbookDigital";

describe("GuestbookDigital", () => {
  it("hostMode 顯示標題 + 留言筆數", () => {
    render(
      <GuestbookDigital
        config={{ title: "婚宴簽名簿" }}
        hostMode={true}
        state={{
          entries: [
            { id: "1", name: "Alice", message: "新婚快樂", ts: Date.now() },
            { id: "2", name: "Bob", message: "祝百年好合", ts: Date.now() },
          ],
        }}
      />,
    );
    expect(screen.getByText("婚宴簽名簿")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/新婚快樂/)).toBeInTheDocument();
  });

  it("hostMode 0 entries 顯示等待提示", () => {
    render(<GuestbookDigital config={{}} hostMode={true} state={{ entries: [] }} />);
    expect(screen.getByText(/等待第一位來賓/)).toBeInTheDocument();
  });

  it("玩家版型顯示名字 + 訊息表單", () => {
    render(<GuestbookDigital config={{}} hostMode={false} myUserName="阿鬨" />);
    expect(screen.getByTestId("input-guestbook-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-guestbook-message")).toBeInTheDocument();
    expect(screen.getByTestId("btn-submit-guestbook")).toBeInTheDocument();
  });

  it("空白名字或訊息禁用送出", () => {
    render(<GuestbookDigital config={{}} hostMode={false} />);
    const btn = screen.getByTestId("btn-submit-guestbook") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("提交觸發 onPulse + 顯示已留言畫面", () => {
    const onPulse = vi.fn();
    render(<GuestbookDigital config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.change(screen.getByTestId("input-guestbook-name"), {
      target: { value: "我" },
    });
    fireEvent.change(screen.getByTestId("input-guestbook-message"), {
      target: { value: "祝你成功！" },
    });
    fireEvent.click(screen.getByTestId("btn-submit-guestbook"));
    expect(onPulse).toHaveBeenCalledWith("sign", { name: "我", message: "祝你成功！" });
    expect(screen.getByText("已留下祝福")).toBeInTheDocument();
  });

  it("myUserName 預設帶入 name input", () => {
    render(<GuestbookDigital config={{}} hostMode={false} myUserName="預設名" />);
    const input = screen.getByTestId("input-guestbook-name") as HTMLInputElement;
    expect(input.value).toBe("預設名");
  });
});
