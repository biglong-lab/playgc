// 🛡️ 未存變更攔截 hook 測試 — 站內換頁 / 連結點擊 / 三選一對話框
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/admin/games/g-1", mockNavigate],
}));

import {
  resolveInternalLinkTarget,
  useUnsavedChangesGuard,
} from "../useUnsavedWarning";
import UnsavedChangesDialog from "@/components/shared/UnsavedChangesDialog";

const CURRENT = "http://localhost:3000/admin/games/g-1";

/** 建一個指定屬性的 <a>，回傳點擊它時的 MouseEvent（不真的派送） */
function clickOn(attrs: Record<string, string>, init: MouseEventInit = {}): MouseEvent {
  const a = document.createElement("a");
  Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v));
  const span = document.createElement("span");
  a.appendChild(span);
  document.body.appendChild(a);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, "target", { value: span });
  return event;
}

describe("resolveInternalLinkTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("站內連結 → 回傳目標路徑（含 query）", () => {
    expect(resolveInternalLinkTarget(clickOn({ href: "/admin/games/g-1/items?x=1" }), CURRENT))
      .toBe("/admin/games/g-1/items?x=1");
  });

  it("另開分頁 / 下載 / 外部網域 → 不攔截", () => {
    expect(resolveInternalLinkTarget(clickOn({ href: "/a", target: "_blank" }), CURRENT)).toBeNull();
    expect(resolveInternalLinkTarget(clickOn({ href: "/a.csv", download: "" }), CURRENT)).toBeNull();
    expect(resolveInternalLinkTarget(clickOn({ href: "https://example.com/x" }), CURRENT)).toBeNull();
  });

  it("按住修飾鍵（開新分頁）或非左鍵 → 不攔截", () => {
    expect(resolveInternalLinkTarget(clickOn({ href: "/a" }, { metaKey: true }), CURRENT)).toBeNull();
    expect(resolveInternalLinkTarget(clickOn({ href: "/a" }, { ctrlKey: true }), CURRENT)).toBeNull();
    expect(resolveInternalLinkTarget(clickOn({ href: "/a" }, { button: 1 }), CURRENT)).toBeNull();
  });

  it("同頁錨點 → 不攔截", () => {
    expect(resolveInternalLinkTarget(clickOn({ href: "#section" }), CURRENT)).toBeNull();
  });

  it("點的不是連結 → 不攔截", () => {
    const event = new MouseEvent("click", { bubbles: true, button: 0 });
    Object.defineProperty(event, "target", { value: document.body });
    expect(resolveInternalLinkTarget(event, CURRENT)).toBeNull();
  });
});

interface HarnessProps {
  isDirty: boolean;
  onSave: () => Promise<boolean>;
}

function Harness({ isDirty, onSave }: HarnessProps) {
  const guard = useUnsavedChangesGuard({ isDirty, onSave });
  return (
    <div>
      <button type="button" onClick={() => guard.guardNavigate("/admin/games")}>返回</button>
      <a href="/admin/games/g-1/items">道具</a>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("沒有未存變更 → guardNavigate 直接換頁、不跳對話框", async () => {
    render(<Harness isDirty={false} onSave={vi.fn()} />);
    await userEvent.click(screen.getByText("返回"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/games");
    expect(screen.queryByText("有未儲存的變更")).toBeNull();
  });

  it("有未存變更 → 先跳對話框、不換頁", async () => {
    render(<Harness isDirty onSave={vi.fn()} />);
    await userEvent.click(screen.getByText("返回"));
    expect(screen.getByText("有未儲存的變更")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("選「不存離開」→ 換到原本要去的頁", async () => {
    const onSave = vi.fn();
    render(<Harness isDirty onSave={onSave} />);
    await userEvent.click(screen.getByText("返回"));
    await userEvent.click(screen.getByTestId("button-leave-without-saving"));
    expect(onSave).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/admin/games");
  });

  it("選「取消」→ 留在原頁", async () => {
    render(<Harness isDirty onSave={vi.fn()} />);
    await userEvent.click(screen.getByText("返回"));
    await userEvent.click(screen.getByTestId("button-cancel-leave"));
    await waitFor(() => expect(screen.queryByText("有未儲存的變更")).toBeNull());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("選「儲存後離開」→ 先存、成功才換頁", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness isDirty onSave={onSave} />);
    await userEvent.click(screen.getByText("返回"));
    await userEvent.click(screen.getByTestId("button-save-and-leave"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/admin/games"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("「儲存後離開」存檔失敗 → 不換頁、對話框留著", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<Harness isDirty onSave={onSave} />);
    await userEvent.click(screen.getByText("返回"));
    await userEvent.click(screen.getByTestId("button-save-and-leave"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("有未儲存的變更")).toBeInTheDocument();
  });

  it("有未存變更時點站內連結（如 wouter Link）→ 被攔下跳對話框", async () => {
    render(<Harness isDirty onSave={vi.fn()} />);
    const event = fireEvent.click(screen.getByText("道具"));
    // fireEvent 回傳 false = 預設行為被 preventDefault（瀏覽器 / Link 都不會換頁）
    expect(event).toBe(false);
    expect(await screen.findByText("有未儲存的變更")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-leave-without-saving"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/games/g-1/items");
  });

  it("沒有未存變更時點連結 → 不攔截", () => {
    const onLinkClick = vi.fn((e: Event) => e.preventDefault()); // 擋掉 jsdom 真的換文件
    render(<Harness isDirty={false} onSave={vi.fn()} />);
    screen.getByText("道具").addEventListener("click", onLinkClick);
    fireEvent.click(screen.getByText("道具"));
    expect(onLinkClick).toHaveBeenCalled();
    expect(screen.queryByText("有未儲存的變更")).toBeNull();
  });

  it("有未存變更時關分頁 / 重新整理 → 仍註冊 beforeunload 警告", () => {
    render(<Harness isDirty onSave={vi.fn()} />);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
