import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NameCard from "../NameCard";
import type { NameCardConfig, NameCardState, NameCardEntry } from "../NameCard";

const defaultConfig: NameCardConfig = {
  title: "🏷️ 自我介紹牌",
  subtitle: "填寫你的名牌",
  fields: [
    { key: "name", label: "姓名", placeholder: "你的名字", maxLength: 20 },
    { key: "role", label: "職位", placeholder: "你的職位", maxLength: 30 },
  ],
};

const emptyState: NameCardState = { cards: [] };
const mockOnSubmit = vi.fn(() => Promise.resolve());

const sampleCard: NameCardEntry = {
  id: "c1",
  userId: "other",
  fields: { name: "王大明", role: "工程師" },
  emoji: "🚀",
  submittedAt: Date.now() - 1000,
};

describe("NameCard", () => {
  it("顯示標題", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-title")).toHaveTextContent("自我介紹牌");
  });

  it("顯示副標題", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-subtitle")).toHaveTextContent("填寫你的名牌");
  });

  it("顯示欄位輸入框", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("field-input-name")).toBeInTheDocument();
    expect(screen.getByTestId("field-input-role")).toBeInTheDocument();
  });

  it("提交按鈕初始停用", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-submit-btn")).toBeDisabled();
  });

  it("填寫必填欄位後按鈕啟用", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    fireEvent.change(screen.getByTestId("field-input-name"), { target: { value: "陳小花" } });
    fireEvent.change(screen.getByTestId("field-input-role"), { target: { value: "設計師" } });
    expect(screen.getByTestId("name-card-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("field-input-name"), { target: { value: "陳小花" } });
    fireEvent.change(screen.getByTestId("field-input-role"), { target: { value: "設計師" } });
    fireEvent.click(screen.getByTestId("name-card-submit-btn"));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { name: "陳小花", role: "設計師" },
        expect.any(String)
      );
    });
  });

  it("已提交時顯示確認畫面", () => {
    const myCard: NameCardEntry = { id: "c2", userId: "u1", fields: { name: "我", role: "測試者" }, emoji: "🎯", submittedAt: Date.now() };
    const state: NameCardState = { cards: [myCard] };
    render(<NameCard config={defaultConfig} state={state} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-submitted")).toBeInTheDocument();
  });

  it("顯示其他人的名牌卡片", () => {
    const state: NameCardState = { cards: [sampleCard] };
    render(<NameCard config={defaultConfig} state={state} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-item-c1")).toBeInTheDocument();
  });

  it("顯示人數徽章", () => {
    const state: NameCardState = { cards: [sampleCard] };
    render(<NameCard config={defaultConfig} state={state} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("name-card-count")).toHaveTextContent("1 人");
  });

  it("可選擇 emoji", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("emoji-pick-😊")).toBeInTheDocument();
    expect(screen.getByTestId("emoji-pick-🚀")).toBeInTheDocument();
  });

  it("無副標題時不顯示", () => {
    const cfg = { ...defaultConfig, subtitle: undefined };
    render(<NameCard config={cfg} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.queryByTestId("name-card-subtitle")).not.toBeInTheDocument();
  });

  it("無人時不顯示人數徽章", () => {
    render(<NameCard config={defaultConfig} state={emptyState} myUserId="u1" onSubmit={mockOnSubmit} />);
    expect(screen.queryByTestId("name-card-count")).not.toBeInTheDocument();
  });
});
