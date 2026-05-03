// 🤖 Admin AI 副駕駛 — 編輯遊戲時的即時 AI 助手
//
// 3 種能力：
//   suggestNextModule(currentPages) — 推薦下一個 page type
//   diagnoseFlow(pages) — 流程診斷（找漏發道具、孤兒頁、遺漏設定等）
//   polishCopy(text, style) — 文案優化（DeepSeek）
//
// 使用模型：DeepSeek V3.2（與 variant-generator / game-generator 一致）
import {
  DEFAULT_VARIANT_GEN_MODEL,
  formatModuleCatalog,
  SUPPORTED_PAGE_TYPES,
} from "@shared/schema";
import { callOpenRouter, safeParseAiJson } from "./openrouter";
import { getTransitionProbabilities } from "./markov-sampler";

// ============================================================================
// 1. suggestNextModule — 推薦下一個 page type
// ============================================================================
export interface PageSummary {
  pageOrder: number;
  pageType: string;
  customName?: string | null;
  /** 可選：簡短描述（取自 config.title / instruction） */
  hint?: string;
}

export interface SuggestionResult {
  /** 推薦的 page type（必為 SUPPORTED_PAGE_TYPES 之一） */
  pageType: string;
  /** 推薦理由 */
  reason: string;
  /** 預設 customName 建議 */
  suggestedName?: string;
}

/**
 * 根據已有 pages 推薦下一個合適的 page type
 *
 * P16-6: 若 fieldId 提供 → 注入 Markov 機率（成功玩家在最後一個 type 後最常去的 type）
 *         AI 仍可用其判斷，但有 data-driven 參考；fieldId 缺省走純 AI（向後相容）
 */
export async function suggestNextModule(
  currentPages: PageSummary[],
  apiKey: string,
  model: string = DEFAULT_VARIANT_GEN_MODEL,
  fieldId?: string,
): Promise<SuggestionResult[]> {
  const flowSummary = currentPages
    .map((p) => `${p.pageOrder}. ${p.pageType}${p.customName ? ` (${p.customName})` : ""}${p.hint ? ` — ${p.hint.substring(0, 30)}` : ""}`)
    .join("\n");

  // P16-6: 取 Markov 機率（若有 fieldId + 至少一個 page）
  let markovHint = "";
  if (fieldId && currentPages.length > 0) {
    const lastType = currentPages[currentPages.length - 1].pageType;
    try {
      const probs = await getTransitionProbabilities(fieldId, lastType);
      if (probs.length > 0) {
        const top5 = [...probs]
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 5);
        markovHint = `\n📊 歷史資料統計（成功玩家在 ${lastType} 後最常去的 type）：\n${top5
          .map(
            (p) =>
              `  - ${p.toType}: ${(p.probability * 100).toFixed(1)}%（樣本 ${p.totalCount}）`,
          )
          .join("\n")}\n（這是參考數據，可作為推薦排序的依據）\n`;
      }
    } catch (err) {
      // Markov 失敗不影響 AI 推薦
      console.warn("[admin-copilot] Markov hint 取得失敗:", err);
    }
  }

  const prompt = `你是賈村競技場遊戲設計助手。以下是 admin 已建立的遊戲流程：

${flowSummary || "（尚無頁面）"}

平台支援的模組：
${formatModuleCatalog()}
${markovHint}
任務：根據當前流程推薦「最適合接下來」的 3 個 page type。
考慮：
- 流程節奏（劇情 → 互動 → 挑戰 → 結尾）
- 已用過的模組類型（避免重複過多）
- 場域是戶外實境遊戲${markovHint ? "\n- 上述歷史資料統計（成功玩家銜接傾向）" : ""}

回 JSON：
{
  "suggestions": [
    { "pageType": "<one of supported>", "reason": "...", "suggestedName": "..." },
    ...3 個
  ]
}

只回 JSON。`;

  const content = await callOpenRouter(
    apiKey,
    model,
    [{ role: "user", content: prompt }],
    true,
  );
  const parsed = safeParseAiJson<{ suggestions: SuggestionResult[] }>(content, "suggest-next");

  // 過濾無效的 pageType（防 AI 亂建議）
  const valid = (parsed.suggestions || [])
    .filter((s): s is SuggestionResult => SUPPORTED_PAGE_TYPES.includes(s.pageType))
    .slice(0, 3);

  return valid;
}

