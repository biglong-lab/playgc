import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import {
  teams,
  teamMembers,
  teamSessions,
  gameSessions,
  squads,
  squadMembers,
  users,
} from "@shared/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm"; // desc 用於 activeSessionId 查詢
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { registerTeamVoteRoutes } from "./team-votes";
import { registerTeamScoreRoutes } from "./team-scores";
import { registerTeamLifecycleRoutes } from "./team-lifecycle";

/** 建立隊伍的請求驗證
 * 🛡️ 2026-05-04: name 接受空字串（轉 undefined）— 用既有 Squad 出戰時不必輸入名字、由 server fallback 用 squad name
 */
const createTeamBodySchema = z.object({
  name: z
    .string()
    .max(50)
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  // 🆕 PR4：以「永久隊伍」身份開場
  squadId: z.string().uuid().optional(),
  // 🆕 CHITO #7：訪客在大廳輸入的遊戲暱稱（帶進來寫入 users.firstName）
  displayName: z.string().max(50).optional(),
});

/** 加入隊伍的請求驗證 */
const joinTeamBodySchema = z.object({
  accessCode: z.string().min(1, "請輸入組隊碼"),
  // 🆕 CHITO #7：訪客遊戲暱稱
  displayName: z.string().max(50).optional(),
});

/**
 * 🐛 修 bug（ProPlan CHITO #7）：訪客暱稱只存 localStorage / gameSessions.playerName，
 *   沒進 users 表 → 多人隊伍成員列表（讀 users.firstName）顯示 user-xxx@firebase.local。
 *   修法：訪客建立/加入隊伍時把暱稱寫進自己的 users.firstName。
 *   僅限匿名訪客（email 為 *@firebase.local）才覆寫，避免蓋掉 Google 帳號真名。
 */
