import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamBattleScore, {
  buildInitialBattleState,
  reduceScore,
  reduceReset,
  reduceFinish,
  DEFAULT_BATTLE_TEAMS,
  type TeamBattleScoreConfig,
  type TeamBattleScoreState,
} from "../TeamBattleScore";

const sampleConfig: TeamBattleScoreConfig = {
  title: "紅藍對抗",
  teams: DEFAULT_BATTLE_TEAMS,
  targetScore: 10,
  mode: "first_to_target",
};

describe("TeamBattleScore reducer", () => {
  describe("buildInitialBattleState", () => {
    it("預設兩隊（紅藍）皆 0 分", () => {
      const state = buildInitialBattleState({});
      expect(state.scores).toEqual({ red: 0, blue: 0 });
      expect(state.recentEvents).toEqual([]);
      expect(state.winner).toBeNull();
      expect(state.status).toBe("playing");
    });

    it("自訂多隊伍可以建初始 state", () => {
      const state = buildInitialBattleState({
        teams: [
          { id: "a", name: "A", color: "#000" },
          { id: "b", name: "B", color: "#fff" },
          { id: "c", name: "C", color: "#888" },
        ],
      });
      expect(Object.keys(state.scores)).toEqual(["a", "b", "c"]);
      expect(state.scores.a).toBe(0);
    });
  });

  describe("reduceScore", () => {
    it("有效加分：scores 累加 + recentEvents 推入", () => {
      const initial = buildInitialBattleState(sampleConfig);
      const next = reduceScore(initial, { teamId: "red", points: 3 }, sampleConfig);
      expect(next.scores.red).toBe(3);
      expect(next.scores.blue).toBe(0);
      expect(next.recentEvents).toHaveLength(1);
      expect(next.recentEvents[0].teamId).toBe("red");
      expect(next.recentEvents[0].points).toBe(3);
    });

    it("達 targetScore 自動鎖 winner + status=finished", () => {
      const initial = buildInitialBattleState(sampleConfig);
      const s1 = reduceScore(initial, { teamId: "red", points: 7 }, sampleConfig);
      expect(s1.winner).toBeNull();
      const s2 = reduceScore(s1, { teamId: "red", points: 5 }, sampleConfig);
      expect(s2.scores.red).toBe(12);
      expect(s2.winner).toBe("red");
      expect(s2.status).toBe("finished");
    });

    it("finished 後不再加分", () => {
      const finished: TeamBattleScoreState = {
        scores: { red: 12, blue: 0 },
        recentEvents: [],
        winner: "red",
        status: "finished",
      };
      const next = reduceScore(finished, { teamId: "blue", points: 100 }, sampleConfig);
      expect(next).toBe(finished); // 同 reference 表示沒變
    });

    it("不存在的 teamId 不影響 state", () => {
      const initial = buildInitialBattleState(sampleConfig);
      const next = reduceScore(initial, { teamId: "ghost", points: 5 }, sampleConfig);
      expect(next).toBe(initial);
    });

    it("points <= 0 不影響 state", () => {
      const initial = buildInitialBattleState(sampleConfig);
      expect(reduceScore(initial, { teamId: "red", points: 0 }, sampleConfig)).toBe(initial);
      expect(reduceScore(initial, { teamId: "red", points: -5 }, sampleConfig)).toBe(initial);
    });

    it("recentEvents 超過 20 筆會 truncate", () => {
      const initial = buildInitialBattleState({ teams: DEFAULT_BATTLE_TEAMS });
      let state = initial;
      for (let i = 0; i < 25; i++) {
        state = reduceScore(state, { teamId: "red", points: 1 }, { teams: DEFAULT_BATTLE_TEAMS, mode: "free" });
      }
      expect(state.recentEvents.length).toBe(20);
    });

    it("highest mode 達 target 不自動結束", () => {
      const config: TeamBattleScoreConfig = { teams: DEFAULT_BATTLE_TEAMS, targetScore: 5, mode: "highest" };
      const initial = buildInitialBattleState(config);
      const next = reduceScore(initial, { teamId: "red", points: 10 }, config);
      expect(next.winner).toBeNull();
      expect(next.status).toBe("playing");
    });
  });

  describe("reduceReset", () => {
    it("回到初始 state", () => {
      const reset = reduceReset(sampleConfig);
      expect(reset.scores).toEqual({ red: 0, blue: 0 });
      expect(reset.recentEvents).toEqual([]);
      expect(reset.winner).toBeNull();
      expect(reset.status).toBe("playing");
    });
  });

  describe("reduceFinish", () => {
    it("找最高分的隊伍當 winner + 設 finished", () => {
      const state: TeamBattleScoreState = {
        scores: { red: 5, blue: 8 },
        recentEvents: [],
        winner: null,
        status: "playing",
      };
      const next = reduceFinish(state);
      expect(next.winner).toBe("blue");
      expect(next.status).toBe("finished");
    });

    it("已 finished 不重複處理", () => {
      const state: TeamBattleScoreState = {
        scores: { red: 5, blue: 8 },
        recentEvents: [],
        winner: "blue",
        status: "finished",
      };
      const next = reduceFinish(state);
      expect(next).toBe(state);
    });
  });
});

