import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest, RouteContext } from "./types";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { insertGameSessionSchema } from "@shared/schema";
import { z } from "zod";
import { hotPathLimiter, chatLimiter, sessionCreateLimiter } from "../utils/rate-limiters";
import { notifyFieldGamePlay } from "../lib/internal-notifier";

/**
 * 🆕 2026-06-13 賈村遊戲開玩通報（Telegram 群組）
 * 只針對 TELEGRAM_GAME_NOTIFY_FIELD_ID 指定的場域（賈村）；fire-and-forget、不阻塞回應。
 */
async function notifyFieldGameStart(sessionId: string, userId: string): Promise<void> {
  try {
    const fieldId = process.env.TELEGRAM_GAME_NOTIFY_FIELD_ID;
    if (!fieldId) return;
    const session = await storage.getSession(sessionId);
    if (!session?.gameId) return;
    const game = await storage.getGame(session.gameId);
    if (!game || game.fieldId !== fieldId) return;
    const user = await storage.getUser(userId);
    const name = user
      ? [user.firstName, user.lastName].filter(Boolean).join("") || undefined
      : undefined;
    notifyFieldGamePlay({ gameTitle: game.title, playerName: name });
  } catch (err) {
    console.error("[player-sessions] 賈村遊戲通報失敗:", err);
  }
}

// 🔐 2026-07-09 M3（全站優化盤點）：熱路徑輸入驗證 —
//   PATCH /progress 原本 req.body 直取（score 可送負數/超大值/任意型別）
const progressPatchSchema = z.object({
  pageId: z.string().max(200).optional(),
  score: z.number().int().min(0).max(1_000_000).optional(),
  inventory: z.array(z.string().max(200)).max(500).optional(),
  variables: z.record(z.unknown()).optional(),
});

const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