async function persistGuestDisplayName(userId: string, rawName?: string): Promise<void> {
  const name = rawName?.trim();
  if (!name) return;
  const user = await storage.getUser(userId);
  if (!user || !user.email?.endsWith("@firebase.local")) return;
  const clean = name.slice(0, 50);
  if (user.firstName === clean) return;
  await db.update(users).set({ firstName: clean, updatedAt: new Date() }).where(eq(users.id, userId));
}

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function registerTeamRoutes(app: Express, ctx: RouteContext) {
  // 註冊子模組路由
  registerTeamVoteRoutes(app, ctx);
  registerTeamScoreRoutes(app, ctx);
  registerTeamLifecycleRoutes(app, ctx);

  // ===========================================
  // 隊伍管理路由 (Team CRUD)
  // ===========================================

  // 建立隊伍
  app.post(
    "/api/games/:gameId/teams",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const teamModes = ["team", "competitive", "relay"];
        if (!teamModes.includes(game.gameMode ?? "")) {
          return res.status(400).json({ message: "此遊戲不支援團隊模式" });
        }

        const existingMembership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
          with: {
            team: true,
          },
        });

        if (
          existingMembership &&
          existingMembership.team.gameId === gameId &&
          ["forming", "ready", "playing"].includes(
            existingMembership.team.status || "",
          )
        ) {
          return res.status(400).json({
            message: "您已在此遊戲的隊伍中",
            teamId: existingMembership.teamId,
          });
        }

        let accessCode = generateAccessCode();
        let attempts = 0;
        while (attempts < 10) {
          const existing = await db.query.teams.findFirst({
            where: eq(teams.accessCode, accessCode),
          });
          if (!existing) break;
          accessCode = generateAccessCode();
          attempts++;
        }

        const body = createTeamBodySchema.parse(req.body);

        // 🆕 PR4：若帶 squadId，驗證該玩家是該 Squad active 成員，並把 team 名稱用 squad 名稱
        let squadId: string | null = null;
        let squadName: string | null = null;
        if (body.squadId) {
          const { squadMembers, squads } = await import("@shared/schema");
          const [membership] = await db
            .select({ squad: squads })
            .from(squadMembers)
            .innerJoin(squads, eq(squads.id, squadMembers.squadId))
            .where(
              and(
                eq(squadMembers.squadId, body.squadId),
                eq(squadMembers.userId, userId),
                isNull(squadMembers.leftAt),
              ),
            )
            .limit(1);
          if (!membership) {
            return res.status(403).json({ message: "你不是此隊伍的成員" });
          }
          squadId = body.squadId;
          squadName = `[${membership.squad.tag}] ${membership.squad.name}`;
        }

        const [team] = await db
          .insert(teams)
          .values({
            gameId,
            name: body.name || squadName || `隊伍 ${accessCode}`,
            accessCode,
            leaderId: userId,
            status: "forming",
            minPlayers: game.minTeamPlayers || 2,
            maxPlayers: game.maxTeamPlayers || 6,
            settings: {},
            squadId,
          })
          .returning();

        await db.insert(teamMembers).values({
          teamId: team.id,
          userId,
          role: "leader",
          isReady: false,
        });

        const fullTeam = await db.query.teams.findFirst({
          where: eq(teams.id, team.id),
          with: {
            members: {
              with: {
                user: true,
              },
            },
            game: true,
            leader: true,
          },
        });

        res.status(201).json(fullTeam);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "建立隊伍失敗" });
      }
    },
  );

  // 加入隊伍
  app.post(
    "/api/teams/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const body = joinTeamBodySchema.parse(req.body);
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const team = await db.query.teams.findFirst({
          where: eq(teams.accessCode, body.accessCode.toUpperCase()),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
            },
            game: true,
          },
        });

        if (!team) {
          return res
            .status(404)
            .json({ message: "找不到此組隊碼對應的隊伍" });
        }

        if (team.status === "completed" || team.status === "disbanded") {
          return res
            .status(400)
            .json({ message: "此隊伍已結束或已解散" });
        }

        if (team.status === "playing") {
          return res
            .status(400)
            .json({ message: "此隊伍正在遊戲中，無法加入" });
        }

        const existingMember = team.members.find((m) => m.userId === userId);

        // 🛡️ 2026-05-05 fix：「已在此隊伍中」改 idempotent — 直接回 team data
        //   原 bug：第一次 join 寫入成功但 client 沒跳頁（跨遊戲組隊碼）→
        //          第二次按 → 400 → toast 報錯、體驗很差
        //   修法：existingMember 也回 200 + team；client onSuccess 統一跳轉處理
        if (!existingMember) {
          if (team.members.length >= (team.maxPlayers || 6)) {
            return res.status(400).json({ message: "隊伍已滿員" });
          }

          await db.insert(teamMembers).values({
            teamId: team.id,
            userId,
            role: "member",
            isReady: false,
          });
        }

        const updatedTeam = await db.query.teams.findFirst({
          where: eq(teams.id, team.id),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
              with: {
                user: true,
              },
            },
            game: true,
            leader: true,
          },
        });

        // 用 broadcastToTeam（teamClients map）對齊 client 的 team_join；之前用 broadcastToSession
        // 廣播到不存在的 session room "team_${id}" → client 收不到（房間 + 名稱雙錯）
        // existingMember 場景跳過廣播（避免重複通知）
        if (!existingMember) {
          ctx.broadcastToTeam(team.id, {
            type: "team_member_joined",
            userId,
            team: updatedTeam,
          });
        }

        res.json(updatedTeam);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "加入隊伍失敗" });
      }
    },
  );

  // 取得隊伍資料
  app.get(
    "/api/teams/:teamId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;

        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
              with: {
                user: true,
              },
            },
            game: true,
            leader: true,
          },
        });

        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }

        res.json(team);
      } catch (error) {
        res.status(500).json({ message: "取得隊伍資料失敗" });
      }
    },
  );

  // 取得我在此遊戲的隊伍
  app.get(
    "/api/games/:gameId/my-team",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        // 🔧 Fix（2026-05-02）：原本用 findFirst 沒過濾 gameId，
        //   會撈到 user 在別的遊戲的 active team，導致剛建的隊伍看不到。
        //   改用 findMany + 應用層過濾（兼容測試 mock 環境）
        const memberships = await db.query.teamMembers.findMany({
          where: and(
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
          with: {
            team: {
              with: {
                game: true,
                members: {
                  where: isNull(teamMembers.leftAt),
                  with: { user: true },
                },
                leader: true,
              },
            },
          },
        });

        const myMembership = memberships.find((m) => m.team.gameId === gameId);

        if (!myMembership) {
          return res.json(null);
        }

        const team = myMembership.team;

        if (
          !team ||
          ["completed", "disbanded"].includes(team.status || "")
        ) {
          return res.json(null);
        }

        // 🆕 status='playing' 時補 active sessionId 進回傳，讓 client 能跳回遊戲
        //   （重連場景：玩家斷線後重新打開 → lobby 偵測有 sessionId 自動 redirect）
        //   失敗則 null（不阻塞主流程，client 仍能停在 lobby）
        let activeSessionId: string | null = null;
        if (team.status === "playing") {
          try {
            const ts = await db
              .select({ sessionId: teamSessions.sessionId })
              .from(teamSessions)
              .innerJoin(gameSessions, eq(teamSessions.sessionId, gameSessions.id))
              .where(
                and(
                  eq(teamSessions.teamId, team.id),
                  eq(gameSessions.status, "playing"),
                ),
              )
              .orderBy(desc(teamSessions.createdAt))
              .limit(1);
            if (ts.length > 0) {
              activeSessionId = ts[0].sessionId;
            }
          } catch {
            // 反查失敗 → 不阻塞，client 顯示 lobby
          }
        }

        // 🛡️ Fix（2026-05-04）：移除過激 ghost-lobby 防護
        //   原邏輯（2026-05-02）：team.status='playing' 但無 active session → 回 null
        //   問題：玩家中途退出 / 切 tab 後再進、被誤殺看到「創建/加入」表單
        //   新策略：保留 team 並加 sessionInterrupted flag、由 client UI 顯示
        //     - 隊長可選「解散重組」或「等待重連」
        //     - 隊員可選「離開隊伍」回首頁
        //   forming/ready 狀態下沒 session 是正常（還沒開打）、不影響
        const sessionInterrupted = team.status === "playing" && !activeSessionId;
        res.json({ ...team, activeSessionId, sessionInterrupted });
      } catch (error) {
        res.status(500).json({ message: "取得隊伍資料失敗" });
      }
    },
  );

  // 🆕 2026-05-04: 把 team 升級為永久 Squad（「保留隊伍下次再用」）
  // 設計依據：docs/changes/2026-05-04-team-flow-redesign.md
  // 流程：
  //   1. 驗證 user 是 team leader
  //   2. 驗證 team.squadId 為 null（避免重複升級）
  //   3. 檢查 user 已參與的 active squad 數量（< 5 個軟上限）
  //   4. 建 Squad（leaderId = user.id）
  //   5. 把 team_members 全部寫入 squad_members（leader role 對應）
  //   6. UPDATE teams SET squad_id = newSquadId
  app.post(
    "/api/teams/:teamId/promote-to-squad",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const promoteSchema = z.object({
          name: z.string().min(1, "請輸入隊名").max(50),
          tag: z.string().min(2, "TAG 至少 2 字").max(10).optional(),
          primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "色碼格式錯誤").optional(),
        });
        const parsed = promoteSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "輸入格式錯誤" });
        }
        const { name, tag, primaryColor } = parsed.data;

        // 1. 取 team + 檢查 leader
        const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
        if (!team) return res.status(404).json({ message: "隊伍不存在" });
        if (team.leaderId !== userId) {
          return res.status(403).json({ message: "只有隊長能保留隊伍" });
        }
        if (team.squadId) {
          return res.status(409).json({ message: "此隊伍已是永久隊伍" });
        }

        // 2. 軟上限：使用者最多 5 個 active squad
        const activeSquadCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(squadMembers)
          .where(and(eq(squadMembers.userId, userId), isNull(squadMembers.leftAt)));
        const count = activeSquadCount[0]?.count ?? 0;
        if (count >= 5) {
          return res.status(409).json({
            message: "你已加入 5 個隊伍（上限）。先到「我的隊伍」解散舊的、或加入別人的隊伍。",
          });
        }

        // 3. 取 team_members
        const memberships = await db
          .select()
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)));

        // 4. 建 Squad
        const finalTag = (tag ?? name.slice(0, 4)).toUpperCase();
        const finalColor = primaryColor ?? "#be723c";
        const [newSquad] = await db
          .insert(squads)
          .values({
            name,
            tag: finalTag,
            leaderId: userId,
            homeFieldId: null,
            isPublic: true,
            primaryColor: finalColor,
          })
          .returning();

        if (!newSquad) {
          return res.status(500).json({ message: "建立 Squad 失敗" });
        }

        // 5. 寫 squad_members（依 team role 對應）
        if (memberships.length > 0) {
          await db.insert(squadMembers).values(
            memberships.map((m) => ({
              squadId: newSquad.id,
              userId: m.userId,
              role: m.role === "leader" ? "leader" : "member",
              joinSource: "self",
            })),
          );
        }

        // 6. teams.squadId bridge
        await db.update(teams).set({ squadId: newSquad.id }).where(eq(teams.id, teamId));

        return res.json({
          squad: newSquad,
          squadId: newSquad.id,
          message: `隊伍「${name}」已保留、下次可直接使用`,
        });
      } catch (error) {
        console.error("[teams] promote-to-squad 失敗:", error);
        return res.status(500).json({ message: "保留隊伍失敗" });
      }
    },
  );
}
