# Phase 4 W14 D3 — useMyUserName hook + 4 Page 元件整合

**日期**：2026-05-03
**範圍**：W14 D3、新 hook + 4 Page 元件統一整合
**狀態**：🟢 W14 D3 完成、所有主要 host 元件可自動帶 LINE 名字

---

## 🎯 目標達成

> Phase 4 W14 D2 用 prop drilling（HostPlay → HostPageRenderer → KnowledgeMapPage）
> W14 D3 改用 hook 解耦 + 擴充到其他 Page 元件（PolaroidCollage / GuestbookDigital / TriviaShowdown）

---

## 📦 新增

### 1. `client/src/hooks/useMyUserName.ts`

**核心**：
```ts
export function useMyUserName(): string {
  // 來源優先序：URL query > localStorage > ""
}

export function setMyUserName(name: string): void {
  // 寫入 localStorage（玩家手動輸入時用）
}
```

**特色**：
- 跨 tab 同步（listen `storage` event）
- 30 字內限制
- 統一 source of truth：`chitoUserName` localStorage key

### 2. 4 個 Page 元件整合

| Page 元件 | 整合策略 |
|----------|---------|
| PolaroidCollagePage | LINE > useAuth user > 「匿名」 |
| GuestbookDigitalPage | LINE > useAuth user > 空 |
| TriviaShowdownPage | LINE > useAuth user > 「匿名」 |
| KnowledgeMapPage | LINE > 既有 prop（向下相容）|

**Pattern**：
```ts
const lineName = useMyUserName();
const { user } = useAuth();
const myUserName = lineName || user?.firstName || ... || "匿名";
```

LINE 名字優先確保：
- 玩家從 LINE 進入 → 直接用 LINE 名字
- admin 帳號（無 LINE）→ fallback 用 useAuth
- 訪客 → 「匿名」或手動輸入

---

## 💡 設計決策

### 為何用 hook 而非 prop drilling？

選擇：useMyUserName() hook

理由：
- 解耦：HostPageRenderer 不需要每次都傳 prop
- 多元件共享：所有 Page 元件用同一個 source
- 跨 tab 同步：`storage` event 支援
- 未來易擴充（如加新名字來源 Firebase auth）

### 為何 KnowledgeMapPage 保留 prop？

選擇：hook 優先 + prop 向下相容

理由：
- 既有 prop 可能在 testing / storybook 中用到
- 不破壞既有 API
- prop 仍可作為 override（特殊情境）

### 為何優先 LINE 而非 useAuth？

選擇：LINE > useAuth fallback

理由：
- 玩家通常用 LINE 進入 host 元件
- useAuth 多半是 admin / super_admin（大螢幕端）
- 玩家手機用 LINE 名字更貼合身份
- admin 大螢幕端 LINE 為空 → fallback 到 useAuth

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 41/41

---

## ⏭ 下一步：W14 D4-D5

- W14 D4：QR code 改用 LIFF URL（admin 端可選）
- W14 D5：W14 收尾 + W15 LINE Bot 規劃

---

## 🔗 相關文件

- [W14 D2 LINE profile 整合](2026-05-03-phase4-w14-d2-line-profile-integration.md)
- [W14 D1 LIFF MVP](2026-05-03-phase4-w14-d1-liff-mvp.md)
- [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md)