// ctx 為 optional：測試環境可不傳；正式環境由 player-games → setupWebSocket 注入
export function registerPlayerSessionRoutes(app: Express, ctx?: RouteContext) {
  // ==========================================================================
  // Session & Progress API
  // ==========================================================================

  app.get(
    "/api/sessions/active",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const gameId = req.query.gameId as string;
        const userId = req.user?.claims?.sub;

        if (!gameId || !userId) {
          return res.status(400).json({ message: "gameId is required" });
        }

        const result = await storage.getActiveSessionByUserAndGame(
          userId,
          gameId,
        );

        if (!result) {
          return res.json(null);
        }

        res.json({
          session: result.session,
          progress: {
            currentPageId: result.progress.currentPageId,
            score: result.progress.score,
            inventory: result.progress.inventory,
            variables: result.progress.variables,
          },
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch active session" });
      }
    },
  );

  app.get(
    "/api/sessions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const userSessions = await storage.getSessionsByUser(userId);

        const sessionsWithProgress = userSessions.map(
          ({ session, progress }) => ({
            ...session,
            currentPageId: progress.currentPageId,
            playerScore: progress.score,
            inventory: progress.inventory,
            variables: progress.variables,
          }),
        );

        res.json(sessionsWithProgress);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sessions" });
      }
    },
  );

  app.post(
    "/api/sessions",
    isAuthenticated,
    sessionCreateLimiter, // 🔐 2026-07-09 S3：per-user 防刷（雙保險：建新自動放棄舊 playing）
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertGameSessionSchema.parse(req.body);

        // 🆕 驗證 playerName（匿名玩家自訂暱稱）
        if (data.playerName) {
          const { validatePlayerName } = await import("@shared/lib/playerDisplay");
          const result = validatePlayerName(data.playerName);
          if (!result.valid) {
            return res.status(400).json({ message: result.message });
          }
          data.playerName = result.value;
        }

        // 🌐 location_lock 後端驗證：若遊戲有設指定地點，玩家必須在範圍內才能開始
        // 防止玩家繞過前端 UI 強制開始遊戲（重要：付費 / 實境遊戲必須現場玩）
        if (data.gameId) {
          const game = await storage.getGame(data.gameId);
          if (game?.locationLockEnabled && game.lockLatitude && game.lockLongitude) {
            const playerLat = (req.body as any).playerLat as number | undefined;
            const playerLng = (req.body as any).playerLng as number | undefined;

            if (typeof playerLat !== "number" || typeof playerLng !== "number") {
              return res.status(400).json({
                message: "此遊戲需在指定地點才能開始，請允許 GPS 定位後重試",
                requireLocation: true,
                lockLocationName: game.lockLocationName,
              });
            }

            const { distanceMeters } = await import("../lib/geo");
            const lockLat = parseFloat(String(game.lockLatitude));
            const lockLng = parseFloat(String(game.lockLongitude));
            const dist = distanceMeters(playerLat, playerLng, lockLat, lockLng);
            const maxRadius = (game.lockRadius ?? 50) + 50; // 加 50m 容差

            if (dist > maxRadius) {
              return res.status(403).json({
                message: `必須在「${game.lockLocationName ?? "指定地點"}」附近 ${game.lockRadius ?? 50}m 內才能開始遊戲（目前距離 ${Math.round(dist)}m）`,
                requireLocation: true,
                lockLocationName: game.lockLocationName,
                distance: Math.round(dist),
                maxDistance: maxRadius,
              });
            }
          }
        }

        const session = await storage.createSession(data);

        const userId = req.user?.claims?.sub;
        if (userId) {
          const existingUser = await storage.getUser(userId);
          if (!existingUser) {
            await storage.upsertUser({
              id: userId,
              email: `user-${userId}@firebase.local`,
              firstName: null,
              lastName: null,
              profileImageUrl: null,
            });
          }

          await storage.createPlayerProgress({
            sessionId: session.id,
            userId: userId,
            inventory: [],
            variables: {},
          });

          // 🆕 2026-07-08 CHITO #f095652b：放棄此玩家在此遊戲的其他 solo playing session
          //   保證同玩家同遊戲只有一個 playing → 揀選/恢復不再撈到幽靈舊進度
          //   （多人 session 不受影響 — 只清無 team_sessions 對應的 solo 場次）
          if (data.gameId) {
            await storage
              .abandonOtherPlayingSessionsForUser(userId, data.gameId, session.id)
              .catch((err) =>
                console.error("[player-sessions] 放棄舊 playing session 失敗:", err),
              );
          }

          // 🎫 自動加入場域會員（首次遊玩此場域）
          if (data.gameId) {
            const game = await storage.getGame(data.gameId);
            if (game?.fieldId) {
              const { ensureMembership } = await import("../services/field-memberships");
              ensureMembership(userId, game.fieldId).catch((err) =>
                console.error("[field-memberships] ensure 失敗:", err),
              );
            }
          }
        }

        res.status(201).json(session);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create session" });
      }
    },
  );

  app.get(
    "/api/sessions/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const session = await storage.getSession(req.params.id);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }
        res.json(session);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch session" });
      }
    },
  );

  app.patch(
    "/api/sessions/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const data = insertGameSessionSchema.partial().parse(req.body);

        // 🆕 驗證 playerName（若有更新）
        if (data.playerName) {
          const { validatePlayerName } = await import("@shared/lib/playerDisplay");
          const result = validatePlayerName(data.playerName);
          if (!result.valid) {
            return res.status(400).json({ message: result.message });
          }
          data.playerName = result.value;
        }

        // 🛡️ 若 client 帶 status=completed + score，先做 server-side 分數驗證
        //   防 Shooting 作弊 / devtools 改 state
        let scoreValidationResult: { adjusted: boolean; safeScore: number } | null = null;
        if (data.status === "completed" && typeof data.score === "number") {
          const { validateSessionScore } = await import("../lib/scoreValidation");
          const userIdForValidation = (req as AuthenticatedRequest).user?.claims?.sub || null;
          scoreValidationResult = await validateSessionScore({
            sessionId: req.params.id,
            userId: userIdForValidation,
            clientScore: data.score,
            source: "session-complete",
          });
          // 用驗證過的安全分數覆蓋
          data.score = scoreValidationResult.safeScore;
        }

        const session = await storage.updateSession(req.params.id, data);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (data.status === "completed" && session.score) {
          // 🆕 排行榜 snapshot：載入 user 資料 + 判斷匿名狀態
          const { getPlayerDisplayName, isAnonymousPlayer } = await import(
            "@shared/lib/playerDisplay"
          );
          const userId = (req as AuthenticatedRequest).user?.claims?.sub;
          const user = userId ? await storage.getUser(userId) : null;
          const displaySource = {
            playerName: session.playerName,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
          };
          const displayName = getPlayerDisplayName(displaySource);
          const isAnon = isAnonymousPlayer(displaySource);

          await storage.createLeaderboardEntry({
            gameId: session.gameId,
            sessionId: session.id,
            teamName: session.teamName,
            playerName: displayName,
            isAnonymous: isAnon ? 1 : 0,
            totalScore: session.score,
            completionTimeSeconds:
              session.completedAt && session.startedAt
                ? Math.floor(
                    (new Date(session.completedAt).getTime() -
                      new Date(session.startedAt).getTime()) /
                      1000,
                  )
                : undefined,
          });

          // 🏆 成就自動解鎖（本次完成遊戲時檢查所有 condition）
          try {
            const { checkAndUnlockAchievements } = await import(
              "../services/achievement-unlock"
            );
            const userId = (req as AuthenticatedRequest).user?.claims?.sub;
            if (userId) {
              // 撈 player_progress 拿 inventory
              const progressList = await storage.getPlayerProgress(session.id);
              const userProgress = progressList.find((p) => p.userId === userId);
              if (session.gameId) {
                await checkAndUnlockAchievements({
                  userId,
                  gameId: session.gameId,
                  sessionId: session.id,
                  score: session.score ?? 0,
                  inventory: (userProgress?.inventory as string[]) || [],
                  gameCompleted: true,
                });
              }
            }
          } catch (err) {
            console.error("[achievement] 解鎖檢查失敗:", err);
          }

          // 🆕 Phase 4.3：寫入 squad_match_records（如果 session 有隊伍）
          // 這個 hook 是 fire-and-forget，不影響原本回應
          try {
            const { writeSquadRecordFromSession } = await import(
              "../services/squad-record-writer"
            );
            await writeSquadRecordFromSession(session);
          } catch (err) {
            console.error("[squad-record] 寫入失敗（不影響 session）:", err);
          }
        }

        // 🆕 若分數被伺服器修正，告知 client
        res.json({
          ...session,
          scoreAdjusted: scoreValidationResult?.adjusted || false,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update session" });
      }
    },
  );

  app.patch(
    "/api/sessions/:id/progress",
    isAuthenticated,
    hotPathLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const sessionId = req.params.id;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // 多人併發優化：
        // 原本：getSession + getPlayerProgress(整個 session 全部玩家) + update/create = 3 次 DB query
        // 優化：getPlayerProgressByUser（用 session_id+user_id 複合 index）+ update/create = 2 次
        let progress = await storage.getPlayerProgressByUser(sessionId, userId);

        // 沒進度紀錄 → 確認 session 存在才建立，否則 404（兌現 contract）
        if (!progress) {
          const session = await storage.getSession(sessionId);
          if (!session) {
            return res.status(404).json({ message: "Session not found" });
          }
        }

        // 🛡️ 防作弊：驗證 inventory 中的 itemId 都屬於該 game
        // 避免玩家透過離線改 request 注入其他遊戲的 itemId
        // 也避免 admin 刪掉 item 後舊 session 還用孤兒 ID
        if (Array.isArray(req.body.inventory) && req.body.inventory.length > 0) {
          const session = await storage.getSession(sessionId);
          if (session?.gameId) {
            const allItems = await storage.getItems(session.gameId);
            const validIds = new Set(allItems.map((i) => i.id));
            const filteredInventory = req.body.inventory.filter((id: unknown) =>
              typeof id === "string" && validIds.has(id),
            );
            const droppedCount = req.body.inventory.length - filteredInventory.length;
            if (droppedCount > 0) {
              console.warn(
                `[player-sessions] 玩家 ${userId} session ${sessionId} 過濾掉 ${droppedCount} 個無效 itemId`,
              );
            }
            req.body.inventory = filteredInventory;
          }
        }

        if (!progress) {
          progress = await storage.createPlayerProgress({
            sessionId: sessionId,
            userId: userId,
            inventory: req.body.inventory || [],
            variables: req.body.variables || {},
            score: req.body.score || 0,
            currentPageId: req.body.pageId || null,
          });
          // 🆕 2026-06-13 賈村遊戲開玩 → Telegram 群組（首次建立進度才觸發、fire-and-forget）
          void notifyFieldGameStart(sessionId, userId);
          res.json(progress);
          return;
        }

        const updateData: Record<string, unknown> = {};
        if (req.body.pageId) updateData.currentPageId = req.body.pageId;
        if (req.body.score !== undefined) updateData.score = req.body.score;
        if (req.body.inventory) updateData.inventory = req.body.inventory;
        if (req.body.variables) updateData.variables = req.body.variables;

        const updated = await storage.updatePlayerProgress(
          progress.id,
          updateData,
        );

        // 🏆 即時成就檢查 — 當 inventory 或 score 更新時檢查是否有新成就解鎖
        // 避免 breaking client：只在 body 實際變更這些欄位時跑（跟章節完成的 end-of-game 檢查互不衝突，靠 unique constraint 去重）
        let unlockedAchievements: Array<{ id: number; name: string; iconUrl?: string | null; rarity?: string | null }> = [];
        if (req.body.inventory !== undefined || req.body.score !== undefined) {
          try {
            const session = await storage.getSession(sessionId);
            if (session?.gameId) {
              const { checkAndUnlockAchievements } = await import(
                "../services/achievement-unlock"
              );
              const newly = await checkAndUnlockAchievements({
                userId,
                gameId: session.gameId,
                sessionId,
                score: typeof req.body.score === "number" ? req.body.score : (updated?.score ?? 0),
                inventory: (req.body.inventory || (updated?.inventory as string[]) || []).map(String),
              });
              unlockedAchievements = newly.map((a) => ({
                id: a.id,
                name: a.name,
                iconUrl: a.iconUrl,
                rarity: a.rarity,
              }));
            }
          } catch (err) {
            // 成就檢查失敗不應該讓 progress update 也失敗
            console.error("[progress] achievement check failed:", err);
          }
        }

        res.json({ ...updated, unlockedAchievements });
      } catch (error) {
        res.status(500).json({ message: "Failed to update progress" });
      }
    },
  );

  // ==========================================================================
  // Chat API
  // ==========================================================================

  app.get(
    "/api/chat/:sessionId",
    isAuthenticated,
    async (req, res) => {
      try {
        const messages = await storage.getChatMessages(req.params.sessionId);
        res.json(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch chat messages" });
      }
    },
  );

  app.post(
    "/api/chat/:sessionId",
    isAuthenticated,
    chatLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const message = await storage.createChatMessage({
          sessionId: req.params.sessionId,
          userId: userId,
          message: req.body.message,
        });
        // 寫 DB 後廣播給 session 內 WS clients、消除 client 雙路徑送訊（之前同時走 WS + REST 會雙寫 DB）
        ctx?.broadcastToSession?.(req.params.sessionId, {
          type: "chat",
          sessionId: req.params.sessionId,
          userId,
          message: req.body.message,
          timestamp: new Date().toISOString(),
        });
        res.status(201).json(message);
      } catch (error) {
        res.status(500).json({ message: "Failed to create chat message" });
      }
    },
  );

  // ==========================================================================
  // Object Storage / Photos API
  // ==========================================================================

  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get(
    "/objects/:objectPath(*)",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user?.claims?.sub;
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(
          req.path,
        );
        const canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: userId,
          requestedPermission: ObjectPermission.READ,
        });
        if (!canAccess) {
          return res.sendStatus(401);
        }
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.sendStatus(404);
        }
        return res.sendStatus(500);
      }
    },
  );

  app.post(
    "/api/objects/upload",
    isAuthenticated,
    async (req, res) => {
      try {
        const objectStorageService = new ObjectStorageService();
        const uploadURL =
          await objectStorageService.getObjectEntityUploadURL();
        res.json({ uploadURL });
      } catch (error) {
        res.status(500).json({ error: "Failed to get upload URL" });
      }
    },
  );

  app.put(
    "/api/photos",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      if (!req.body.photoURL) {
        return res.status(400).json({ error: "photoURL is required" });
      }

      const userId = req.user?.claims?.sub;

      try {
        const objectStorageService = new ObjectStorageService();
        const objectPath =
          await objectStorageService.trySetObjectEntityAclPolicy(
            req.body.photoURL,
            {
              owner: userId || "anonymous",
              visibility: "private",
            },
          );

        res.status(200).json({
          objectPath: objectPath,
          message: "Photo saved successfully",
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/api/photos/upload",
    isAuthenticated,
    async (req, res) => {
      try {
        const objectStorageService = new ObjectStorageService();
        const uploadURL =
          await objectStorageService.getObjectEntityUploadURL();
        const objectPath =
          objectStorageService.normalizeObjectEntityPath(
            uploadURL.split("?")[0],
          );
        res.status(201).json({
          message: "Upload URL generated",
          uploadURL,
          objectPath,
          id: `photo-${Date.now()}`,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to generate upload URL" });
      }
    },
  );
}
