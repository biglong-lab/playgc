/**
 * MetricCard 共用元件測試
 * 涵蓋：onClick / active ring / 鍵盤觸發 / live 脈衝 / accent 顏色 / icon / 無障礙屬性
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MetricCard from "../MetricCard";
import { Activity } from "lucide-react";

describe("MetricCard", () => {
  it("渲染 label 和 value", () => {
    render(<MetricCard label="進行中" value={5} testid="metric-test" />);
    expect(screen.getByText("進行中")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("傳入 onClick 時變 clickable（cursor-pointer + role=button + tabIndex=0）", () => {
    const onClick = vi.fn();
    render(<MetricCard label="click me" value={1} onClick={onClick} testid="metric-click" />);
    const card = screen.getByTestId("metric-click");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card.className).toContain("cursor-pointer");
  });

  it("沒 onClick 時不是 clickable", () => {
    render(<MetricCard label="display" value={10} testid="metric-display" />);
    const card = screen.getByTestId("metric-display");
    expect(card).not.toHaveAttribute("role", "button");
    expect(card).not.toHaveAttribute("tabindex");
  });

  it("點擊觸發 onClick", () => {
    const onClick = vi.fn();
    render(<MetricCard label="click" value={1} onClick={onClick} testid="m-click" />);
    fireEvent.click(screen.getByTestId("m-click"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Enter 鍵觸發 onClick", () => {
    const onClick = vi.fn();
    render(<MetricCard label="kbd" value={1} onClick={onClick} testid="m-kbd" />);
    fireEvent.keyDown(screen.getByTestId("m-kbd"), { key: "Enter" });
    expect(onClick).toHaveBeenCalled();
  });

  it("Space 鍵觸發 onClick", () => {
    const onClick = vi.fn();
    render(<MetricCard label="space" value={1} onClick={onClick} testid="m-space" />);
    fireEvent.keyDown(screen.getByTestId("m-space"), { key: " " });
    expect(onClick).toHaveBeenCalled();
  });

  it("其他鍵不觸發 onClick", () => {
    const onClick = vi.fn();
    render(<MetricCard label="other" value={1} onClick={onClick} testid="m-other" />);
    fireEvent.keyDown(screen.getByTestId("m-other"), { key: "Escape" });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("active=true 時 aria-pressed=true + ring class", () => {
    const onClick = vi.fn();
    render(
      <MetricCard
        label="active"
        value={1}
        onClick={onClick}
        active={true}
        testid="m-active"
      />,
    );
    const card = screen.getByTestId("m-active");
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card.className).toContain("ring-2");
    expect(card.className).toContain("ring-primary");
  });

  it("active=false 時 aria-pressed=false + 無 ring class", () => {
    const onClick = vi.fn();
    render(
      <MetricCard label="inactive" value={1} onClick={onClick} active={false} testid="m-inactive" />,
    );
    const card = screen.getByTestId("m-inactive");
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(card.className).not.toContain("ring-2");
  });

  it("accent=success 時 value 有 text-success class", () => {
    const { container } = render(
      <MetricCard label="score" value={100} accent="success" />,
    );
    const valueP = container.querySelector(".font-number.text-3xl");
    expect(valueP?.className).toContain("text-success");
  });

  it("accent=destructive 時 value 有 text-destructive class", () => {
    const { container } = render(
      <MetricCard label="err" value={3} accent="destructive" />,
    );
    const valueP = container.querySelector(".font-number.text-3xl");
    expect(valueP?.className).toContain("text-destructive");
  });

  it("accent=muted 時 value 有 text-muted-foreground class", () => {
    const { container } = render(
      <MetricCard label="empty" value={0} accent="muted" />,
    );
    const valueP = container.querySelector(".font-number.text-3xl");
    expect(valueP?.className).toContain("text-muted-foreground");
  });

  it("live=true 時渲染脈衝點（animate-ping class）", () => {
    const { container } = render(
      <MetricCard label="LIVE" value={2} live accent="success" />,
    );
    const pulse = container.querySelector(".animate-ping");
    expect(pulse).not.toBeNull();
  });

  it("live=false 時不渲染脈衝點", () => {
    const { container } = render(<MetricCard label="quiet" value={0} />);
    const pulse = container.querySelector(".animate-ping");
    expect(pulse).toBeNull();
  });

  it("sublabel 被渲染", () => {
    render(<MetricCard label="total" value={10} sublabel="副標題" />);
    expect(screen.getByText("副標題")).toBeInTheDocument();
  });

  it("傳入 icon 時 svg 被渲染", () => {
    const { container } = render(
      <MetricCard label="icon" value={5} icon={Activity} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("value 可接受字串 — 顯示破折號", () => {
    render(<MetricCard label="empty score" value="—" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
