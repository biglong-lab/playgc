// 玩家章節路由 - 章節列表、進度查詢、開始/完成章節
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";

export function registerPlayerChapterRoutes(app: Express) {
  // ========================================================================
  // 章節列表（含玩家解鎖狀態）
  // ========================================================================
  app.get(
    "/api/games/:gameId/chapters",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const chapters = await storage.getChapters(gameId);

        // 如果有登入玩家，附上進度資訊
        if (userId) {
          const progresses = await storage.getPlayerChapterProgress(
            userId,
            gameId
          );
          const progressMap = new Map(
            progresses.map((p) => [p.chapterId, p])
          );

          const chaptersWithProgress = chapters.map((chapter, index) => {
            const progress = progressMap.get(chapter.id);
            const isFirstChapter = index === 0;
            const isFree = chapter.unlockType === "free";

            let status = progress?.status ?? "locked";
            // 第一章或 free 類型預設解鎖
            if (!progress && (isFirstChapter || isFree)) {
              status = "unlocked";
            }

            return {
              ...chapter,
              playerStatus: status,
              bestScore: progress?.bestScore ?? 0,
              completedAt: progress?.completedAt ?? null,
              lastPlayedAt: progress?.lastPlayedAt ?? null,
            };
          });

          return res.json(chaptersWithProgress);
        }

        res.json(chapters);
      } catch (error) {
        res.status(500).json({ message: "無法取得章節列表" });
      }
    }
  );

  // ========================================================================
  // 章節詳細（含頁面，需已解鎖）
  // ========================================================================
  app.get(
    "/api/games/:gameId/chapters/:chapterId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { chapterId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "需要登入" });
        }

        const unlockResult = await storage.isChapterUnlocked(
          userId,
          chapterId
        );
        if (!unlockResult.unlocked) {
          return res.status(403).json({
            message: "章節尚未解鎖",
            reason: unlockResult.reason,
            ...unlockResult.detail,
          });
        }

        const chapterWithPages =
          await storage.getChapterWithPages(chapterId);
        if (!chapterWithPages) {
          return res.status(404).json({ message: "章節不存在" });
        }

        res.json(chapterWithPages);
      } catch (error) {
        res.status(500).json({ message: "無法取得章節詳情" });
      }
    }
  );

  // ========================================================================
  // 開始/恢復章節遊玩
  // ========================================================================
  app.post(
    "/api/games/:gameId/chapters/:chapterId/start",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId, chapterId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "需要登入" });
        }

        // 確認章節已解鎖
        const isUnlocked = await storage.isChapterUnlocked(
          userId,
          chapterId
        );
        if (!isUnlocked) {
          return res.status(403).json({ message: "章節尚未解鎖" });
        }

        // 取得或建立章節進度
        let progress = await storage.getChapterProgressByChapter(
          userId,
          chapterId
        );

        if (!progress) {
          progress = await storage.createChapterProgress({
            userId,
            gameId,
            chapterId,
            status: "in_progress",
          });
        } else if (progress.status === "unlocked") {
          progress = (await storage.updateChapterProgress(progress.id, {
            status: "in_progress",
          }))!;
        }

        // 檢查遊戲是否允許重玩
        if (progress.status === "completed") {
          const game = await storage.getGame(gameId);
          if (!game?.allowChapterReplay) {
            return res
              .status(400)
              .json({ message: "此遊戲不允許重玩已完成的章節" });
          }
          // 重玩：更新狀態為 in_progress
          progress = (await storage.updateChapterProgress(progress.id, {
            status: "in_progress",
            lastPlayedAt: new Date(),
          }))!;
        }

        res.json(progress);
      } catch (error) {
        res.status(500).json({ message: "無法開始章節" });
      }
    }
  );

  // ========================================================================
  // 遊戲進度概覽
  // ========================================================================
  app.get(
    "/api/games/:gameId/progress",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "需要登入" });
        }

        const chapters = await storage.getChapters(gameId);
        const progresses = await storage.getPlayerChapterProgress(
          userId,
          gameId
        );

        const completedChapters = progresses.filter(
          (p) => p.status === "completed"
        ).length;
        const currentProgress = progresses.find(
          (p) => p.status === "in_progress"
        );

        res.json({
          totalChapters: chapters.length,
          completedChapters,
          currentChapterId: currentProgress?.chapterId ?? null,
          progresses,
        });
      } catch (error) {
        res.status(500).json({ message: "無法取得進度" });
      }
    }
  );

  // ========================================================================
  // 完成章節
  // ========================================================================
  app.patch(
    "/api/sessions/:id/chapter-complete",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id: sessionId } = req.params;
        const userId = req.user?.claims?.sub;
        const { score } = req.body;

        if (!userId) {
          return res.status(401).json({ message: "需要登入" });
        }

        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ message: "場次不存在" });
        }

        const chapterId = session.currentChapterId;
        if (!chapterId) {
          return res
            .status(400)
            .json({ message: "此場次不屬於任何章節" });
        }

        // 更新章節進度
        const progress = await storage.getChapterProgressByChapter(
          userId,
          chapterId
        );
        if (!progress) {
          return res.status(404).json({ message: "找不到章節進度" });
        }

        const finalScore = typeof score === "number" ? score : 0;
        const bestScore = Math.max(progress.bestScore ?? 0, finalScore);

        await storage.updateChapterProgress(progress.id, {
          status: "completed",
          bestScore,
          completedAt: new Date(),
        });

        // 嘗試解鎖下一章
        const nextProgress = await storage.unlockNextChapter(
          userId,
          session.gameId!,
          chapterId
        );

        res.json({
          completed: true,
          bestScore,
          nextChapterUnlocked: !!nextProgress,
          nextChapterId: nextProgress?.chapterId ?? null,
        });
      } catch (error) {
        res.status(500).json({ message: "無法完成章節" });
      }
    }
  );
}
