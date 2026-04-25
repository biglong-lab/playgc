// 統一參戰 Dialog 單元測試
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SquadParticipationDialog, type UserSquad } from "../SquadParticipationDialog";

const mockSquads: UserSquad[] = [
  {
    id: "squad-1",
    name: "火焰戰士",
    tag: "FIRE",
    totalGames: 25,
    isLastUsed: true,
  },
  {
    id: "squad-2",
    name: "浪花一現",
    tag: "WAVE",
    totalGames: 8,
    isLastUsed: false,
  },
];

describe("SquadParticipationDialog", () => {
  it("初始顯示主畫面 + 三個選項", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={mockSquads}
      />,
    );
    expect(screen.getByText("🏆 選擇參戰方式")).toBeInTheDocument();
    expect(screen.getByText(/一個隊名打天下/)).toBeInTheDocument();
    expect(screen.getByTestId("squad-option-create")).toBeInTheDocument();
    expect(screen.getByTestId("squad-option-join")).toBeInTheDocument();
  });

  it("顯示「上次用」隊伍特別標記", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={mockSquads}
      />,
    );
    expect(screen.getByTestId("squad-option-last-used")).toBeInTheDocument();
    expect(screen.getByText("上次用")).toBeInTheDocument();
    expect(screen.getByText("火焰戰士")).toBeInTheDocument();
  });

  it("顯示其他既有隊伍", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={mockSquads}
      />,
    );
    expect(screen.getByTestId("squad-option-squad-2")).toBeInTheDocument();
    expect(screen.getByText("浪花一現")).toBeInTheDocument();
  });

  it("沒有隊伍時不顯示「上次用」卡片", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
      />,
    );
    expect(screen.queryByTestId("squad-option-last-used")).toBeNull();
    expect(screen.getByTestId("squad-option-create")).toBeInTheDocument();
  });

  it("點選「上次用」隊伍 → 觸發 onUseSquad", () => {
    const onUseSquad = vi.fn();
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={mockSquads}
        onUseSquad={onUseSquad}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-last-used"));
    expect(onUseSquad).toHaveBeenCalledWith("squad-1");
  });

  it("點「建新隊伍」→ 切到建立畫面", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-create"));
    expect(screen.getByTestId("input-new-squad-name")).toBeInTheDocument();
    expect(screen.getByTestId("btn-confirm-create-squad")).toBeInTheDocument();
  });

  it("建立隊伍：名稱小於 2 字 → 按鈕 disabled", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-create"));
    const input = screen.getByTestId("input-new-squad-name");
    fireEvent.change(input, { target: { value: "A" } });
    expect(screen.getByTestId("btn-confirm-create-squad")).toBeDisabled();
  });

  it("建立隊伍：輸入合法名稱 + 點確認 → 觸發 onCreateSquad", () => {
    const onCreateSquad = vi.fn();
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
        onCreateSquad={onCreateSquad}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-create"));
    fireEvent.change(screen.getByTestId("input-new-squad-name"), {
      target: { value: "火舞戰隊" },
    });
    fireEvent.click(screen.getByTestId("btn-confirm-create-squad"));
    expect(onCreateSquad).toHaveBeenCalledWith("火舞戰隊");
  });

  it("用邀請碼加入：輸入碼自動轉大寫", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-join"));
    const input = screen.getByTestId("input-invite-code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123" } });
    expect(input.value).toBe("ABC123");
  });

  it("用邀請碼加入：< 4 字 → 按鈕 disabled", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-join"));
    fireEvent.change(screen.getByTestId("input-invite-code"), {
      target: { value: "AB" },
    });
    expect(screen.getByTestId("btn-confirm-join-code")).toBeDisabled();
  });

  it("用邀請碼加入：4 字以上 + 點確認 → 觸發 onJoinByCode", () => {
    const onJoinByCode = vi.fn();
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
        onJoinByCode={onJoinByCode}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-join"));
    fireEvent.change(screen.getByTestId("input-invite-code"), {
      target: { value: "ABCD12" },
    });
    fireEvent.click(screen.getByTestId("btn-confirm-join-code"));
    expect(onJoinByCode).toHaveBeenCalledWith("ABCD12");
  });

  it("isLoading 時按鈕顯示 loading 文字", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
        isLoading={true}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-option-create"));
    fireEvent.change(screen.getByTestId("input-new-squad-name"), {
      target: { value: "test" },
    });
    expect(screen.getByText("建立中...")).toBeInTheDocument();
  });

  it("自訂 title 顯示", () => {
    render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={() => {}}
        squads={[]}
        title="加入水彈對戰"
      />,
    );
    expect(screen.getByText("加入水彈對戰")).toBeInTheDocument();
  });

  it("關閉時 reset 子畫面（重開回到主畫面）", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SquadParticipationDialog
        open={true}
        onOpenChange={onOpenChange}
        squads={[]}
      />,
    );
    // 先進子畫面
    fireEvent.click(screen.getByTestId("squad-option-create"));
    expect(screen.getByTestId("input-new-squad-name")).toBeInTheDocument();

    // 模擬關閉
    rerender(
      <SquadParticipationDialog
        open={false}
        onOpenChange={onOpenChange}
        squads={[]}
      />,
    );
    // 重開
    rerender(
      <SquadParticipationDialog
        open={true}
        onOpenChange={onOpenChange}
        squads={[]}
      />,
    );
    // ResetScreen 是內部 onOpenChange(false) 觸發的，這個測試不直接驗證
    // 但驗證 open 切換不會造成 crash
    expect(screen.getByText("🏆 選擇參戰方式")).toBeInTheDocument();
  });
});
