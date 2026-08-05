// 🗳️ 投票分母改用「在隊 ∩ 在線」— ADR-0024 根治
//
// 背景：原本分母只看 isNull(leftAt)，斷線的人一直算在分母裡 → 投票永遠
// 達不到門檻 → 遊戲卡死。系統為了解卡，用 auto_leave 去改斷線者的
// 「成員身分」（寫 leftAt）—— 結果玩家切背景回來就發現自己不在隊上。
// 生產實測 279 次 auto_leave 中有 71 次（25%）該玩家其實還在玩。
//
// 根因是「用成員身分表達在線狀態」。改成分母只計在線成員後，
// 斷線者自然不卡投票，就不必動他的身分。
//
// 這裡測的是那條核心規則，以及不能因此壞掉的既有行為。

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVotes: Array<{
  id: string;
  teamId: string;
  status: string;
  votingMode: string;
  ballots: Array<{ userId: string; optionId: string }>;
}> = [];
let mockMembers: Array<{ userId: string }> = [];
const updateSet = vi.fn();

vi.mock("../db", () => ({
  db: {
    query: {
      teamVotes: { findMany: vi.fn(async () => mockVotes) },
      teamMembers: { findMany: vi.fn(async () => mockMembers) },
    },
    update: () => ({ set: (v: unknown) => { updateSet(v); return { where: async () => undefined }; } }),
  },
}));

const { reevaluateTeamVotes } = await import("../lib/team-vote-eval");

/** 建一個「3 人隊、2 人已投同一選項、多數決」的情境 */
function setup(opts: { members: string[]; voted: string[] }) {
  mockMembers = opts.members.map((userId) => ({ userId }));
  mockVotes.length = 0;
  mockVotes.push({
    id: "vote-1",
    teamId: "team-1",
    status: "active",
    votingMode: "majority",
    ballots: opts.voted.map((userId) => ({ userId, optionId: "opt-A" })),
  });
}

const broadcast = vi.fn();

beforeEach(() => {
  broadcast.mockClear();
  updateSet.mockClear();
});

describe("投票分母：在隊 ∩ 在線", () => {
  // 多數決門檻 = ceil(分母/2)，所以案例要挑「有無在線判斷會導致不同結果」的組合：
  //   4 人隊、2 人斷線、只有 1 人投票
  //     舊行為 分母 4 → 需 2 票 → 只有 1 票 → 卡住
  //     新行為 分母 2 → 需 1 票 → 有 1 票 → 達標
  it("🔑 斷線者不計入分母 → 在線的人投完就達標，遊戲不卡住", async () => {
    setup({ members: ["A", "B", "C", "D"], voted: ["A"] });
    const online = (_t: string, u: string) => u === "A" || u === "B";

    await reevaluateTeamVotes("team-1", broadcast, online);

    expect(broadcast).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "vote_completed", winningOptionId: "opt-A" }),
    );
  });

  it("同樣情境下、不傳在線判斷則維持舊行為（卡住不達標）", async () => {
    // 這一則與上一則是同一組資料，唯一差別就是有沒有傳 isUserOnline，
    // 用來證明「達標」確實是在線判斷造成的，而不是碰巧。
    setup({ members: ["A", "B", "C", "D"], voted: ["A"] });

    await reevaluateTeamVotes("team-1", broadcast);

    expect(broadcast).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("斷線者先前投的票仍然算數（分子看在隊、不看在線）", async () => {
    // A 投了然後斷線、B 也投了 → 票不該因為斷線就消失
    setup({ members: ["A", "B"], voted: ["A", "B"] });
    const online = (_t: string, u: string) => u !== "A";

    await reevaluateTeamVotes("team-1", broadcast, online);

    expect(broadcast).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "vote_completed" }),
    );
  });

  it("🛡️ 全隊都斷線 → 分母保留 1，不會 0/0 自動過關", async () => {
    // 沒有人投票、也沒有人在線 → 不該達標把遊戲推進下一關
    setup({ members: ["A", "B", "C"], voted: [] });
    const allOffline = () => false;

    await reevaluateTeamVotes("team-1", broadcast, allOffline);

    expect(broadcast).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("已離隊者的票不算進分子（既有防幽靈票行為不變）", async () => {
    // C 已離隊（不在 members 裡）但 ballots 仍有他的票
    mockMembers = [{ userId: "A" }, { userId: "B" }];
    mockVotes.length = 0;
    mockVotes.push({
      id: "vote-1", teamId: "team-1", status: "active", votingMode: "majority",
      ballots: [{ userId: "A", optionId: "opt-A" }, { userId: "C", optionId: "opt-A" }],
    });

    // 只有 A 在線、B 斷線 → 分母 1、A 已投 → 達標（C 的幽靈票不影響判定）
    await reevaluateTeamVotes("team-1", broadcast, (_t, u) => u === "A");

    expect(broadcast).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "vote_completed" }),
    );
  });

  it("沒有進行中的投票時直接返回、不做任何事", async () => {
    mockMembers = [{ userId: "A" }];
    mockVotes.length = 0;

    await reevaluateTeamVotes("team-1", broadcast, () => true);

    expect(broadcast).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });
});
