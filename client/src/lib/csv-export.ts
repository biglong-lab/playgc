// 📊 G4: CSV 匯出共用工具
// 純前端實作，不需後端 endpoint，也不依賴 Papa Parse
// Excel 相容：加上 UTF-8 BOM + RFC 4180 跳脫規則

/**
 * 單一欄位定義：從 row 物件抽取值並轉字串
 * - header: CSV 表頭
 * - get: 從單列資料回傳「原始值」，undefined/null 會被轉成空字串
 */
export interface CsvColumn<TRow> {
  readonly header: string;
  readonly get: (row: TRow) => string | number | boolean | null | undefined;
}

/**
 * 單一欄位值 → CSV-safe 字串（RFC 4180）
 * - 如包含逗號、雙引號或換行 → 整個值加雙引號，內部雙引號加倍
 * - null/undefined → ""
 * - Date-like 字串直接原樣輸出（避免時區誤差，呼叫方自行 format）
 */
function toCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 組出 CSV 字串（含表頭）
 */
export function buildCsv<TRow>(columns: CsvColumn<TRow>[], rows: TRow[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => toCsvCell(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => toCsvCell(c.get(row))).join(","));
  }
  return lines.join("\r\n");
}

/**
 * 觸發瀏覽器下載
 * - 加 UTF-8 BOM 讓 Excel 正確識別中文
 * - 自動組檔名：`{prefix}-{yyyy-mm-dd}.csv`
 */
export function downloadCsv(csv: string, filenamePrefix: string): void {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const filename = `${filenamePrefix}-${yyyy}-${mm}-${dd}.csv`;

  // UTF-8 BOM — Excel 打開才不會亂碼
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // iOS Safari 需要 append 才能觸發
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 釋放 blob URL（下一個 tick，避免 Safari 還沒開始下載就清掉）
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * 一把抓：組 CSV + 下載
 */
export function exportToCsv<TRow>(
  columns: CsvColumn<TRow>[],
  rows: TRow[],
  filenamePrefix: string
): void {
  const csv = buildCsv(columns, rows);
  downloadCsv(csv, filenamePrefix);
}

/**
 * 格式化日期/時間字串 — 避免各頁重複寫
 * @param value ISO string / Date / null
 * @returns YYYY-MM-DD HH:mm:ss（本地時區）或空字串
 */
export function formatCsvDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const SS = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
  } catch {
    return "";
  }
}

/** 同上但只到 YYYY-MM-DD */
export function formatCsvDate(
  value: string | Date | null | undefined
): string {
  const dt = formatCsvDateTime(value);
  return dt ? dt.slice(0, 10) : "";
}
