# Phase 4 W14 D2 — LINE profile 整合到 /play 頁

**日期**：2026-05-03
**範圍**：W14 D2、HostPlay 讀 query + localStorage + HostPageRenderer 傳遞
**狀態**：🟢 W14 D2 完成、玩家從 LINE 進入後自動帶 LINE 名字

---

## 🎯 目標達成

> Phase 4 W14 D1 完成 LIFF 中繼頁 → 跳轉 `/play?line_user_id=...&line_display_name=...`
> W14 D2 補上 `/play` 端：自動讀 query → 用 LINE 名字（不用手動輸入）

---

## 📦 改動

### 1. `client/src/pages/HostPlay.tsx`

**新增 hook**：`useLineProfileFromQuery()`
- 從 URL query 讀 `line_display_name`
- 存到 localStorage `chitoUserName`（30 字內）
- 既有 localStorage 值優先（避免每次重新讀 query）

**UI 改動**：
- Header 顯示「👋 {LINE 名字}」（綠色強調）
- 傳 `myUserName` 給 `HostPageRenderer`

### 2. `client/src/components/game/host/HostPageRenderer.tsx`

**新增 prop**：
```ts
interface HostPageRendererProps {
  page: Page;
  myUserName?: string;  // W14 D2 新增
}
```

**傳遞**：目前先傳給 `KnowledgeMapPage`（已支援 myUserName prop），其他 Page 元件 W14 D3 漸進加入。

### 3. localStorage `chitoUserName` 規範

- key: `chitoUserName`
- value: 30 字內字串
- 來源：LIFF profile 或玩家手動輸入
- 用途：multi 元件 / Solo 元件可讀取自動填名字

---

## 💡 設計決策

### 為何用 localStorage 而非 sessionStorage？

選擇：localStorage（永久）

理由：
- 玩家可能多次回訪不同活動
- 同一個 LINE 帳號名字穩定（不需每次重設）
- F5 / 跨頁 / 跨 session 都保留
- sessionStorage 只在當前 tab、太短

### 為何 W14 D2 只傳給 KnowledgeMapPage？

選擇：先做 1 個元件、其他 W14 D3 漸進加入

理由：
- KnowledgeMapPage 已原生支援 myUserName prop
- 其他元件需個別評估（如 GuestbookDigitalPage 從 useAuth 取）
- 80/20 法則：先讓核心流程跑通、其他補強

### 為何 query → localStorage 而非直接用 query？

選擇：先存 localStorage 再讀

理由：
- F5 後 query 仍在（OK）
- 但跨頁面（如玩家切到其他元件）query 會消失
- localStorage 保證跨頁面持久
- 多個元件共享單一 source of truth

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 41/41（純 client 改動、無新 endpoint）

---

## ⏭ 下一步：W14 D3-D5

- W14 D3：其他 Page 元件 myUserName 整合（GuestbookDigital / PolaroidCollage）
- W14 D4：QR code 改用 LIFF URL（admin 端可選）
- W14 D5：W14 收尾 + W15 LINE Bot 規劃

---

## 🔗 相關文件

- [W14 D1 LIFF MVP](2026-05-03-phase4-w14-d1-liff-mvp.md)
- [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md)
