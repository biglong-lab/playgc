/**
 * SearchKbdHint 元件測試
 * 涵蓋：mode="cmd-k" vs "slash" / isMac / title / 自訂 className
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchKbdHint from "../SearchKbdHint";

describe("SearchKbdHint", () => {
  describe("mode=\"cmd-k\"（預設）", () => {
    it("isMac=true 顯示 ⌘K", () => {
      render(<SearchKbdHint isMac={true} />);
      expect(screen.getByText("⌘")).toBeInTheDocument();
      expect(screen.getByText("K")).toBeInTheDocument();
    });

    it("isMac=false 顯示 Ctrl K", () => {
      render(<SearchKbdHint isMac={false} />);
      expect(screen.getByText("Ctrl")).toBeInTheDocument();
      expect(screen.getByText("K")).toBeInTheDocument();
    });

    it("預設 title 包含 ⌘K 和 Ctrl+K 提示", () => {
      const { container } = render(<SearchKbdHint isMac={true} />);
      const kbd = container.querySelector("kbd");
      expect(kbd?.getAttribute("title")).toContain("⌘K");
      expect(kbd?.getAttribute("title")).toContain("Ctrl+K");
    });
  });

  describe("mode=\"slash\"", () => {
    it("只顯示 /（不受 isMac 影響）", () => {
      render(<SearchKbdHint mode="slash" isMac={true} />);
      expect(screen.getByText("/")).toBeInTheDocument();
      expect(screen.queryByText("⌘")).toBeNull();
      expect(screen.queryByText("Ctrl")).toBeNull();
    });

    it("isMac=false 也只顯示 /", () => {
      render(<SearchKbdHint mode="slash" isMac={false} />);
      expect(screen.getByText("/")).toBeInTheDocument();
    });

    it("title 改成「按 / 快速搜尋」", () => {
      const { container } = render(<SearchKbdHint mode="slash" />);
      const kbd = container.querySelector("kbd");
      expect(kbd?.getAttribute("title")).toContain("/");
      expect(kbd?.getAttribute("title")).not.toContain("⌘K");
    });
  });

  it("自訂 title 覆蓋預設", () => {
    const { container } = render(
      <SearchKbdHint isMac={true} title="自訂提示" />,
    );
    const kbd = container.querySelector("kbd");
    expect(kbd?.getAttribute("title")).toBe("自訂提示");
  });

  it("自訂 className 覆蓋預設樣式", () => {
    const { container } = render(
      <SearchKbdHint isMac={true} className="my-custom-class" />,
    );
    const kbd = container.querySelector("kbd");
    expect(kbd?.className).toBe("my-custom-class");
  });

  it("預設 className 含 absolute / right-2 / sm:inline-flex（定位 + RWD）", () => {
    const { container } = render(<SearchKbdHint isMac={true} />);
    const kbd = container.querySelector("kbd");
    expect(kbd?.className).toContain("absolute");
    expect(kbd?.className).toContain("sm:inline-flex");
  });

  it("aria-hidden=true（螢幕閱讀器忽略）", () => {
    const { container } = render(<SearchKbdHint isMac={true} />);
    const kbd = container.querySelector("kbd");
    expect(kbd?.getAttribute("aria-hidden")).toBe("true");
  });
});
