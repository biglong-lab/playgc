/**
 * useSearchShortcut Hook 測試
 * 測試 `/` / Cmd+K / Ctrl+K / Esc 鍵盤 shortcut 行為
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchShortcut } from "../useSearchShortcut";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// Mock platform - default non-Mac
vi.mock("@/lib/platform", () => ({
  isMacOS: vi.fn(() => false),
}));

/**
 * 模擬在 window 上 dispatch keydown event，可指定 target
 */
function dispatchKey(
  key: string,
  opts: { target?: HTMLElement | null; meta?: boolean; ctrl?: boolean; alt?: boolean } = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    metaKey: !!opts.meta,
    ctrlKey: !!opts.ctrl,
    altKey: !!opts.alt,
    bubbles: true,
    cancelable: true,
  });
  if (opts.target) {
    Object.defineProperty(event, "target", { value: opts.target, writable: false });
  }
  window.dispatchEvent(event);
  return event;
}

describe("useSearchShortcut", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
    vi.clearAllMocks();
  });

  it("回傳 inputRef、isMac、handleEscape", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    expect(result.current.inputRef).toBeDefined();
    expect(typeof result.current.isMac).toBe("boolean");
    expect(typeof result.current.handleEscape).toBe("function");
  });

  it("按 `/` 時 focus + select input", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    // 把 ref 指到 input
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;

    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

    act(() => {
      dispatchKey("/", { target: document.body });
    });

    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
  });

  it("按 Cmd+K 時 focus + select input（非 disableCmdK）", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    act(() => {
      dispatchKey("k", { target: document.body, meta: true });
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("按 Ctrl+K 時 focus input（非 disableCmdK）", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    act(() => {
      dispatchKey("k", { target: document.body, ctrl: true });
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("disableCmdK=true 時按 Cmd+K 不 focus", () => {
    const { result } = renderHook(() =>
      useSearchShortcut<HTMLInputElement>({ disableCmdK: true }),
    );
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    act(() => {
      dispatchKey("k", { target: document.body, meta: true });
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("disableCmdK=true 時按 `/` 仍 focus（/ 總是啟用）", () => {
    const { result } = renderHook(() =>
      useSearchShortcut<HTMLInputElement>({ disableCmdK: true }),
    );
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    act(() => {
      dispatchKey("/", { target: document.body });
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("使用者正在 input 打字時忽略 `/`（不搶焦點）", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    // target 是另一個 input
    const otherInput = document.createElement("input");
    document.body.appendChild(otherInput);

    act(() => {
      dispatchKey("/", { target: otherInput });
    });

    expect(focusSpy).not.toHaveBeenCalled();
    document.body.removeChild(otherInput);
  });

  it("使用者正在 textarea 打字時忽略 Cmd+K", () => {
    const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    act(() => {
      dispatchKey("k", { target: textarea, meta: true });
    });

    expect(focusSpy).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  describe("handleEscape", () => {
    it("有內容時清空（呼叫 setValue('')）", () => {
      const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
      const setValue = vi.fn();
      const mockEvent = {
        key: "Escape",
        currentTarget: input,
      } as unknown as ReactKeyboardEvent<HTMLInputElement>;

      result.current.handleEscape(mockEvent, "hello", setValue);
      expect(setValue).toHaveBeenCalledWith("");
    });

    it("空內容時失焦（呼叫 currentTarget.blur()）", () => {
      const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
      const setValue = vi.fn();
      const blurSpy = vi.spyOn(input, "blur");
      const mockEvent = {
        key: "Escape",
        currentTarget: input,
      } as unknown as ReactKeyboardEvent<HTMLInputElement>;

      result.current.handleEscape(mockEvent, "", setValue);
      expect(blurSpy).toHaveBeenCalled();
      expect(setValue).not.toHaveBeenCalled();
    });

    it("非 Esc 鍵時不動作", () => {
      const { result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
      const setValue = vi.fn();
      const blurSpy = vi.spyOn(input, "blur");
      const mockEvent = {
        key: "Enter",
        currentTarget: input,
      } as unknown as ReactKeyboardEvent<HTMLInputElement>;

      result.current.handleEscape(mockEvent, "hello", setValue);
      expect(setValue).not.toHaveBeenCalled();
      expect(blurSpy).not.toHaveBeenCalled();
    });
  });

  it("unmount 時清除 window listener（不洩漏）", () => {
    const { unmount, result } = renderHook(() => useSearchShortcut<HTMLInputElement>());
    (result.current.inputRef as { current: HTMLInputElement | null }).current = input;
    const focusSpy = vi.spyOn(input, "focus");

    unmount();

    // unmount 後按 `/` 不應觸發 focus
    act(() => {
      dispatchKey("/", { target: document.body });
    });
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
