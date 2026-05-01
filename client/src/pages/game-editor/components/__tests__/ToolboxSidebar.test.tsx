// ToolboxSidebar 測試 — 聚焦 gameMode 過濾邏輯（Phase 2.B）
//
// 不測整個 UI 渲染（已被既有 e2e 覆蓋），只測新加的元件分類邏輯：
//   - 個人遊戲（gameMode='individual'）→ 隱藏 multi 專用元件
//   - 多人遊戲（gameMode='team'/'competitive'/'relay'）→ 全部顯示
//   - 未指定 gameMode（建立中）→ 全部顯示

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolboxSidebar from "../ToolboxSidebar";

const baseProps = {
  onDragStart: vi.fn(),
  onDragEnd: vi.fn(),
  onAddTemplate: vi.fn(),
};

describe("ToolboxSidebar — gameMode 過濾", () => {
  it("gameMode='individual' 時隱藏 5 個 multi 元件", () => {
    render(<ToolboxSidebar {...baseProps} gameMode="individual" />);

    // multi 元件不應在 toolbox
    expect(screen.queryByTestId("toolbox-photo_team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbox-vote_team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbox-shooting_team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbox-gps_team_mission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbox-choice_verify_race")).not.toBeInTheDocument();

    // 個人 / 通用元件正常顯示
    expect(screen.getByTestId("toolbox-text_card")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-vote")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-shooting_mission")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-gps_mission")).toBeInTheDocument();
  });

  it("gameMode='team' 時顯示全部 27 種元件", () => {
    render(<ToolboxSidebar {...baseProps} gameMode="team" />);

    // multi 元件全部顯示
    expect(screen.getByTestId("toolbox-photo_team")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-vote_team")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-shooting_team")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-gps_team_mission")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-choice_verify_race")).toBeInTheDocument();

    // 個人 / 通用元件也全部顯示（不對稱規則 v1.2）
    expect(screen.getByTestId("toolbox-text_card")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-shooting_mission")).toBeInTheDocument();
  });

  it("gameMode='competitive' 跟 'relay' 也允許 multi 元件", () => {
    const { rerender } = render(
      <ToolboxSidebar {...baseProps} gameMode="competitive" />,
    );
    expect(screen.getByTestId("toolbox-vote_team")).toBeInTheDocument();

    rerender(<ToolboxSidebar {...baseProps} gameMode="relay" />);
    expect(screen.getByTestId("toolbox-vote_team")).toBeInTheDocument();
  });

  it("未指定 gameMode（undefined）→ 顯示全部（建立新遊戲時）", () => {
    render(<ToolboxSidebar {...baseProps} />);

    expect(screen.getByTestId("toolbox-vote_team")).toBeInTheDocument();
    expect(screen.getByTestId("toolbox-text_card")).toBeInTheDocument();
  });

  it("gameMode=null（資料未載入）→ 顯示全部", () => {
    render(<ToolboxSidebar {...baseProps} gameMode={null} />);
    expect(screen.getByTestId("toolbox-vote_team")).toBeInTheDocument();
  });
});