// ============================================================================
// 2. diagnoseFlow — 流程診斷
// ============================================================================
export type DiagnoseSeverity = "info" | "warning" | "error";

export interface DiagnoseIssue {
  severity: DiagnoseSeverity;
  /** 問題描述 */
  message: string;
  /** 涉及的 pageOrder（如有） */
  pageOrder?: number;
  /** 修復建議 */
  fix?: string;
}

interface PageWithConfig {
  id: string;
  pageOrder: number;
  pageType: string;
  customName?: string | null;
  config: Record<string, unknown>;
}

/**
 * 診斷遊戲流程的常見問題
 *
 * 此函式為純規則引擎（不呼叫 AI），快速且可預測：
 *   - 道具發放鏈：conditional_verify 要求的道具 → 前面必須有 page 發放
 *   - 結尾頁判斷：最後一頁是否為適合的「結尾」類型
 *   - 缺必填：拍照類缺 instruction、答題類缺 answers 等
 *   - 流程節奏：連續多個答題 / 連續多個拍照（疲勞）
 */
export function diagnoseFlow(pages: PageWithConfig[]): DiagnoseIssue[] {
  const issues: DiagnoseIssue[] = [];

  if (pages.length === 0) {
    issues.push({
      severity: "error",
      message: "遊戲沒有任何頁面",
      fix: "請至少新增一頁開場",
    });
    return issues;
  }

  // 排序確保按 pageOrder
  const sorted = [...pages].sort((a, b) => a.pageOrder - b.pageOrder);

  // 1. 累積會被「發放」的道具
  const grantedItems = new Set<string>();
  // 2. 累積會被「要求」的道具
  for (const p of sorted) {
    const cfg = p.config || {};
    // 蒐集發放
    const rewardItems = (cfg.rewardItems as string[]) || [];
    rewardItems.forEach((id) => id && grantedItems.add(String(id)));
    const onSuccess = cfg.onSuccess as { grantItem?: string } | undefined;
    if (onSuccess?.grantItem) grantedItems.add(onSuccess.grantItem);
    const actions = (cfg.onCompleteActions as Array<{ type?: string; itemId?: string }>) || [];
    for (const a of actions) {
      if (a.type === "add_item" && a.itemId) grantedItems.add(a.itemId);
    }

    // 蒐集需求（在當前 pageOrder 檢查）
    if (p.pageType === "conditional_verify") {
      const conds = (cfg.conditions as Array<{ type?: string; itemId?: string | number }>) || [];
      for (const c of conds) {
        if (c.type === "has_item" && c.itemId) {
          const id = String(c.itemId);
          if (!grantedItems.has(id)) {
            issues.push({
              severity: "warning",
              message: `第 ${p.pageOrder} 頁要求道具「${id}」，但前面沒有任何頁面會發放此道具`,
              pageOrder: p.pageOrder,
              fix: "在前面某一頁的「完成獎勵」加入此道具",
            });
          }
        }
      }
    }
  }

  // 3. 必填欄位缺漏
  for (const p of sorted) {
    const cfg = p.config || {};
    if (p.pageType === "text_verify" || p.pageType === "choice_verify") {
      if (!cfg.question || !(cfg.question as string).trim()) {
        issues.push({
          severity: "error",
          message: `第 ${p.pageOrder} 頁（${p.pageType}）缺少問題`,
          pageOrder: p.pageOrder,
        });
      }
    }
    if (
      ["photo_spot", "photo_compare", "photo_ocr", "photo_mission"].includes(p.pageType)
    ) {
      if (!cfg.instruction || !(cfg.instruction as string).trim()) {
        issues.push({
          severity: "warning",
          message: `第 ${p.pageOrder} 頁（${p.pageType}）缺少 instruction`,
          pageOrder: p.pageOrder,
          fix: "加上拍照引導文字讓玩家知道要拍什麼",
        });
      }
    }
    if (p.pageType === "gps_mission") {
      const lat = cfg.latitude;
      const lng = cfg.longitude;
      // 用 == null 避免合法 0 值被誤判為缺值（赤道 / 子午線座標）
      // 與前後端其他座標檢查一致（locations.ts / LocationImporter.tsx / MapView.tsx）
      if (lat == null || lng == null) {
        issues.push({
          severity: "error",
          message: `第 ${p.pageOrder} 頁（gps_mission）缺少座標`,
          pageOrder: p.pageOrder,
        });
      }
    }
  }

  // 4. 流程節奏：連續 3 個以上答題 → 玩家會累
  let consecutiveQuiz = 0;
  for (const p of sorted) {
    if (["text_verify", "choice_verify"].includes(p.pageType)) {
      consecutiveQuiz++;
      if (consecutiveQuiz === 3) {
        issues.push({
          severity: "info",
          message: `第 ${p.pageOrder} 頁前後連續 3 個答題，玩家可能會累`,
          pageOrder: p.pageOrder,
          fix: "中間穿插劇情卡（text_card）或拍照任務調節",
        });
      }
    } else {
      consecutiveQuiz = 0;
    }
  }

  // 5. 結尾建議
  const last = sorted[sorted.length - 1];
  if (last && !["text_card", "dialogue", "photo_team"].includes(last.pageType)) {
    issues.push({
      severity: "info",
      message: "最後一頁建議用 text_card / dialogue / photo_team 收尾，給玩家明確結局感",
      pageOrder: last.pageOrder,
    });
  }

  return issues;
}

