// authUtils.ts 測試
import { describe, it, expect } from "vitest";
import { isUnauthorizedError } from "./authUtils";

describe("isUnauthorizedError", () => {
  it("應該識別 401 Unauthorized 錯誤", () => {
    const error = new Error("401: Unauthorized");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("應該識別帶有額外訊息的 401 Unauthorized 錯誤", () => {
    const error = new Error("401: Unauthorized - Please login");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("應該不匹配其他錯誤代碼", () => {
    expect(isUnauthorizedError(new Error("400: Bad Request"))).toBe(false);
    expect(isUnauthorizedError(new Error("403: Forbidden"))).toBe(false);
    expect(isUnauthorizedError(new Error("404: Not Found"))).toBe(false);
    expect(isUnauthorizedError(new Error("500: Internal Server Error"))).toBe(false);
  });

  it("應該不匹配不含 Unauthorized 的 401 錯誤", () => {
    // 根據正則 /^401: .*Unauthorized/，需要 "401: " 開頭且包含 "Unauthorized"
    const error = new Error("401: Invalid Token");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("應該不匹配一般錯誤訊息", () => {
    expect(isUnauthorizedError(new Error("Something went wrong"))).toBe(false);
    expect(isUnauthorizedError(new Error("Unauthorized access"))).toBe(false);
  });

  it("應該不匹配空字串錯誤", () => {
    expect(isUnauthorizedError(new Error(""))).toBe(false);
  });
});
