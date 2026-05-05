import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WishBucket, WishBucketConfig, WishBucketState } from "../WishBucket";

const defaultConfig: WishBucketConfig = {
  title: "🌟 許願桶",
  prompt: "把你的期望投入",
  placeholder: "寫下你的願望...",
  maxLength: 150,
  anonymous: false,
};

const emptyState: WishBucketState = { wishes: [], revealed: false };

describe("WishBucket", () => {
  it("renders title and prompt", () => {
    render(
      <WishBucket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-title")).toHaveTextContent("🌟 許願桶");
    expect(screen.getByTestId("wb-prompt")).toHaveTextContent("把你的期望投入");
  });

  it("shows empty indicator", () => {
    render(
      <WishBucket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-empty")).toBeInTheDocument();
  });

  it("shows input and submit button", () => {
    render(
      <WishBucket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-input")).toBeInTheDocument();
    expect(screen.getByTestId("wb-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with wish text", () => {
    const onSubmit = vi.fn();
    render(
      <WishBucket config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("wb-input"), { target: { value: "希望大家都健康" } });
    fireEvent.click(screen.getByTestId("wb-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("希望大家都健康");
  });

  it("does not submit empty wish", () => {
    const onSubmit = vi.fn();
    render(
      <WishBucket config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("wb-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows count badge", () => {
    const state: WishBucketState = {
      wishes: [{ wishId: "w1", userId: "u2", userName: "Alice", wish: "健康", anonymous: false }],
      revealed: false,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-count")).toHaveTextContent("1");
  });

  it("shows my-wish after submitted", () => {
    const state: WishBucketState = {
      wishes: [{ wishId: "w1", userId: "u1", userName: "Me", wish: "健康", anonymous: false }],
      revealed: false,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-my-wish")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: WishBucketState = {
      wishes: [{ wishId: "w1", userId: "u2", userName: "Alice", wish: "健康", anonymous: false }],
      revealed: false,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = vi.fn();
    const state: WishBucketState = {
      wishes: [{ wishId: "w1", userId: "u2", userName: "Alice", wish: "健康", anonymous: false }],
      revealed: false,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("wb-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows all wishes when revealed", () => {
    const state: WishBucketState = {
      wishes: [
        { wishId: "w1", userId: "u2", userName: "Alice", wish: "健康", anonymous: false },
        { wishId: "w2", userId: "u3", userName: "Bob", wish: "快樂", anonymous: false },
      ],
      revealed: true,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("wb-result")).toBeInTheDocument();
    expect(screen.getByTestId("wb-wish-w1")).toBeInTheDocument();
    expect(screen.getByTestId("wb-wish-w2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: WishBucketState = {
      wishes: [{ wishId: "w1", userId: "u2", userName: "Alice", wish: "健康", anonymous: false }],
      revealed: false,
    };
    render(
      <WishBucket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("wb-reveal-btn")).toBeNull();
  });
});
