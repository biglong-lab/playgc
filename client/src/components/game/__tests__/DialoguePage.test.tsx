/**
 * DialoguePage 核心行為測試 — 特別驗證 PR1 修復：nextPageId 傳遞
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DialoguePage from "../DialoguePage";
import type { DialogueConfig } from "@shared/schema";

function renderWith(config: DialogueConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <DialoguePage
        config={config}
        onComplete={onComplete}
        sessionId="test-session"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("DialoguePage — PR1 onComplete 簽名", () => {
  it("空 messages 顯示 fallback 並可繼續，傳入 config.nextPageId", () => {
    const { onComplete } = renderWith({
      character: { name: "角色" },
      messages: [],
      nextPageId: "empty-next",
      rewardPoints: 10,
    });

    expect(screen.getByText(/沒有對話內容/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /繼續/ }));

    expect(onComplete).toHaveBeenCalledWith({ points: 10 }, "empty-next");
  });

  it("空 messages 未設 rewardPoints → reward 為 undefined", () => {
    const { onComplete } = renderWith({
      character: { name: "角色" },
      messages: [],
      nextPageId: "p1",
    });

    fireEvent.click(screen.getByRole("button"));
    expect(onComplete).toHaveBeenCalledWith(undefined, "p1");
  });

  it("有 messages 時正常渲染角色名稱", () => {
    renderWith({
      character: { name: "NPC-A" },
      messages: [{ text: "測試訊息" }],
    });
    expect(screen.getByText("NPC-A")).toBeTruthy();
  });
});
