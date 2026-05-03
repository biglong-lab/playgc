import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MicroQa, { type QaQuestion } from "../MicroQa";

const buildQ = (overrides: Partial<QaQuestion> = {}): QaQuestion => ({
  id: "q1",
  text: "什麼是平台核心？",
  askedBy: "Alice",
  upvotes: 0,
  askedAt: Date.now(),
  answered: false,
  ...overrides,
});

describe("MicroQa hostMode（大螢幕）", () => {
  it("沒問題時顯示等待提示", () => {
    render(<MicroQa config={{ title: "Q&A" }} hostMode={true} />);
    expect(screen.getByText("Q&A")).toBeInTheDocument();
    expect(screen.getByText(/還沒有問題/)).toBeInTheDocument();
  });

  it("顯示問題清單按 upvote 排序", () => {
    render(
      <MicroQa
        config={{}}
        hostMode={true}
        state={{
          questions: [
            buildQ({ id: "a", text: "問 A", upvotes: 1 }),
            buildQ({ id: "b", text: "問 B", upvotes: 5 }),
            buildQ({ id: "c", text: "問 C", upvotes: 3 }),
          ],
          totalAsks: 3,
          totalUpvotes: 9,
        }}
      />,
    );
    const list = screen.getByTestId("qa-list");
    const items = list.querySelectorAll('[data-testid^="qa-item-"]');
    expect(items[0].getAttribute("data-testid")).toBe("qa-item-b");
    expect(items[1].getAttribute("data-testid")).toBe("qa-item-c");
    expect(items[2].getAttribute("data-testid")).toBe("qa-item-a");
  });

  it("已回答的問題沉到底", () => {
    render(
      <MicroQa
        config={{}}
        hostMode={true}
        state={{
          questions: [
            buildQ({ id: "a", text: "問 A", upvotes: 5 }),
            buildQ({ id: "b", text: "問 B", upvotes: 3, answered: true }),
            buildQ({ id: "c", text: "問 C", upvotes: 1 }),
          ],
          totalAsks: 3,
          totalUpvotes: 9,
        }}
      />,
    );
    expect(screen.getByText(/已回答 1 題/)).toBeInTheDocument();
  });

  it("點 ✓ 觸發 mark_answered pulse", () => {
    const onPulse = vi.fn();
    render(
      <MicroQa
        config={{}}
        hostMode={true}
        state={{
          questions: [buildQ({ id: "q1" })],
          totalAsks: 1,
          totalUpvotes: 0,
        }}
        onPulse={onPulse}
      />,
    );
    fireEvent.click(screen.getByTestId("qa-mark-answered-q1"));
    expect(onPulse).toHaveBeenCalledWith("mark_answered", { questionId: "q1" });
  });

  it("顯示總計 + 待回答數", () => {
    render(
      <MicroQa
        config={{}}
        hostMode={true}
        state={{
          questions: [buildQ({ id: "q1" }), buildQ({ id: "q2", answered: true })],
          totalAsks: 2,
          totalUpvotes: 5,
        }}
      />,
    );
    expect(screen.getByText(/共 2 題/)).toBeInTheDocument();
    expect(screen.getByText(/5 個讚/)).toBeInTheDocument();
    expect(screen.getByText(/待回答 1 題/)).toBeInTheDocument();
  });
});

describe("MicroQa 玩家端（手機）", () => {
  it("顯示輸入框 + 送出按鈕 + 匿名 toggle", () => {
    render(<MicroQa config={{}} hostMode={false} />);
    expect(screen.getByTestId("qa-input")).toBeInTheDocument();
    expect(screen.getByTestId("qa-submit")).toBeInTheDocument();
    expect(screen.getByTestId("qa-anonymous")).toBeInTheDocument();
  });

  it("空輸入時送出按鈕 disabled", () => {
    render(<MicroQa config={{}} hostMode={false} />);
    const btn = screen.getByTestId("qa-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入 + 送出觸發 ask pulse（匿名）", () => {
    const onPulse = vi.fn();
    render(<MicroQa config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.change(screen.getByTestId("qa-input"), { target: { value: "請問貴公司方向？" } });
    fireEvent.click(screen.getByTestId("qa-submit"));
    expect(onPulse).toHaveBeenCalledWith("ask", expect.objectContaining({
      text: "請問貴公司方向？",
      askedBy: "匿名",
    }));
  });

  it("取消匿名後可填名字", () => {
    const onPulse = vi.fn();
    render(<MicroQa config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("qa-anonymous"));
    fireEvent.change(screen.getByTestId("qa-name"), { target: { value: "小明" } });
    fireEvent.change(screen.getByTestId("qa-input"), { target: { value: "Q?" } });
    fireEvent.click(screen.getByTestId("qa-submit"));
    expect(onPulse).toHaveBeenCalledWith("ask", expect.objectContaining({ askedBy: "小明" }));
  });

  it("allowAnonymous=false 不顯示匿名 toggle", () => {
    render(<MicroQa config={{ allowAnonymous: false }} hostMode={false} />);
    expect(screen.queryByTestId("qa-anonymous")).not.toBeInTheDocument();
  });

  it("maxLength 限制字數", () => {
    render(<MicroQa config={{ maxLength: 10 }} hostMode={false} />);
    const input = screen.getByTestId("qa-input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "12345678901234567890" } });
    expect(input.value.length).toBeLessThanOrEqual(10);
  });

  it("玩家可看其他人問題並 upvote", () => {
    const onPulse = vi.fn();
    render(
      <MicroQa
        config={{}}
        hostMode={false}
        state={{
          questions: [buildQ({ id: "q1", text: "好問題" })],
          totalAsks: 1,
          totalUpvotes: 0,
        }}
        onPulse={onPulse}
      />,
    );
    expect(screen.getByText("好問題")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("qa-upvote-q1"));
    expect(onPulse).toHaveBeenCalledWith("upvote", { questionId: "q1" });
  });

  it("已回答的問題 upvote 按鈕 disabled", () => {
    render(
      <MicroQa
        config={{}}
        hostMode={false}
        state={{
          questions: [buildQ({ id: "q1", answered: true })],
          totalAsks: 1,
          totalUpvotes: 0,
        }}
      />,
    );
    const btn = screen.getByTestId("qa-upvote-q1") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
