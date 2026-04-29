// 🤖 AI 服務錯誤訊息共用 helper
//
// 統一所有 AI 元件的 catch 區處理（TextVerify / PhotoSpot / PhotoCompare /
// PhotoOcr / PhotoMission / AIPhotoTester 等），給玩家精準訊息：
//
//   503 + 「AI 服務未設定」 → AI 評分尚未啟用，請聯絡管理員
//   503 + 「AI 功能已停用」 → AI 評分已停用
//   429                    → AI 呼叫過於頻繁，請稍後再試
//   404                    → 預覽模式不支援 AI（gameId 無效）
//   PERMISSION_DENIED      → GCP 帳號未啟用 billing
//   QUOTA_EXCEEDED         → 用量已達上限
//   其他                    → AI 服務暫時無法使用
//
// 用法：
//   try { ... } catch (err) {
//     const { title, description } = formatAiError(err);
//     toast({ title, description, variant: "destructive" });
//   }

export interface AiErrorInfo {
  /** Toast 標題 */
  title: string;
  /** Toast 內容（行動指引）*/
  description: string;
  /** 內部分類（給 logging 用）*/
  category:
    | "not-configured"
    | "ai-disabled"
    | "rate-limited"
    | "preview-unsupported"
    | "billing-required"
    | "quota-exceeded"
    | "network"
    | "unknown";
  /** 是否該扣玩家次數（false = 不該算玩家錯，伺服器問題）*/
  shouldDeductAttempt: boolean;
}

/**
 * 把任意 error / unknown 轉成精準的 AI 錯誤訊息
 */
export function formatAiError(err: unknown): AiErrorInfo {
  const rawMsg = err instanceof Error ? err.message : String(err ?? "");
  // 🐛 截掉 HTML（502 nginx 會回整段 HTML）保留前 200 字
  const errMsg = rawMsg.includes("<html")
    ? rawMsg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200)
    : rawMsg;

  // 502 / 504 — 後端 timeout / nginx upstream
  if (errMsg.includes("502") || errMsg.includes("504")) {
    return {
      title: "AI 服務暫時忙碌",
      description: "處理超時（可能是圖片過大或服務繁忙），請稍候 30 秒再試",
      category: "network",
      shouldDeductAttempt: false,
    };
  }

  // 500 — 後端錯誤
  if (errMsg.includes("500") && !errMsg.includes("503")) {
    return {
      title: "AI 服務發生錯誤",
      description: "伺服器處理發生錯誤，請稍候再試或聯絡管理員",
      category: "unknown",
      shouldDeductAttempt: false,
    };
  }

  // OCR 超時
  if (errMsg.includes("TIMEOUT") || errMsg.includes("超時")) {
    return {
      title: "AI 處理超時",
      description: "圖片過大或服務繁忙，建議用較小張的照片重試",
      category: "network",
      shouldDeductAttempt: false,
    };
  }

  // 503 + 未設定
  if (
    errMsg.includes("503") &&
    (errMsg.includes("AI 服務未設定") || errMsg.includes("not configured"))
  ) {
    return {
      title: "AI 服務尚未啟用",
      description:
        "此場域還沒設定 Gemini API key，請聯絡管理員到「場域管理」設定後再試",
      category: "not-configured",
      shouldDeductAttempt: false,
    };
  }

  // 503 + 場域停用
  if (errMsg.includes("503") && errMsg.includes("AI 功能已停用")) {
    return {
      title: "AI 功能已停用",
      description: "此場域的 AI 功能被管理員停用，請聯絡管理員",
      category: "ai-disabled",
      shouldDeductAttempt: false,
    };
  }

  // 503 + 預覽不支援（preview-game gameId）
  if (errMsg.includes("503") && errMsg.includes("預覽模式")) {
    return {
      title: "預覽模式不支援 AI",
      description: "請先儲存遊戲後再測試 AI 功能",
      category: "preview-unsupported",
      shouldDeductAttempt: false,
    };
  }

  // 429
  if (errMsg.includes("429")) {
    return {
      title: "AI 呼叫過於頻繁",
      description: "請等 1 分鐘後再試（每分鐘上限 10 次）",
      category: "rate-limited",
      shouldDeductAttempt: false,
    };
  }

  // GCP billing
  if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("billing")) {
    return {
      title: "AI 帳號未啟用",
      description: "Google 帳號未啟用 billing，請聯絡管理員",
      category: "billing-required",
      shouldDeductAttempt: false,
    };
  }

  // 配額用盡
  if (errMsg.includes("QUOTA_EXCEEDED") || errMsg.includes("quota")) {
    return {
      title: "AI 用量已達上限",
      description: "本月免費額度用盡，請聯絡管理員",
      category: "quota-exceeded",
      shouldDeductAttempt: false,
    };
  }

  // 預設：通用「服務連線失敗」
  return {
    title: "AI 服務暫時無法使用",
    description: "請稍後再試，本次不扣除嘗試次數",
    category: errMsg.includes("Network") || errMsg.includes("fetch") ? "network" : "unknown",
    shouldDeductAttempt: false,
  };
}

/**
 * 判斷後端回傳的 result.fallback 是否該套用此處理
 * （後端某些 error 會回 200 + fallback:true 而非 throw）
 */
export function isFallbackResult(result: unknown): boolean {
  return !!(result && typeof result === "object" && "fallback" in result && (result as any).fallback);
}
