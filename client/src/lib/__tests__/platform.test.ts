/**
 * platform.ts — isMacOS 偵測工具測試
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { isMacOS } from "../platform";

const originalNavigator = globalThis.navigator;

function mockNavigator(overrides: Partial<Navigator> = {}) {
  Object.defineProperty(globalThis, "navigator", {
    value: { ...originalNavigator, ...overrides },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
});

describe("isMacOS", () => {
  it("navigator 未定義時回 false（SSR 環境）", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isMacOS()).toBe(false);
  });

  it("navigator.platform 含 MacIntel → true", () => {
    mockNavigator({ platform: "MacIntel" });
    expect(isMacOS()).toBe(true);
  });

  it("navigator.platform 含 iPhone → true", () => {
    mockNavigator({ platform: "iPhone" });
    expect(isMacOS()).toBe(true);
  });

  it("navigator.platform 含 iPad → true", () => {
    mockNavigator({ platform: "iPad" });
    expect(isMacOS()).toBe(true);
  });

  it("navigator.platform Windows → false", () => {
    mockNavigator({ platform: "Win32" });
    expect(isMacOS()).toBe(false);
  });

  it("navigator.platform Linux → false", () => {
    mockNavigator({ platform: "Linux x86_64" });
    expect(isMacOS()).toBe(false);
  });

  it("platform 為空時 fallback userAgent 含 Mac → true", () => {
    mockNavigator({
      platform: "",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    expect(isMacOS()).toBe(true);
  });

  it("platform 和 userAgent 都為 Windows → false", () => {
    mockNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });
    expect(isMacOS()).toBe(false);
  });
});
