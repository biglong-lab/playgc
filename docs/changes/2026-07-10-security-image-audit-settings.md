# 安全補強 × 圖片本地壓縮 × 系統紀錄 × 設定管理 — 2026-07-10

> 範圍：全站（雙塊面共用基礎設施為主）
> 狀態：4 批全部完成（commit a12d1842 / de4f15ce / 5a65107f / 440fd9dd）、待 push
> 規劃來源：四路並行盤點（功能 / 安全 / 圖片 / 紀錄與設定）

---

## 背景

業主要求針對平台兩大塊面（體驗互動工具＋活動虛實整合）做：系統安全分析、
模組功能優化、圖片本地壓縮、功能盤點、網站安全、完整系統紀錄（audit log）、
設定管理提升。經 4 個並行代理盤點後定案 4 批實作。

## 盤點結論摘要

- **功能**：~29.4 萬行、無死路由；`scenarios.ts`（3441 行、27 TODO）為最大技術債熱點；`battle-clans` 已 deprecated（Squad 取代）
- **安全**：基礎紮實（無硬編碼秘密、SQL 全參數化、helmet CSP、限流、爆破鎖定）；待補 7 項（見第 1 批）
- **圖片**：玩家拍照類已有 canvas 壓縮（參數不一）；管理端 6+ 上傳點零壓縮、base64 直送（單張可達 5–15MB）
- **紀錄**：audit 雙層安全網已存在；缺 retention、設定不記改前後值、5 個 scheduler 無執行歷史、audit 寫入失敗靜默
- **設定**：散落 4 處（fields.settings / fields 欄位 / feature_flags / line_login_config），無版本歷史

## 實作批次

### 第 1 批：安全補強 ✅（本批）

| # | 項目 | 檔案 |
|---|------|------|
| 1 | `/api/admin/synthetic-runs` 補 `requireAdminAuth` | `server/routes/cron-endpoints.ts` |
| 2 | Stripe webhook 簽章驗證（`verifyStripeWebhookSignature`：t=,v1= 格式＋5 分鐘重放容忍） | `server/lib/webhook-signature.ts`、`server/routes/payments.ts` |
| 3 | 上傳 magic-byte 型別驗證（新 `server/lib/media-mime.ts`、接 cloudinary.ts 四關卡點：uploadImage/Video/Audio/ImageWithTag；玩家高流量端點型別不符回 400） | `server/lib/media-mime.ts`、`server/cloudinary.ts`、`server/routes/media.ts` |
| 4 | Firebase Admin 憑證缺失時 production 明確報錯（不再靜默降級；已確認生產 env 憑證齊全） | `server/firebaseAuth.ts` |
| 5 | 預約玩家端拒絕 `manual:` 偽 lineUserId（封 booking code 列舉他人預約含電話的洞）＋ 4 端點加 hotPathLimiter | `server/routes/bookings.ts` |
| 6 | client 12 處 console.log 改 `import.meta.env.DEV` gate（prod bundle 死碼消除） | qr-scan / usePhotoCamera / cloudinary-audio / MapView / page-config-inline-editors |
| 7 | WS 匿名連線占比統計（觀察階段；host 大螢幕 role=player 刻意匿名、切強制前先看數據） | `server/routes/websocket.ts` |

新增測試：`server/lib/__tests__/media-mime.test.ts`（12）、`webhook-signature.test.ts` 追加 Stripe 6 測試。

### 第 2 批：圖片本地壓縮 ✅（de4f15ce）
`browser-image-compression` ＋ `image-compress.ts` util ＋ `useCompressedUpload` hook；
接入 UploadImageButton / useGameMediaUpload / PosProductsAdmin / SquadSettings /
EditableCoverImage / useGallery；統一 usePhotoCamera 與 PhotoBurstFlow 參數。
注意：透明 Logo 依 file.type 輸出 PNG/WebP、影音分支不壓。

### 第 3 批：系統紀錄補強 ✅（5a65107f）
audit_logs 180 天 / error_logs 90 天 retention（併 observability-cleanup cron）；
設定變更記 before/after（沿用 redact）；line-login-config PATCH 補 audit；
新表 `scheduler_runs`（純 ADD）接 5 個 scheduler；audit 寫入失敗 Sentry 告警。

### 第 4 批：設定管理提升 ✅（440fd9dd）
AdminSettings 統一設定中心（導航整合）；基於 before/after audit 的變更歷史檢視；
非金鑰欄位一鍵還原。

## 已知風險與緩解

- WS 強制認證延後：先觀察匿名占比（本批 #7），避免弄壞 host 匿名大螢幕
- 圖片壓縮透明底：util 依型別選輸出格式
- retention 誤刪：期限保守（180/90 天）

## 後續建議（本次不做）

- `scenarios.ts` 27 TODO 清理（低頻大檔、碰到才拆）
- WS 匿名連線切強制（依觀察數據）
- npm audit 剩餘 9 個 breaking 升級評估

## 驗證

- `npx tsc --noEmit` ✅
- 新增測試 18 個全過
- 全套 vitest：每批後各跑一次、皆 224 檔 3252 過＋2 skip（skip 與 2 個 unhandled teardown 噪音為既有、已對照改動前版本確認）
- `npm run build` ✅（第 2、4 批後各一次）

## 相關文件

- [2026-07-04-optimization-inventory.md](2026-07-04-optimization-inventory.md)（前次盤點、部分項目已完成）
- [2026-07-09-sitewide-optimization.md](2026-07-09-sitewide-optimization.md)
