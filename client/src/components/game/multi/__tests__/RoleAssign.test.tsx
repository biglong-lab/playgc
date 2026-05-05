import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RoleAssign from "../RoleAssign";
import type { RoleAssignConfig, RoleAssignProps } from "../RoleAssign";
import type { RoleDefinition } from "../RoleAssign";

const roles: RoleDefinition[] = [
  { id: "r1", name: "偵探", emoji: "🔍", description: "調查線索，找出真相", color: "#3b82f6" },
  { id: "r2", name: "嫌犯", emoji: "🕵️", description: "保護自己，隱藏秘密", color: "#ef4444" },
  { id: "r3", name: "證人", emoji: "👁️", description: "觀察一切，適時說出", color: "#10b981" },
];

const config: RoleAssignConfig = { title: "角色分派", roles };

const makeProps = (overrides: Partial<RoleAssignProps> = {}): RoleAssignProps => ({
  config,
  state: { assignments: { Alice: "r1" } },
  myUserName: "Alice",
  onAssign: vi.fn(),
  onReroll: vi.fn(),
  ...overrides,
});

describe("RoleAssign", () => {
  it("顯示標題", () => {
    render(<RoleAssign {...makeProps()} />);
    expect(screen.getByText("角色分派")).toBeInTheDocument();
  });

  it("顯示分配到的角色名稱", () => {
    render(<RoleAssign {...makeProps()} />);
    expect(screen.getByText("偵探")).toBeInTheDocument();
  });

  it("顯示角色 emoji", () => {
    render(<RoleAssign {...makeProps()} />);
    expect(screen.getByText("🔍")).toBeInTheDocument();
  });

  it("顯示角色說明", () => {
    render(<RoleAssign {...makeProps()} />);
    expect(screen.getByText("調查線索，找出真相")).toBeInTheDocument();
  });

  it("state=null 時自動呼叫 onAssign 分配角色", () => {
    const onAssign = vi.fn();
    render(<RoleAssign {...makeProps({ state: null, onAssign })} />);
    expect(onAssign).toHaveBeenCalled();
  });

  it("沒有分配到角色且 roles 空時顯示等待訊息", () => {
    render(
      <RoleAssign config={{ title: "測試", roles: [] }} state={null}
        myUserName="Alice" onAssign={vi.fn()} />,
    );
    expect(screen.getByText(/等待角色分配/)).toBeInTheDocument();
  });

  it("allowReroll=true 顯示重新抽按鈕", () => {
    render(
      <RoleAssign {...makeProps({ config: { ...config, allowReroll: true } })} />,
    );
    expect(screen.getByTestId("btn-reroll")).toBeInTheDocument();
  });

  it("allowReroll=false 不顯示重新抽按鈕", () => {
    render(<RoleAssign {...makeProps()} />);
    expect(screen.queryByTestId("btn-reroll")).not.toBeInTheDocument();
  });

  it("點擊重新抽呼叫 onReroll", () => {
    const onReroll = vi.fn();
    render(
      <RoleAssign {...makeProps({ config: { ...config, allowReroll: true }, onReroll })} />,
    );
    fireEvent.click(screen.getByTestId("btn-reroll"));
    expect(onReroll).toHaveBeenCalled();
  });

  it("有隊友時顯示隊友角色區", () => {
    const state = { assignments: { Alice: "r1", Bob: "r2" } };
    render(<RoleAssign {...makeProps({ state })} />);
    expect(screen.getByText(/隊友角色/)).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("隊友的秘密角色只顯示（秘密角色）", () => {
    const secretRoles: RoleDefinition[] = [
      ...roles,
      { id: "r4", name: "臥底", emoji: "🤫", description: "秘密任務內容", isSecret: true },
    ];
    const state = { assignments: { Alice: "r1", Bob: "r4" } };
    render(
      <RoleAssign
        config={{ ...config, roles: secretRoles }}
        state={state}
        myUserName="Alice"
        onAssign={vi.fn()}
      />,
    );
    expect(screen.getByText(/秘密角色/)).toBeInTheDocument();
    expect(screen.queryByText("秘密任務內容")).not.toBeInTheDocument();
  });

  it("自己是秘密角色時顯示點擊揭開按鈕", () => {
    const secretRoles: RoleDefinition[] = [
      { id: "r1", name: "臥底", emoji: "🤫", description: "秘密", isSecret: true },
    ];
    const state = { assignments: { Alice: "r1" } };
    render(
      <RoleAssign
        config={{ ...config, roles: secretRoles }}
        state={state}
        myUserName="Alice"
        onAssign={vi.fn()}
      />,
    );
    expect(screen.getByTestId("btn-reveal-role")).toBeInTheDocument();
  });

  it("點擊揭開秘密角色後顯示角色內容", () => {
    const secretRoles: RoleDefinition[] = [
      { id: "r1", name: "臥底", emoji: "🤫", description: "你的秘密任務是找出主謀", isSecret: true },
    ];
    const state = { assignments: { Alice: "r1" } };
    render(
      <RoleAssign
        config={{ ...config, roles: secretRoles }}
        state={state}
        myUserName="Alice"
        onAssign={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-reveal-role"));
    expect(screen.getByText("你的秘密任務是找出主謀")).toBeInTheDocument();
  });
});
