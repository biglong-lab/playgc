// 📍 lastVisitedField — 玩家主動造訪過的場域記憶
//
// 為何不用既有的 lastFieldCode？
//   lastFieldCode 是 FieldThemeProvider cache（任何進入場域路徑都會寫），
//   包括「PWA cache 殘留」「URL 解析」「admin 場域」等被動寫入。
//
// lastVisitedField 只在玩家「主動行為」寫入：
//   - 從 /f 場域選擇頁點選某場域
//   - 從場域 Landing 進到 /f/{code}/home（玩家主動進首頁）
//
// 用途：PWA 從桌面 launch 時靠這個決定「玩家想去哪」，
//   不會被 cache 殘留誤導跑到錯場域。
//
// 設計依據：docs/PWA_USER_FLOW_OPTIMIZATION_V2.md Phase B

const KEY = "chito:lastVisitedField";

/** 讀玩家主動造訪過的場域 code（純函式） */
export function getLastVisitedField(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    if (v && /^[A-Z0-9_-]{2,50}$/i.test(v)) return v.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

/** 玩家主動造訪場域時寫入（從 /f 選或進 home 時呼叫） */
export function setLastVisitedField(code: string): void {
  if (typeof window === "undefined") return;
  if (!code || !/^[A-Z0-9_-]{2,50}$/i.test(code)) return;
  try {
    localStorage.setItem(KEY, code.toUpperCase());
  } catch {
    /* ignore */
  }
}

/** 玩家清除歷史（例如登出 / 切會員） */
export function clearLastVisitedField(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
