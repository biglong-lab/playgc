// 🎉 互動模組庫設定面板渲染測試（CHITO 0541db39）
// 目的：確認 21 個活動互動元件在編輯器渲染的是「表單」而非唯讀 JSON。
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HostComponentEditor, { HOST_FIELD_SCHEMAS } from "../HostComponentEditor";
import { EVENT_MODULE_SCHEMAS } from "../eventModuleSchemas";
import { getDefaultConfig } from "../getDefaultConfig";

const TYPES = Object.keys(EVENT_MODULE_SCHEMAS);

describe("互動模組設定面板", () => {
  it("每個型別都渲染得出表單，且欄位都畫出來", () => {
    for (const type of TYPES) {
      const { unmount } = render(
        <HostComponentEditor
          pageType={type}
          config={getDefaultConfig(type) as Record<string, unknown>}
          updateField={() => {}}
        />,
      );
      expect(screen.getByTestId(`host-editor-${type}`), `${type} 沒渲染出設定面板`).toBeTruthy();
      for (const field of HOST_FIELD_SCHEMAS[type]) {
        // 清單型欄位渲染的是「新增」按鈕 + 逐列輸入框，沒有單一輸入框
        const testId =
          field.kind === "object-list" || field.kind === "string-list"
            ? `host-field-${field.key}-add`
            : `host-field-${field.key}`;
        expect(screen.queryByTestId(testId), `${type} 缺少欄位 ${field.key}`).toBeTruthy();
      }
      unmount();
    }
  });

  it("編輯欄位會寫回設定（以活動筆記為例）", () => {
    const update = vi.fn();
    render(
      <HostComponentEditor
        pageType="activity_memo"
        config={{ title: "活動筆記" }}
        updateField={update}
      />,
    );
    fireEvent.change(screen.getByTestId("host-field-keywordPrompt"), {
      target: { value: "今天學到什麼？" },
    });
    expect(update).toHaveBeenCalledWith("keywordPrompt", "今天學到什麼？");
  });

  it("現場投票可以新增候選選項（產出含 id 的完整物件）", () => {
    const update = vi.fn();
    render(
      <HostComponentEditor pageType="spot_vote" config={{ spots: [] }} updateField={update} />,
    );
    fireEvent.click(screen.getByTestId("host-field-spots-add"));
    const [key, value] = update.mock.calls[0];
    expect(key).toBe("spots");
    expect(Array.isArray(value)).toBe(true);
    expect((value as Record<string, unknown>[])[0]).toMatchObject({ id: "spot-1" });
  });
});
