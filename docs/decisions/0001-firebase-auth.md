# ADR-0001: 使用 Firebase Auth 作為玩家認證

> 日期：2025-Q4（專案初期）
> 狀態：✅ 採用中
> 影響：玩家端認證、QR 掃描入口、跨裝置登入

---

## 背景

平台需要一個低門檻的玩家認證系統：
- 玩家多為一次性訪客（金門遊客）
- 不可要求記住密碼
- 需支援匿名 → 留念照片要綁定身份
- 需支援多裝置（手機掃 QR 進場、後續打開繼續玩）

---

## 選項

| 方案 | 優點 | 缺點 |
|------|------|------|
| 自建 email/password | 完全掌控 | 要寫 reset、verify、密碼安全；記憶難 |
| Firebase Auth | 低門檻、Google/Apple/匿名都支援、SDK 處理 token refresh | 依賴 Google 服務、popup 在 LINE/FB 內部瀏覽器有問題 |
| Auth0 / Supabase Auth | 功能完整 | 訂閱費 |

---

## 決定

**採 Firebase Auth**。

理由：
1. **匿名登入**支援好（玩家可先玩、後綁帳號）
2. **Google + Apple + 自訂 Email** 一站搞定
3. **iOS PWA + Android Chrome** popup 在 standalone 模式下表現可接受
4. SDK 自動處理 token refresh（雖然有 race，PR3a 已修）

---

## 影響

### 後端對應
- `server/firebaseAuth.ts` — `isAuthenticated` middleware 驗 Firebase ID token
- 玩家 `users.id` = Firebase UID

### 紅線
- ❌ **不能假設使用者一定有 email**（匿名使用者沒 email）
- ❌ **不能假設使用者有 firstName**（匿名使用者）→ 顯示用 `getPlayerDisplayName()`
- ⚠️ **getIdToken 的 cache 與 server 時鐘可能 race**（已加 force-refresh retry）

### 已知限制
- LINE / FB 內建瀏覽器：Google popup 會被擋 → 改用 redirect mode
- iOS 16 之前：popup 行為不穩 → 已加 fallback

---

## 後續可能變動

- 未來若要做企業客戶（B2B 場域 admin）→ 那部分用獨立的 Admin JWT（已實作）
- 若 Firebase Auth 漲價或下架 → 可換 Auth0（介面類似）

---

## 相關文件

- [architecture/auth-flow.md](../architecture/auth-flow.md)
- 對應 commit：`server/firebaseAuth.ts` 初版
