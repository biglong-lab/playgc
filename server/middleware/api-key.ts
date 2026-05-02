// 🔑 API Key Middleware — Public API 認證（W11 D1）
//
// 用途：對外 API（/api/v1/*）的 server-to-server 認證
// 認證方式：Authorization: Bearer ck_xxx
//
// W11 D1：用環境變數 API_KEYS（逗號分隔）
// W12+：改用 DB 表（api_keys）

import type { Request, Response, NextFunction } from "express";
import { findApiKey } from "../lib/api-key-store";

export interface ApiKeyContext {
  /** API key（masked、用於 log）*/
  keyId: string;
  /** 是否為測試 key */
  isTest: boolean;
  /** 對應場域（從 metadata 取） */
  fieldId: string | null;
  /** 月配額 */
  quota: number | null;
  /** 標籤（如代理商名稱） */
  label: string;
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

/**
 * Bearer API key middleware
 *
 * 失敗回應統一格式：
 *   { error: { code, message, documentation_url? } }
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/);

  if (!match) {
    return res.status(401).json({
      error: {
        code: "missing_api_key",
        message: "請提供 Authorization: Bearer ck_xxx header",
        documentation_url: "https://game.homi.cc/api/docs#authentication",
      },
    });
  }

  const key = match[1];
  const meta = findApiKey(key);

  if (!meta) {
    return res.status(401).json({
      error: {
        code: "invalid_api_key",
        message: "API key 無效或已撤銷",
      },
    });
  }

  // 標記給後續 middleware / handler（含 metadata）
  req.apiKey = {
    keyId: maskKey(key),
    isTest: meta.isTest,
    fieldId: meta.fieldId,
    quota: meta.quota,
    label: meta.label,
  };

  next();
}

/** 把 key 遮罩為「ck_test_***...123」格式（log 用）*/
function maskKey(key: string): string {
  if (key.length < 12) return "***";
  return `${key.slice(0, 8)}***${key.slice(-3)}`;
}
