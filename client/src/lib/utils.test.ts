// utils.ts 測試
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("應該合併單一 class name", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("應該合併多個 class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("應該處理條件式 class names", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz");
  });

  it("應該處理物件形式的 class names", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("應該處理陣列形式的 class names", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("應該合併 Tailwind 衝突的 classes", () => {
    // twMerge 會保留最後一個衝突的 class
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("應該處理 undefined 和 null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("應該處理空字串", () => {
    expect(cn("foo", "", "bar")).toBe("foo bar");
  });
});
