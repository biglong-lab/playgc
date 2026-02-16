import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RelayProgress from "../RelayProgress";

const makeParticipant = (segment: number, status: string) => ({
  relaySegment: segment,
  relayStatus: status,
});

describe("RelayProgress", () => {
  it("渲染正確的段落數", () => {
    render(<RelayProgress participants={[]} segmentCount={3} />);
    expect(screen.getByTestId("segment-0")).toBeInTheDocument();
    expect(screen.getByTestId("segment-1")).toBeInTheDocument();
    expect(screen.getByTestId("segment-2")).toBeInTheDocument();
  });

  it("segmentCount=0 不渲染", () => {
    const { container } = render(<RelayProgress participants={[]} segmentCount={0} />);
    expect(container.querySelector("[data-testid='relay-progress']")).not.toBeInTheDocument();
  });

  it("completed 段落為綠色", () => {
    const participants = [makeParticipant(1, "completed")];
    render(<RelayProgress participants={participants} segmentCount={2} />);
    expect(screen.getByTestId("segment-0")).toHaveAttribute("data-status", "completed");
    expect(screen.getByTestId("segment-0").className).toContain("bg-green-500");
  });

  it("active 段落為藍色脈衝", () => {
    const participants = [makeParticipant(1, "active")];
    render(<RelayProgress participants={participants} segmentCount={2} />);
    expect(screen.getByTestId("segment-0")).toHaveAttribute("data-status", "active");
    expect(screen.getByTestId("segment-0").className).toContain("bg-blue-500");
    expect(screen.getByTestId("segment-0").className).toContain("animate-pulse");
  });

  it("pending 段落為 muted", () => {
    render(<RelayProgress participants={[]} segmentCount={2} />);
    expect(screen.getByTestId("segment-0")).toHaveAttribute("data-status", "pending");
    expect(screen.getByTestId("segment-0").className).toContain("bg-muted");
  });

  it("進行中顯示第 N/M 段進行中", () => {
    const participants = [
      makeParticipant(1, "completed"),
      makeParticipant(2, "active"),
    ];
    render(<RelayProgress participants={participants} segmentCount={3} />);
    expect(screen.getByText("第 2/3 段進行中")).toBeInTheDocument();
  });

  it("全部完成顯示接力完成", () => {
    const participants = [
      makeParticipant(1, "completed"),
      makeParticipant(2, "completed"),
    ];
    render(<RelayProgress participants={participants} segmentCount={2} />);
    expect(screen.getByText("接力完成！")).toBeInTheDocument();
  });

  it("無 active 段落顯示 N/M 段已完成", () => {
    const participants = [makeParticipant(1, "completed")];
    render(<RelayProgress participants={participants} segmentCount={3} />);
    expect(screen.getByText("1/3 段已完成")).toBeInTheDocument();
  });
});
