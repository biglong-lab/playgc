// 🎪 活動元件編輯器測試（CHITO c609d0c3）
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HostComponentEditor, { HOST_FIELD_SCHEMAS } from "../HostComponentEditor";

// 17 個活動元件型別（來源：constants.ts 拖曳側欄）
const ALL_HOST_TYPES = [
  "host_word_cloud", "host_poll_live", "host_emoji_react", "host_wave_response",
  "host_crowd_gather", "host_trivia_showdown", "host_live_leaderboard",
  "host_team_battle_score", "host_progress_quest", "host_polaroid_collage",
  "host_guestbook_digital", "host_blessing_wall", "host_knowledge_map",
  "host_scoreboard_announcement", "host_lottery_wheel", "host_bingo_board",
  "host_micro_qa",
];

describe("HostComponentEditor", () => {
  it("🔑 17 個活動元件型別全部有 schema（沒有任何一個掉回唯讀 JSON）", () => {
    const missing = ALL_HOST_TYPES.filter((t) => !HOST_FIELD_SCHEMAS[t]);
    expect(missing, `以下型別沒有編輯器 schema，管理員無法設定：${missing.join(", ")}`).toEqual([]);
  });

  it("每個 schema 都渲染得出來", () => {
    for (const type of ALL_HOST_TYPES) {
      const { unmount } = render(
        <HostComponentEditor pageType={type} config={{}} updateField={() => {}} />,
      );
      expect(screen.getByTestId(`host-editor-${type}`), `${type} 渲染失敗`).toBeTruthy();
      unmount();
    }
  });

  it("文字欄位編輯會呼叫 updateField", () => {
    const update = vi.fn();
    render(
      <HostComponentEditor
        pageType="host_word_cloud"
        config={{ title: "舊標題" }}
        updateField={update}
      />,
    );
    fireEvent.change(screen.getByTestId("host-field-title"), { target: { value: "新標題" } });
    expect(update).toHaveBeenCalledWith("title", "新標題");
  });

  it("投票選項：新增一筆會產生含 id 的完整物件", () => {
    const update = vi.fn();
    render(
      <HostComponentEditor pageType="host_poll_live" config={{ options: [] }} updateField={update} />,
    );
    fireEvent.click(screen.getByTestId("host-field-options-add"));
    const [key, value] = update.mock.calls[0];
    expect(key).toBe("options");
    expect(value).toEqual([{ id: "opt-1", label: "選項 1" }]);
  });

  describe("搶答題雙向轉換（底層形狀 ↔ 表格列）", () => {
    const q = {
      id: "q1",
      prompt: "金門最大的紀念日？",
      options: ["823 砲戰", "古寧頭", "921", "雙十"],
      correctIdx: 0,
      timeLimitSec: 15,
    };

    it("底層題目正確攤成表格欄位", () => {
      render(
        <HostComponentEditor
          pageType="host_trivia_showdown"
          config={{ questions: [q] }}
          updateField={() => {}}
        />,
      );
      expect((screen.getByTestId("host-field-questions-0-prompt") as HTMLInputElement).value)
        .toBe("金門最大的紀念日？");
      expect((screen.getByTestId("host-field-questions-0-opt1") as HTMLInputElement).value)
        .toBe("823 砲戰");
      // correctIdx 0 → 顯示 1（人類語意）
      expect((screen.getByTestId("host-field-questions-0-correct") as HTMLInputElement).value)
        .toBe("1");
    });

    it("改表格欄位寫回底層形狀不失真（options 陣列 + correctIdx 0-based）", () => {
      const update = vi.fn();
      render(
        <HostComponentEditor
          pageType="host_trivia_showdown"
          config={{ questions: [q] }}
          updateField={update}
        />,
      );
      fireEvent.change(screen.getByTestId("host-field-questions-0-correct"), {
        target: { value: "3" },
      });
      const [, value] = update.mock.calls[0];
      const saved = (value as Array<Record<string, unknown>>)[0];
      expect(saved.correctIdx).toBe(2); // 人填 3 → 底層 0-based 2
      expect(saved.options).toEqual(["823 砲戰", "古寧頭", "921", "雙十"]);
      expect(saved.prompt).toBe("金門最大的紀念日？");
      expect(saved.id).toBe("q1");
    });

    it("正解超出範圍會被夾住（防存出壞資料）", () => {
      const update = vi.fn();
      render(
        <HostComponentEditor
          pageType="host_trivia_showdown"
          config={{ questions: [q] }}
          updateField={update}
        />,
      );
      fireEvent.change(screen.getByTestId("host-field-questions-0-correct"), {
        target: { value: "9" },
      });
      const saved = (update.mock.calls[0][1] as Array<Record<string, unknown>>)[0];
      expect(saved.correctIdx).toBe(3); // 夾到最大 3
    });
  });

  it("未涵蓋的型別回 null（讓 PageConfigEditor 走原 JSON fallback）", () => {
    const { container } = render(
      <HostComponentEditor pageType="unknown_type" config={{}} updateField={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
