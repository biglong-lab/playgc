import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SkillMap, SkillMapConfig, SkillMapState } from "../SkillMap";

const defaultConfig: SkillMapConfig = {
  title: "🗺️ 技能地圖",
  prompt: "告訴大家你能提供什麼、你需要什麼",
  offerLabel: "我能提供",
  needLabel: "我需要",
  maxLength: 80,
};

const emptyState: SkillMapState = { maps: [], revealed: false };

describe("SkillMap", () => {
  it("renders title and prompt", () => {
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-title")).toHaveTextContent("🗺️ 技能地圖");
    expect(screen.getByTestId("sm-prompt")).toHaveTextContent("告訴大家你能提供什麼");
  });

  it("renders offer and need inputs", () => {
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-offer-input")).toBeInTheDocument();
    expect(screen.getByTestId("sm-need-input")).toBeInTheDocument();
  });

  it("shows empty indicator when no maps", () => {
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-empty")).toBeInTheDocument();
  });

  it("shows count correctly", () => {
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u2", userName: "Alice", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-count")).toHaveTextContent("1");
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with offer and need", () => {
    const onSubmit = vi.fn();
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("sm-offer-input"), { target: { value: "前端開發" } });
    fireEvent.change(screen.getByTestId("sm-need-input"), { target: { value: "資料分析" } });
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("前端開發", "資料分析");
  });

  it("does not submit when offer is empty", () => {
    const onSubmit = vi.fn();
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("sm-need-input"), { target: { value: "資料分析" } });
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when need is empty", () => {
    const onSubmit = vi.fn();
    render(
      <SkillMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("sm-offer-input"), { target: { value: "前端開發" } });
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-entry when user has submitted", () => {
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u1", userName: "Me", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-my-entry")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u1", userName: "Me", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("sm-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal clicked", () => {
    const onReveal = vi.fn();
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u1", userName: "Me", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("sm-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows all entries when revealed", () => {
    const state: SkillMapState = {
      maps: [
        { mapId: "m1", userId: "u2", userName: "Alice", offer: "設計", need: "程式" },
        { mapId: "m2", userId: "u3", userName: "Bob", offer: "業務", need: "行銷" },
      ],
      revealed: true,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sm-result")).toBeInTheDocument();
    expect(screen.getByTestId("sm-entry-m1")).toBeInTheDocument();
    expect(screen.getByTestId("sm-entry-m2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u1", userName: "Me", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sm-reveal-btn")).toBeNull();
  });

  it("does not show submit after user submitted", () => {
    const state: SkillMapState = {
      maps: [{ mapId: "m1", userId: "u1", userName: "Me", offer: "設計", need: "程式" }],
      revealed: false,
    };
    render(
      <SkillMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sm-submit-btn")).toBeNull();
  });
});
