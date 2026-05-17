// 🔐 LINE Login — OAuth 2.0 流程（2026-05-17）
//
// 端點：
//   GET  /api/auth/line               redirect 到 LINE OAuth authorize（含 state CSRF）
//   GET  /api/auth/line/callback      接 code → 換 access_token → 拿 profile → Firebase custom token
//
// env：
//   LINE_LOGIN_CHANNEL_ID         LINE Login channel（不是 Messaging API channel！）
//   LINE_LOGIN_CHANNEL_SECRET
//   LINE_LOGIN_CALLBACK_URL       e.g. https://game.homi.cc/api/auth/line/callback
//   APP_BASE_URL                  e.g. https://game.homi.cc（callback 後 redirect 前端）
//
// 設計：
//   - state 用 signed cookie 防 CSRF（10 分鐘過期）
//   - returnTo 從 query 帶入、callback 後 redirect 回該 URL（含 #customToken=xxx）
//   - 前端拿到 customToken 用 firebase signInWithCustomToken 完成登入

import type { Express, Request, Response } from "express";
import crypto from "crypto";

const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";

const STATE_COOKIE = "line_login_state";
const STATE_TTL_MS = 10 * 60 * 1000;

// 🆕 2026-05-18：改成 async getConfig（從 DB / env 動態取、業主後台可填）
import { getLineLoginConfig } from "../lib/line-login-config";

async function getConfig() {
  const c = await getLineLoginConfig();
  return {
    channelId: c.channelId,
    channelSecret: c.channelSecret,
    callbackUrl: c.callbackUrl,
    appBaseUrl: process.env.APP_BASE_URL || "https://game.homi.cc",
    source: c.source,
  };
}

async function isConfigured(): Promise<boolean> {
  const c = await getConfig();
  return !!(c.channelId && c.channelSecret && c.callbackUrl);
}

export function registerLineLoginRoutes(app: Express) {
  /**
   * GET /api/auth/line
   * Redirect 到 LINE Login authorize endpoint
   * Query：returnTo（可選、callback 後 redirect 的前端 URL）
   */
  app.get("/api/auth/line", async (req: Request, res: Response) => {
    const env = await getConfig();
    if (!env.channelId || !env.channelSecret || !env.callbackUrl) {
      return res.status(503).json({
        error: "line_login_not_configured",
        message: "LINE Login 尚未設定（請至 後台 → 平台設定 → LINE Login 填寫 channel）",
      });
    }

    // 產 state + nonce（CSRF 防護）
    const state = crypto.randomBytes(16).toString("hex");
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";

    // 存 state 進 cookie（10 分鐘、HttpOnly、SameSite=Lax 給 OAuth redirect 用）
    res.cookie(STATE_COOKIE, JSON.stringify({ state, returnTo, exp: Date.now() + STATE_TTL_MS }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_TTL_MS,
      path: "/",
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.channelId!,
      redirect_uri: env.callbackUrl!,
      state,
      scope: "profile openid",
    });

    res.redirect(`${LINE_AUTHORIZE_URL}?${params.toString()}`);
  });

  /**
   * GET /api/auth/line/callback
   * 接 LINE code → 換 access_token → 拿 profile → Firebase custom token → redirect 前端
   */
  app.get("/api/auth/line/callback", async (req: Request, res: Response) => {
    const env = await getConfig();
    if (!env.channelId || !env.channelSecret || !env.callbackUrl) {
      return res.status(503).send("LINE Login 尚未設定");
    }

    try {
      const { code, state, error: lineError } = req.query;

      if (lineError) {
        return res.redirect(`${env.appBaseUrl}/?line_error=${encodeURIComponent(String(lineError))}`);
      }

      if (typeof code !== "string" || typeof state !== "string") {
        return res.status(400).send("Invalid callback");
      }

      // 驗 state
      const stateCookie = req.cookies?.[STATE_COOKIE];
      if (!stateCookie) {
        return res.status(400).send("State cookie 缺、可能逾時或被攔截");
      }
      let parsed: { state: string; returnTo: string; exp: number };
      try {
        parsed = JSON.parse(stateCookie);
      } catch {
        return res.status(400).send("State cookie 格式錯");
      }
      if (parsed.exp < Date.now()) {
        return res.status(400).send("State 已過期、請重新登入");
      }
      if (parsed.state !== state) {
        return res.status(400).send("State 不符（可能 CSRF 攻擊）");
      }
      // 清掉用過的 state
      res.clearCookie(STATE_COOKIE, { path: "/" });

      // 換 access_token
      const tokenRes = await fetch(LINE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: env.callbackUrl!,
          client_id: env.channelId!,
          client_secret: env.channelSecret!,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[line-login] token exchange 失敗:", errText);
        return res.status(502).send("換 token 失敗");
      }
      const tokenData = (await tokenRes.json()) as { access_token: string; id_token?: string };

      // 拿 profile
      const profileRes = await fetch(LINE_PROFILE_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) {
        return res.status(502).send("取得 LINE profile 失敗");
      }
      const profile = (await profileRes.json()) as {
        userId: string;
        displayName: string;
        pictureUrl?: string;
        statusMessage?: string;
      };

      // upsert Firebase user（uid 用 line:<userId> 格式）
      const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
      const { getApps: getAdminApps } = await import("firebase-admin/app");
      const adminApp = getAdminApps()[0];
      if (!adminApp) {
        return res.status(500).send("Firebase Admin 未初始化");
      }
      const adminAuth = getAdminAuth(adminApp);

      const firebaseUid = `line:${profile.userId}`;
      try {
        await adminAuth.getUser(firebaseUid);
        // 已存在 → 更新 displayName / photoURL
        await adminAuth.updateUser(firebaseUid, {
          displayName: profile.displayName,
          photoURL: profile.pictureUrl,
        });
      } catch {
        // 不存在 → 建立
        await adminAuth.createUser({
          uid: firebaseUid,
          displayName: profile.displayName,
          photoURL: profile.pictureUrl,
        });
      }

      // 生 custom token
      const customToken = await adminAuth.createCustomToken(firebaseUid, {
        provider: "line",
        lineUserId: profile.userId,
      });

      // Redirect 回前端、帶 token 在 hash（hash 不會送到 server log）
      const returnTo = parsed.returnTo || "/";
      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
      res.redirect(`${env.appBaseUrl}${safeReturnTo}#lineToken=${encodeURIComponent(customToken)}`);
    } catch (err) {
      console.error("[line-login callback]", err);
      res.status(500).send("登入失敗");
    }
  });

  /**
   * GET /api/auth/line/status
   * 給前端確認 LINE Login 是否可用（決定是否顯示「用 LINE 登入」按鈕）
   */
  app.get("/api/auth/line/status", async (_req, res) => {
    res.json({ configured: await isConfigured() });
  });
}
