// 🧩 模組開關中介層（P2 底座，2026-09-23）
//
// 「積木可拆卸」：模組關掉 → 選單藏（前端）、API 擋（這裡）、cron 跳過（排程端）。
// 掛法：在路由註冊後、以路徑前綴掛一次即可，不必動每一條路由
//   app.use(moduleGuard);   // 依 module-registry 的 apiPrefixes 自動對應
//
// 場域怎麼判斷（判斷不出來就放行，寧可不擋也不要誤鎖）：
//   1. 後台請求：req.admin.fieldId
//   2. 玩家請求：?fieldId= 或 body.fieldId（目前只有少數端點有帶）
// 平台管理員（super_admin / platform_admin）不受場域模組開關限制。
import type { NextFunction, Request, Response } from "express";
import { isModuleOn, moduleForApiPath } from "@shared/lib/module-registry";
import { loadFieldModules, moduleOffMessage } from "../lib/field-modules";
import { fieldHasFeature } from "../lib/field-plan";
import { featureForModule, featureUpgradeMessage } from "@shared/lib/plan-features";

function resolveFieldId(req: Request): string | null {
  const admin = (req as Request & { admin?: { fieldId?: string | null; systemRole?: string | null } }).admin;
  if (admin?.systemRole === "super_admin" || admin?.systemRole === "platform_admin") return null;
  if (admin?.fieldId) return admin.fieldId;
  const q = req.query?.fieldId;
  if (typeof q === "string" && q) return q;
  const b = (req.body as { fieldId?: unknown } | undefined)?.fieldId;
  return typeof b === "string" && b ? b : null;
}

/** 掛在 app.use("/api", ...) 底下時 req.path 少了掛載前綴 → 用 originalUrl 取完整路徑 */
function fullPath(req: Request): string {
  return (req.originalUrl || req.url).split("?")[0];
}

/** 依 module-registry 自動判斷這條 API 屬於哪個模組、該場域有沒有開 */
export async function moduleGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const def = moduleForApiPath(fullPath(req));
  if (!def || def.required) return next();
  const fieldId = resolveFieldId(req);
  if (!fieldId) return next();
  try {
    const modules = await loadFieldModules(fieldId);
    if (!isModuleOn(modules, def.key)) {
      res.status(403).json({ error: "module_disabled", module: def.key, message: moduleOffMessage(def) });
      return;
    }
    // 💳 模組開著，但方案沒包含這個功能 → 一樣擋（例：免費版沒有水彈）
    const feature = featureForModule(def.key);
    if (feature && !(await fieldHasFeature(fieldId, feature.key))) {
      res.status(403).json({ error: "plan_upgrade_required", feature: feature.key, message: featureUpgradeMessage(feature.key) });
      return;
    }
    next();
  } catch (err) {
    console.error("[module-guard] 判斷模組開關失敗（放行）:", err);
    next();
  }
}

/** 方案功能守門（沒有對應模組的功能用這個，例：外部 API） */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fieldId = resolveFieldId(req) ?? (req as Request & { apiKey?: { fieldId?: string } }).apiKey?.fieldId ?? null;
    if (!fieldId) return next();
    try {
      if (await fieldHasFeature(fieldId, featureKey)) return next();
      res.status(403).json({ error: "plan_upgrade_required", feature: featureKey, message: featureUpgradeMessage(featureKey) });
    } catch (err) {
      console.error("[require-feature] 判斷方案功能失敗（放行）:", err);
      next();
    }
  };
}

/** 單一模組版本（要明確擋某段路由時用） */
export function requireModule(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fieldId = resolveFieldId(req);
    if (!fieldId) return next();
    try {
      const modules = await loadFieldModules(fieldId);
      if (isModuleOn(modules, moduleKey)) return next();
      const def = moduleForApiPath(fullPath(req));
      res.status(403).json({
        error: "module_disabled",
        module: moduleKey,
        message: def ? moduleOffMessage(def) : "這個功能目前未啟用",
      });
    } catch (err) {
      console.error("[require-module] 判斷模組開關失敗（放行）:", err);
      next();
    }
  };
}
