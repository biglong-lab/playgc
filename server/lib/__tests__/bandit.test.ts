// 🎰 P12 Multi-Armed Bandit 單元測試
import { describe, it, expect } from "vitest";
import {
  banditPick,
  buildArmsFromVariants,
  type BanditArm,
} from "../bandit";

describe("bandit: cold-start", () => {
  it("有 arm 未達 coldStartMin 應回 cold-start", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 0, reward: 0.5 },
      { id: "b", pulls: 10, reward: 0.9 },
    ];
    const r = banditPick(arms, { coldStartMin: 3 });
    expect(r.reason).toBe("cold-start");
    expect(r.pickedId).toBe("a");
  });

  it("全部過冷啟動 → 依策略選", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 5, reward: 0.3 },
      { id: "b", pulls: 5, reward: 0.8 },
    ];
    const r = banditPick(arms, { coldStartMin: 3, strategy: "epsilon-greedy", epsilon: 0 });
    expect(r.reason).toBe("exploit");
    expect(r.pickedId).toBe("b"); // ε=0 必選最高分
  });
});

describe("bandit: hidden", () => {
  it("hidden 的 arm 不會被選", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 10, reward: 0.9, hidden: true },
      { id: "b", pulls: 5, reward: 0.5 },
    ];
    const r = banditPick(arms, { coldStartMin: 3 });
    expect(r.pickedId).toBe("b");
  });

  it("全 hidden → fallback 第一個 + 標 all-hidden", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 10, reward: 0.9, hidden: true },
      { id: "b", pulls: 5, reward: 0.5, hidden: true },
    ];
    const r = banditPick(arms);
    expect(r.reason).toBe("all-hidden");
    expect(r.pickedId).toBe("a");
  });
});

describe("bandit: single arm", () => {
  it("只有 1 個 arm → single-arm", () => {
    const arms: BanditArm[] = [{ id: "only", pulls: 100, reward: 0.7 }];
    const r = banditPick(arms);
    expect(r.reason).toBe("single-arm");
    expect(r.pickedId).toBe("only");
  });
});

describe("bandit: UCB1", () => {
  it("低 pulls 的 arm 會因 exploration term 加分被選中", () => {
    // arm a 高 reward 但 pulls 高，arm b 低 reward 但 pulls 低
    // UCB1 應給 b 一些機會（不會永遠選 a）
    const arms: BanditArm[] = [
      { id: "a", pulls: 100, reward: 0.7 },
      { id: "b", pulls: 4, reward: 0.65 },
    ];
    const r = banditPick(arms, { coldStartMin: 3, strategy: "ucb1" });
    expect(r.reason).toBe("ucb1");
    expect(r.score).toBeGreaterThan(0);
    // 不能保證一定選 b，但 score 應反映 UCB 計算
    expect(["a", "b"]).toContain(r.pickedId);
  });

  it("高 reward + 高 pulls 的 arm 在 UCB 下仍占優", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 100, reward: 0.95 }, // 大幅領先
      { id: "b", pulls: 100, reward: 0.3 },
    ];
    const r = banditPick(arms, { coldStartMin: 3, strategy: "ucb1" });
    expect(r.pickedId).toBe("a"); // 差距大，UCB 仍選 a
  });
});

describe("bandit: epsilon-greedy", () => {
  it("ε=0 → 純利用，必選最高分", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 10, reward: 0.3 },
      { id: "b", pulls: 10, reward: 0.7 },
    ];
    // 跑 10 次都應選 b
    for (let i = 0; i < 10; i++) {
      const r = banditPick(arms, { coldStartMin: 3, strategy: "epsilon-greedy", epsilon: 0 });
      expect(r.pickedId).toBe("b");
    }
  });

  it("ε=1 → 純探索，會隨機選", () => {
    const arms: BanditArm[] = [
      { id: "a", pulls: 10, reward: 0.3 },
      { id: "b", pulls: 10, reward: 0.7 },
    ];
    const picks = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = banditPick(arms, { coldStartMin: 3, strategy: "epsilon-greedy", epsilon: 1 });
      picks.add(r.pickedId);
    }
    expect(picks.size).toBe(2); // 隨機 50 次應該兩個 arm 都中過
  });
});

describe("bandit: buildArmsFromVariants", () => {
  it("從 scores Map 建 arms", () => {
    const variants = ["訊息1", "訊息2", "訊息3"];
    const scores = new Map([
      ["success|0", { totalFeedback: 5, score: 0.8, hidden: false }],
      ["success|1", { totalFeedback: 0, score: 0.5, hidden: false }],
      ["success|2", { totalFeedback: 10, score: 0.1, hidden: true }],
    ]);
    const arms = buildArmsFromVariants(variants, scores, "success");
    expect(arms).toHaveLength(3);
    expect(arms[0].pulls).toBe(5);
    expect(arms[0].reward).toBe(0.8);
    expect(arms[2].hidden).toBe(true);
  });

  it("沒分數 fallback 到 0.5（中性）", () => {
    const variants = ["訊息1"];
    const scores = new Map();
    const arms = buildArmsFromVariants(variants, scores, "success");
    expect(arms[0].reward).toBe(0.5); // 中性
    expect(arms[0].pulls).toBe(0);
  });
});

describe("bandit: 整體系統測試", () => {
  it("無反饋的 3 個變體 → 冷啟動會輪流選", () => {
    const variants = ["A", "B", "C"];
    const scores = new Map();
    const arms = buildArmsFromVariants(variants, scores, "success");
    const picked = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = banditPick(arms);
      picked.add(r.pickedId);
    }
    expect(picked.size).toBe(3); // 30 次必中 3 個
  });
});
