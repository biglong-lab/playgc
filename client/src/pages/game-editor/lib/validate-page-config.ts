// 頁面設定存檔前驗證 — 對齊 shared/schema/games.ts 各 Config 介面
// 在管理員存檔前做基本 shape 檢查，防止髒資料寫入 DB
import type { Page } from "@shared/schema";

export interface ValidationIssue {
  pageId: string;
  pageOrder: number;
  pageType: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * 驗證單一頁面 config。
 * 回傳 issues 陣列（空表示通過）。
 */
export function validatePageConfig(page: Page): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cfg = (page.config ?? {}) as Record<string, unknown>;
  const base = {
    pageId: page.id,
    pageOrder: page.pageOrder,
    pageType: page.pageType,
  };

  const push = (field: string, message: string, severity: "error" | "warning" = "error") => {
    issues.push({ ...base, field, message, severity });
  };

  switch (page.pageType) {
    case "text_card": {
      if (!cfg.title || typeof cfg.title !== "string" || !cfg.title.trim()) {
        push("title", "缺少標題");
      }
      if (!cfg.content || typeof cfg.content !== "string" || !cfg.content.trim()) {
        push("content", "缺少內容文字");
      }
      break;
    }

    case "dialogue": {
      const character = cfg.character as { name?: string } | undefined;
      if (!character?.name || !character.name.trim()) {
        push("character.name", "缺少角色名稱");
      }
      const messages = (cfg.messages as Array<{ text?: string }>) || [];
      if (messages.length === 0) {
        push("messages", "至少需要 1 則訊息");
      } else {
        messages.forEach((m, i) => {
          if (!m.text || !m.text.trim()) {
            push(`messages[${i}].text`, `第 ${i + 1} 則訊息缺少文字`);
          }
        });
      }
      break;
    }

    case "video": {
      if (!cfg.videoUrl || typeof cfg.videoUrl !== "string" || !cfg.videoUrl.trim()) {
        push("videoUrl", "缺少影片 URL", "warning");
      }
      break;
    }

    case "button": {
      const buttons = (cfg.buttons as Array<{ text?: string }>) || [];
      if (buttons.length === 0) {
        push("buttons", "至少需要 1 個按鈕");
      } else {
        buttons.forEach((b, i) => {
          if (!b.text || !b.text.trim()) {
            push(`buttons[${i}].text`, `第 ${i + 1} 顆按鈕缺少文字`);
          }
        });
      }
      break;
    }

    case "text_verify": {
      if (!cfg.question || typeof cfg.question !== "string" || !cfg.question.trim()) {
        push("question", "缺少問題");
      }
      const answers = (cfg.answers as string[]) || [];
      const hasCorrect = !!cfg.correctAnswer || answers.some((a) => a && a.trim());
      if (!hasCorrect && !cfg.aiScoring) {
        push("answers", "至少需要一個正確答案（或啟用 AI 評分）");
      }
      break;
    }

    case "choice_verify": {
      const options = (cfg.options as Array<{ text?: string; correct?: boolean }>) || [];
      const questions = cfg.questions as Array<unknown> | undefined;
      if (!questions && options.length === 0) {
        push("options", "至少需要 1 個選項");
      }
      if (!questions && options.length > 0 && !options.some((o) => o.correct)) {
        push("options", "需要至少 1 個正確選項");
      }
      break;
    }

    case "conditional_verify": {
      const fragments = (cfg.fragments as Array<{ sourceItemId?: string; value?: string }>) || [];
      const conditions = (cfg.conditions as Array<unknown>) || [];
      if (fragments.length === 0 && conditions.length === 0) {
        push("fragments", "需要設定碎片或條件其中一個（否則玩家永遠無法通過）");
      }
      fragments.forEach((f, i) => {
        if (!f.sourceItemId) {
          push(`fragments[${i}].sourceItemId`, `碎片 ${i + 1} 未綁定道具，玩家將永遠無法收集`);
        }
      });
      break;
    }

    case "gps_mission": {
      const loc = cfg.targetLocation as { lat?: unknown; lng?: unknown } | undefined;
      if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
        push("targetLocation", "目標座標未設定或格式錯誤");
      }
      if (cfg.qrFallback === true && (!cfg.fallbackQrCode || !(cfg.fallbackQrCode as string).trim())) {
        push("fallbackQrCode", "已啟用 QR Fallback 但未設定備用代碼");
      }
      break;
    }

    case "qr_scan": {
      const code = (cfg.primaryCode as string) || (cfg.qrCodeId as string) || (cfg.expectedCode as string);
      if (!code || !code.trim()) {
        push("primaryCode", "缺少驗證代碼");
      }
      break;
    }

    case "shooting_mission": {
      const requiredHits = cfg.requiredHits as number | undefined;
      const timeLimit = cfg.timeLimit as number | undefined;
      if (typeof requiredHits !== "number" || requiredHits <= 0) {
        push("requiredHits", "需設定正數的命中次數");
      }
      if (typeof timeLimit !== "number" || timeLimit <= 0) {
        push("timeLimit", "需設定正數的時間限制（秒）");
      }
      break;
    }

    case "time_bomb": {
      const tasks = (cfg.tasks as Array<{ type?: string }>) || [];
      if (tasks.length === 0) {
        push("tasks", "至少需要 1 個任務");
      }
      break;
    }

    case "lock": {
      const combination = (cfg.combination as string) || "";
      const digits = cfg.digits as number | undefined;
      if (!combination.trim()) {
        push("combination", "缺少密碼組合");
      } else if (typeof digits === "number" && combination.length !== digits) {
        push("combination", `密碼長度 ${combination.length} 與 digits 設定 ${digits} 不符`);
      }
      break;
    }

    case "motion_challenge": {
      const targetValue = cfg.targetValue as number | undefined;
      if (typeof targetValue !== "number" || targetValue <= 0) {
        push("targetValue", "需設定正數的目標值");
      }
      break;
    }

    case "vote": {
      if (!cfg.question || typeof cfg.question !== "string" || !cfg.question.trim()) {
        push("question", "缺少投票問題");
      }
      const options = (cfg.options as Array<{ text?: string }>) || [];
      if (options.length < 2) {
        push("options", "至少需要 2 個投票選項");
      }
      break;
    }

    case "flow_router": {
      const routes = (cfg.routes as Array<unknown>) || [];
      if (routes.length === 0 && !cfg.defaultNextPageId) {
        push("routes", "至少需要 1 個路由規則或設定 defaultNextPageId");
      }
      break;
    }
  }

  return issues;
}

/**
 * 批次驗證遊戲的所有頁面
 */
export function validateAllPages(pages: Page[]): ValidationIssue[] {
  return pages.flatMap((p) => validatePageConfig(p));
}

/** 將 issue 陣列轉為一行可讀訊息 */
export function formatIssue(issue: ValidationIssue): string {
  return `第 ${issue.pageOrder} 頁（${issue.pageType}）: ${issue.message}`;
}