describe("TeamBattleScore UI", () => {
  it("hostMode 顯示標題 + 兩隊伍 + 分數", () => {
    render(
      <TeamBattleScore
        config={sampleConfig}
        hostMode={true}
        state={{
          scores: { red: 3, blue: 7 },
          recentEvents: [],
          winner: null,
          status: "playing",
        }}
      />,
    );
    expect(screen.getByText("紅藍對抗")).toBeInTheDocument();
    expect(screen.getByText("紅隊")).toBeInTheDocument();
    expect(screen.getByText("藍隊")).toBeInTheDocument();
    expect(screen.getByTestId("team-score-red")).toHaveTextContent("3");
    expect(screen.getByTestId("team-score-blue")).toHaveTextContent("7");
  });

  it("winner 顯示勝出標誌", () => {
    render(
      <TeamBattleScore
        config={sampleConfig}
        hostMode={true}
        state={{
          scores: { red: 12, blue: 7 },
          recentEvents: [],
          winner: "red",
          status: "finished",
        }}
      />,
    );
    expect(screen.getByText(/勝出/)).toBeInTheDocument();
  });

  it("玩家模式 + acceptPlayerPulse=true 顯示加分按鈕", () => {
    const onPulse = vi.fn();
    render(
      <TeamBattleScore
        config={{ ...sampleConfig, acceptPlayerPulse: true }}
        hostMode={false}
        state={buildInitialBattleState(sampleConfig)}
        onPulse={onPulse}
      />,
    );
    const redBtn = screen.getByTestId("player-score-btn-red");
    fireEvent.click(redBtn);
    expect(onPulse).toHaveBeenCalledWith("score", { teamId: "red", points: 1 });
  });

  it("玩家模式 + acceptPlayerPulse=false 不顯示按鈕", () => {
    render(
      <TeamBattleScore
        config={sampleConfig}
        hostMode={false}
        state={buildInitialBattleState(sampleConfig)}
      />,
    );
    expect(screen.queryByTestId("player-score-btn-red")).not.toBeInTheDocument();
  });

  it("recentEvents 顯示最近 8 筆", () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      teamId: i % 2 === 0 ? "red" : "blue",
      points: i + 1,
      ts: Date.now() - i * 1000,
    }));
    render(
      <TeamBattleScore
        config={sampleConfig}
        hostMode={true}
        state={{
          scores: { red: 50, blue: 30 },
          recentEvents: events,
          winner: null,
          status: "playing",
        }}
      />,
    );
    const recentDiv = screen.getByTestId("recent-events");
    // 最多顯示 8 筆
    const spans = recentDiv.querySelectorAll("span");
    expect(spans.length).toBeLessThanOrEqual(8);
  });
});
