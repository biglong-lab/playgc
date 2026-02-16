import { describe, it, expect } from "vitest";
import { pageTransition, countdownNumber, rankingItem, celebrationPop } from "./animation-variants";

describe("animation-variants", () => {
  it("pageTransition 包含 initial/animate/exit", () => {
    expect(pageTransition).toHaveProperty("initial");
    expect(pageTransition).toHaveProperty("animate");
    expect(pageTransition).toHaveProperty("exit");
  });

  it("countdownNumber 包含 initial/animate/exit", () => {
    expect(countdownNumber).toHaveProperty("initial");
    expect(countdownNumber).toHaveProperty("animate");
    expect(countdownNumber).toHaveProperty("exit");
  });

  it("rankingItem 包含 initial/animate/exit", () => {
    expect(rankingItem).toHaveProperty("initial");
    expect(rankingItem).toHaveProperty("animate");
    expect(rankingItem).toHaveProperty("exit");
  });

  it("celebrationPop 包含 initial/animate", () => {
    expect(celebrationPop).toHaveProperty("initial");
    expect(celebrationPop).toHaveProperty("animate");
  });
});
