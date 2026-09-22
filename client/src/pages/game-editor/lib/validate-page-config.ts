// 頁面設定驗證 — 2026-09-23 起實作搬到 shared/lib/page-config-validation.ts（前後端共用）
// 這裡保留舊路徑的 re-export，編輯器既有 import 不必改、行為不變
export {
  validatePageConfig,
  validateCrossPageFlow,
  validateAllPages,
  formatIssue,
} from "@shared/lib/page-config-validation";
export type { ValidationIssue, PageLike } from "@shared/lib/page-config-validation";
