// 成就判定規則 — 純函式（可獨立單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §9.2 §9.3 §9.5

export interface AchievementContext {
  squadId: string;
  totalGames: number;
  totalGamesRaw: number;
  totalWins: number;
  totalLosses: number;
  totalExpPoints: number;
  recruitsCount: number;
  fieldsPlayed: string[];
  /** 主場域場次 — 從 squad_match_records 統計（最常打的那個 fieldId）*/
  homeFieldGames: number;
  /** 各場域場次數（fieldId → games count）*/
  fieldGamesMap: Record<string, number>;
}

export interface AchievementDef {
  key: string;
  category: string;
  displayName: string;
  description: string;
  /** 判斷是否達成 */
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // 場次里程碑
  {
    key: "first_game",
    category: "milestone",
    displayName: "首戰之夜",
    description: "完成第一場遊戲",
    check: (ctx) => ctx.totalGamesRaw >= 1,
  },
  {
    key: "veteran_10",
    category: "milestone",
    displayName: "新銳之星",
    description: "累計 10 場",
    check: (ctx) => ctx.totalGamesRaw >= 10,
  },
  {
    key: "veteran_50",
    category: "milestone",
    displayName: "資深隊伍",
    description: "累計 50 場",
    check: (ctx) => ctx.totalGamesRaw >= 50,
  },
  {
    key: "hall_of_fame",
    category: "milestone",
    displayName: "百戰名人堂",
    description: "累計 100 場進入名人堂",
    check: (ctx) => ctx.totalGamesRaw >= 100,
  },
  {
    key: "legend_500",
    category: "milestone",
    displayName: "傳說隊伍",
    description: "累計 500 場",
    check: (ctx) => ctx.totalGamesRaw >= 500,
  },

  // 跨場域徽章
  {
    key: "local_regular",
    category: "cross_field",
    displayName: "本地常客",
    description: "主場域 50+ 場",
    check: (ctx) => ctx.homeFieldGames >= 50,
  },
  {
    key: "cross_field_2",
    category: "cross_field",
    displayName: "雙城傳說",
    description: "2 場域各 10+ 場",
    check: (ctx) => {
      const qualified = Object.values(ctx.fieldGamesMap).filter(
        (n) => n >= 10,
      ).length;
      return qualified >= 2;
    },
  },
  {
    key: "cross_field_3",
    category: "cross_field",
    displayName: "三城遠征",
    description: "3 場域各 10+ 場",
    check: (ctx) => {
      const qualified = Object.values(ctx.fieldGamesMap).filter(
        (n) => n >= 10,
      ).length;
      return qualified >= 3;
    },
  },
  {
    key: "cross_field_5",
    category: "cross_field",
    displayName: "全國巡迴",
    description: "5+ 場域各 5+ 場（超級隊長候選）",
    check: (ctx) => {
      const qualified = Object.values(ctx.fieldGamesMap).filter(
        (n) => n >= 5,
      ).length;
      return qualified >= 5;
    },
  },
  {
    key: "first_visit",
    category: "cross_field",
    displayName: "首戰場域",
    description: "第 1 次踏足新場域",
    check: (ctx) => ctx.fieldsPlayed.length >= 1,
  },

  // 招募徽章
  {
    key: "recruiter_starter",
    category: "recruit",
    displayName: "小招募家",
    description: "成功邀請 3 人加入",
    check: (ctx) => ctx.recruitsCount >= 3,
  },
  {
    key: "recruiter_master",
    category: "recruit",
    displayName: "招募達人",
    description: "成功邀請 10 人加入",
    check: (ctx) => ctx.recruitsCount >= 10,
  },
  {
    key: "super_recruiter",
    category: "recruit",
    displayName: "超級招募",
    description: "邀請 30 人 + 跨 2 場域",
    check: (ctx) =>
      ctx.recruitsCount >= 30 && ctx.fieldsPlayed.length >= 2,
  },

  // 體驗點數徽章（常客榜搭配）
  {
    key: "regular_100",
    category: "experience",
    displayName: "常客新生",
    description: "累計 100 體驗點數",
    check: (ctx) => ctx.totalExpPoints >= 100,
  },
  {
    key: "regular_500",
    category: "experience",
    displayName: "常客王",
    description: "累計 500 體驗點數",
    check: (ctx) => ctx.totalExpPoints >= 500,
  },
  {
    key: "regular_1000",
    category: "experience",
    displayName: "常客傳說",
    description: "累計 1000 體驗點數",
    check: (ctx) => ctx.totalExpPoints >= 1000,
  },
];

/**
 * 對給定 context 跑所有成就 check
 * 回傳達成的成就 key 列表
 */
export function evaluateAchievements(
  ctx: AchievementContext,
): AchievementDef[] {
  return ACHIEVEMENTS.filter((ach) => ach.check(ctx));
}
