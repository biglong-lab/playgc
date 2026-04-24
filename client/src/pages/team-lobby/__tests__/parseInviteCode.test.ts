// parseInviteCode 純函式測試（從 URL search string 解出 ?code=）
import { describe, it, expect } from "vitest";
import { parseInviteCode } from "../useTeamLobby";

describe("parseInviteCode", () => {
  it("?code=ABC123 → ABC123", () => {
    expect(parseInviteCode("?code=ABC123")).toBe("ABC123");
  });

  it("小寫自動轉大寫", () => {
    expect(parseInviteCode("?code=abc123")).toBe("ABC123");
  });

  it("沒有 code 參數 → 空字串", () => {
    expect(parseInviteCode("?other=value")).toBe("");
    expect(parseInviteCode("")).toBe("");
  });

  it("空 code → 空字串", () => {
    expect(parseInviteCode("?code=")).toBe("");
  });

  it("4 位數英數 → 通過", () => {
    expect(parseInviteCode("?code=AB12")).toBe("AB12");
  });

  it("8 位數英數 → 通過", () => {
    expect(parseInviteCode("?code=ABCD1234")).toBe("ABCD1234");
  });

  it("小於 4 位 → 拒絕", () => {
    expect(parseInviteCode("?code=AB1")).toBe("");
  });

  it("大於 8 位 → 拒絕", () => {
    expect(parseInviteCode("?code=ABCDEFGHIJ")).toBe("");
  });

  it("含特殊字元 → 拒絕（防注入）", () => {
    expect(parseInviteCode("?code=ABC<script>")).toBe("");
    expect(parseInviteCode("?code=ABC%20DEF")).toBe("");
    expect(parseInviteCode("?code=ABC-123")).toBe("");
  });

  it("多個參數混合 → 只取 code", () => {
    expect(parseInviteCode("?gameId=xyz&code=AB12&foo=bar")).toBe("AB12");
  });
});