// ============================================================================
// 3. polishCopy — 文案優化
// ============================================================================
export type CopyStyle =
  | "tactical"   // 戰術 / 軍事
  | "literary"   // 文青 / 詩意
  | "playful"    // 俏皮 / 活潑
  | "formal"     // 正式 / 莊重
  | "cute"       // 可愛 / 兒童
  | "heroic"     // 熱血 / 英雄
  | "mystery";   // 懸疑 / 懸念

const STYLE_LABELS: Record<CopyStyle, string> = {
  tactical: "戰術 / 軍事",
  literary: "文青 / 詩意",
  playful: "俏皮 / 活潑",
  formal: "正式 / 莊重",
  cute: "可愛 / 兒童",
  heroic: "熱血 / 英雄",
  mystery: "懸疑 / 懸念",
};

export interface PolishedCopy {
  /** 候選文案（3 個變體） */
  candidates: string[];
  /** 原文 */
  original: string;
  /** 風格 */
  style: CopyStyle;
}

/**
 * 用 DeepSeek 為一段文字產出 3 個風格化變體
 */
export async function polishCopy(
  original: string,
  style: CopyStyle,
  apiKey: string,
  model: string = DEFAULT_VARIANT_GEN_MODEL,
): Promise<PolishedCopy> {
  const styleLabel = STYLE_LABELS[style];

  const prompt = `你是賈村競技場文案編輯。將下面這段文字改寫成 3 個 "${styleLabel}" 風格的版本。

原文：${original}

要求：
1. 保留原意但改變表達方式
2. 每個版本字數與原文相近（±20%）
3. 繁體中文
4. 不要太機械，要有溫度

回 JSON：
{ "candidates": ["變體1", "變體2", "變體3"] }

只回 JSON。`;

  const content = await callOpenRouter(
    apiKey,
    model,
    [{ role: "user", content: prompt }],
    true,
  );
  const parsed = safeParseAiJson<{ candidates: string[] }>(content, "polish-copy");

  const candidates = (parsed.candidates || [])
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .slice(0, 3);

  return {
    candidates,
    original,
    style,
  };
}
