// 🧠 智慧文字比對 — 簡單題不呼叫 AI（省錢省時間）
//
// 三層處理：
//   Layer 1 (exact)：normalize 後完全符合 → 100 分秒過
//   Layer 2 (fuzzy)：Levenshtein 距離 ≤ 2 → 90 分（容忍小錯字 / 標點 / 全形半形）
//   Layer 3 (ai_needed)：以上都不中 → 才呼叫 AI 做語意評分
//
// 預期：70% 文字題在 Layer 1-2 解決，AI 呼叫降 70%

/**
 * 標準化字串：去標點、去空白、全形→半形、小寫
 */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // 全形 → 半形
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    // 全形空白 → 半形
    .replace(/　/g, " ")
    // 去常見中文標點
    .replace(/[、，。！？；：「」『』（）【】《》…—\s]/g, "")
    // 去英文標點
    .replace(/[,.!?;:"'()[\]{}]/g, "");
}

/**
 * Levenshtein 編輯距離（雙陣列 DP，O(n*m) 時空複雜度）
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost, // replace
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export type MatchLayer = "exact" | "fuzzy" | "ai_needed";

export interface MatchResult {
  match: boolean;
  layer: MatchLayer;
  score?: number;
  feedback?: string;
  /** 命中的參考答案（fuzzy/exact 時） */
  matchedAnswer?: string;
  /** 編輯距離（fuzzy 時） */
  distance?: number;
}

export interface MatchOptions {
  /** 編輯距離容忍度（預設 2） */
  fuzzyTolerance?: number;
  /** 是否啟用 fuzzy 比對（預設 true，false 則只跑 exact） */
  enableFuzzy?: boolean;
}

/**
 * 比對玩家答案與參考答案
 *
 * @returns
 *   - exact 命中：{ match: true, layer: "exact", score: 100 }
 *   - fuzzy 命中：{ match: true, layer: "fuzzy", score: 90 }
 *   - 都不中：{ match: false, layer: "ai_needed" } → 呼叫端應走 AI
 */
export function matchAnswer(
  userAnswer: string,
  expectedAnswers: string[],
  options: MatchOptions = {},
): MatchResult {
  const { fuzzyTolerance = 2, enableFuzzy = true } = options;
  const u = normalize(userAnswer);

  // Layer 1: exact（normalize 後完全符合）
  for (const exp of expectedAnswers) {
    if (u === normalize(exp)) {
      return {
        match: true,
        layer: "exact",
        score: 100,
        matchedAnswer: exp,
      };
    }
  }

  // Layer 2: fuzzy（Levenshtein 距離容忍）
  if (enableFuzzy && u.length > 0) {
    let bestDist = Infinity;
    let bestAnswer: string | undefined;
    for (const exp of expectedAnswers) {
      const dist = levenshtein(u, normalize(exp));
      if (dist < bestDist) {
        bestDist = dist;
        bestAnswer = exp;
      }
    }
    if (bestDist <= fuzzyTolerance) {
      return {
        match: true,
        layer: "fuzzy",
        score: 90,
        matchedAnswer: bestAnswer,
        distance: bestDist,
      };
    }
  }

  // Layer 3: 需要 AI 判斷
  return { match: false, layer: "ai_needed" };
}
