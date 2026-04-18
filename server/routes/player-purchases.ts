// 玩家端購買路由 - 兌換碼兌換、存取權查詢、購買記錄、線上付款
import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import {
  isValidCodeFormat,
} from "../utils/redeem-code-generator";
import {
  createCheckoutSession,
  isRecurConfigured,
} from "../services/recur-client";
import { checkQuota } from "../services/billing";

// 兌換碼輸入驗證
const redeemSchema = z.object({
  code: z.string().min(1, "請輸入兌換碼"),
});

// 簡易 rate limit（記憶體存儲，重啟後清除）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 分鐘
const RATE_LIMIT_MAX = 10; // 最多 10 次

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

export function registerPlayerPurchaseRoutes(app: Express) {
  // ========================================================================
  // 兌換碼兌換
  // ========================================================================
  app.post("/api/redeem", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "需要登入" });
      }

      // Rate limit 檢查
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          message: "兌換次數過多，請 15 分鐘後再試",
        });
      }

      const parsed = redeemSchema.parse(req.body);
      const codeInput = parsed.code.toUpperCase().trim();

      // 格式檢查
      if (!isValidCodeFormat(codeInput)) {
        return res.status(400).json({ message: "兌換碼格式不正確" });
      }

      // 查詢兌換碼
      const redeemCode = await storage.getRedeemCodeByCode(codeInput);
      if (!redeemCode) {
        return res.status(404).json({ message: "兌換碼不存在" });
      }

      // 狀態檢查
      if (redeemCode.status !== "active") {
        return res.status(400).json({ message: "此兌換碼已停用" });
      }

      // 過期檢查
      if (redeemCode.expiresAt && new Date(redeemCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: "此兌換碼已過期" });
      }

      // 用完檢查
      if (
        redeemCode.maxUses &&
        (redeemCode.usedCount ?? 0) >= redeemCode.maxUses
      ) {
        return res.status(400).json({ message: "此兌換碼已兌換完畢" });
      }

      // 重複兌換檢查
      const alreadyRedeemed = await storage.hasUserRedeemedCode(
        redeemCode.id,
        userId
      );
      if (alreadyRedeemed) {
        return res.status(409).json({ message: "您已兌換過此碼" });
      }

      // 檢查是否已有存取權
      if (redeemCode.scope === "game") {
        const existing = await storage.getUserGamePurchase(
          userId,
          redeemCode.gameId
        );
        if (existing) {
          return res.status(409).json({ message: "您已擁有此遊戲存取權" });
        }
      } else if (redeemCode.chapterId) {
        const existing = await storage.getUserChapterPurchase(
          userId,
          redeemCode.chapterId
        );
        if (existing) {
          return res.status(409).json({ message: "您已擁有此章節存取權" });
        }
      }

      // 使用 DB Transaction 進行兌換
      await db.transaction(async () => {
        // 1. 記錄兌換碼使用
        await storage.createCodeUse({
          codeId: redeemCode.id,
          userId,
        });

        // 2. 更新使用次數
        await storage.incrementRedeemCodeUsage(redeemCode.id);

        // 3. 建立購買記錄
        await storage.createPurchase({
          userId,
          gameId: redeemCode.gameId,
          chapterId: redeemCode.chapterId ?? null,
          purchaseType: "redeem_code",
          amount: 0,
          currency: "TWD",
          status: "completed",
          redeemCodeId: redeemCode.id,
          completedAt: new Date(),
        });
      });

      res.json({
        message: "兌換成功",
        scope: redeemCode.scope,
        gameId: redeemCode.gameId,
        chapterId: redeemCode.chapterId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "驗證失敗", errors: error.errors });
      }
      res.status(500).json({ message: "兌換失敗，請稍後再試" });
    }
  });

  // ========================================================================
  // 遊戲存取權查詢
  // ========================================================================
  app.get("/api/games/:gameId/access", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "需要登入" });
      }

      const { gameId } = req.params;
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      // 🎫 自動加入場域會員（玩家進入遊戲時）
      if (game.fieldId) {
        const { ensureMembership } = await import("../services/field-memberships");
        ensureMembership(userId, game.fieldId).catch((err) =>
          console.error("[field-memberships] ensure 失敗:", err),
        );
      }

      // 免費遊戲：全部存取
      if (game.pricingType === "free" || !game.pricingType) {
        return res.json({
          hasAccess: true,
          pricingType: "free",
        });
      }

      // 檢查整個遊戲的購買記錄
      const gamePurchase = await storage.getUserGamePurchase(userId, gameId);
      if (gamePurchase) {
        return res.json({
          hasAccess: true,
          pricingType: game.pricingType,
          purchaseType: gamePurchase.purchaseType,
        });
      }

      // per_chapter 模式：回傳已購買的章節列表（含個別價格）
      if (game.pricingType === "per_chapter") {
        const chapters = await storage.getChapters(gameId);
        const chapterAccess = await Promise.all(
          chapters.map(async (ch) => {
            const purchased = await storage.getUserChapterPurchase(
              userId,
              ch.id
            );
            const config = ch.unlockConfig as Record<string, unknown> | null;
            const chapterPrice = config?.price as number | undefined;
            return {
              chapterId: ch.id,
              chapterOrder: ch.chapterOrder,
              title: ch.title,
              hasAccess:
                ch.unlockType === "free" ||
                ch.chapterOrder === 1 ||
                !!purchased,
              price: chapterPrice ?? null,
            };
          })
        );

        // 若所有章節都已解鎖 → hasAccess: true
        const allUnlocked = chapterAccess.every((ch) => ch.hasAccess);

        return res.json({
          hasAccess: allUnlocked,
          pricingType: "per_chapter",
          price: game.price,
          currency: game.currency,
          chapters: chapterAccess,
        });
      }

      // one_time 模式：未購買
      return res.json({
        hasAccess: false,
        pricingType: game.pricingType,
        price: game.price,
        currency: game.currency,
      });
    } catch (error) {
      res.status(500).json({ message: "無法查詢存取權" });
    }
  });

  // ========================================================================
  // 線上付款 Checkout（Recur.tw）
  // ========================================================================
  app.post("/api/games/:gameId/checkout", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "需要登入" });
      }

      // 檢查 Recur 是否已設定
      if (!isRecurConfigured()) {
        return res.status(503).json({ message: "線上付款功能尚未開放" });
      }

      const { gameId } = req.params;
      const chapterId = req.body?.chapterId as string | undefined;

      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      // 驗證遊戲定價
      if (game.pricingType === "free" || !game.pricingType) {
        return res.status(400).json({ message: "此遊戲為免費遊戲" });
      }

      // SaaS 配額檢查：場域本月結帳次數
      if (game.fieldId) {
        const quota = await checkQuota(game.fieldId, "checkouts");
        if (quota.isOver) {
          return res.status(402).json({
            message: "此場域本月結帳次數已達方案上限，請聯繫場域管理員升級方案",
            quota: { current: quota.current, limit: quota.limit },
          });
        }
      }

      let amount: number;
      let productId: string;

      if (chapterId) {
        // 章節級購買
        if (game.pricingType !== "per_chapter") {
          return res.status(400).json({ message: "此遊戲不支援章節購買" });
        }

        const chapter = await storage.getChapter(chapterId);
        if (!chapter || chapter.gameId !== gameId) {
          return res.status(404).json({ message: "章節不存在" });
        }

        const config = chapter.unlockConfig as Record<string, unknown> | null;
        const chapterPrice = config?.price as number | undefined;
        if (!chapterPrice || chapterPrice <= 0) {
          return res.status(400).json({ message: "此章節未設定價格" });
        }

        // 檢查是否已有此章節存取權
        const existingChapter = await storage.getUserChapterPurchase(userId, chapterId);
        if (existingChapter) {
          return res.status(409).json({ message: "您已擁有此章節存取權" });
        }

        amount = chapterPrice;
        productId = `${game.recurProductId || gameId}-ch-${chapter.chapterOrder}`;
      } else {
        // 遊戲級購買
        if (!game.price || game.price <= 0) {
          return res.status(400).json({ message: "遊戲定價未設定" });
        }

        // 檢查是否已有存取權
        const existing = await storage.getUserGamePurchase(userId, gameId);
        if (existing) {
          return res.status(409).json({ message: "您已擁有此遊戲存取權" });
        }

        amount = game.price;
        productId = game.recurProductId || gameId;
      }

      // 建立待處理的交易記錄
      const transaction = await storage.createTransaction({
        userId,
        gameId,
        chapterId: chapterId ?? undefined,
        amount,
        currency: game.currency ?? "TWD",
        status: "pending",
      });

      // 取得 APP_URL 作為成功/取消 URL 基底
      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3333}`;

      // 呼叫 Recur API 建立 Checkout Session
      const session = await createCheckoutSession({
        productId,
        successUrl: `${appUrl}/purchase/success?txId=${transaction.id}`,
        cancelUrl: `${appUrl}/purchase/gate/${gameId}`,
        mode: "PAYMENT",
        customerEmail: (req.user?.claims as Record<string, unknown>)?.email as string | undefined,
        metadata: {
          transactionId: transaction.id,
          gameId,
          userId,
          ...(chapterId ? { chapterId } : {}),
        },
      });

      // 更新交易記錄的 Recur Session ID
      await storage.updateTransaction(transaction.id, {
        recurCheckoutSessionId: session.id,
      });

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "建立付款失敗";
      res.status(500).json({ message });
    }
  });

  // ========================================================================
  // 交易狀態查詢（Recur 付款後輪詢用）
  // ========================================================================
  app.get("/api/transactions/:txId/status", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "需要登入" });
      }

      const { txId } = req.params;
      const tx = await storage.getTransaction(txId);
      if (!tx) {
        return res.status(404).json({ message: "交易不存在" });
      }

      // 驗證交易屬於當前用戶
      if (tx.userId !== userId) {
        return res.status(403).json({ message: "無權查看此交易" });
      }

      res.json({
        status: tx.status,
        gameId: tx.gameId,
        chapterId: tx.chapterId ?? null,
      });
    } catch (error) {
      res.status(500).json({ message: "無法查詢交易狀態" });
    }
  });

  // ========================================================================
  // 我的購買記錄
  // ========================================================================
  app.get("/api/purchases", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "需要登入" });
      }

      const purchaseList = await storage.getPurchasesByUser(userId);
      res.json(purchaseList);
    } catch (error) {
      res.status(500).json({ message: "無法取得購買記錄" });
    }
  });
}
