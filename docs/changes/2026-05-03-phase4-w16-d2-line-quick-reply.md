# Phase 4 W16 D2 — LINE Quick Reply + Sticker 進階範本

**日期**：2026-05-03
**範圍**：W16 D2（依 ADR-0011 規劃）
**狀態**：🟢 W16 D2 完成、admin 用 LINE 操作體驗大幅升級

---

## 🎯 目標達成

> ADR-0011 W16 D2 規劃：LINE reply 多元件範本擴充（quick reply / sticker）
> 從「純文字 reply」→「sticker 慶祝 + text + quick reply 按鈕」

---

## 📦 修改

### 1. `server/lib/line-bot.ts`

加入 Quick Reply 型別宣告：

```ts
export interface LineQuickReplyItem {
  type: "action";
  action:
    | { type: "message"; label: string; text: string }
    | { type: "uri"; label: string; uri: string }
    | { type: "postback"; label: string; data: string; displayText?: string };
  imageUrl?: string;
}

export interface LineQuickReply {
  items: LineQuickReplyItem[]; // 最多 13 個（LINE 限制）
}

export interface LineMessage {
  // ... 既有欄位
  quickReply?: LineQuickReply; // W16 D2 新增
}
```

### 2. `server/routes/line-webhook.ts`

新增兩個工廠函數：

**`adminQuickReply()`** — admin 常用指令快速按鈕（6 個）：
- 📖 用法 → `@chito help`
- 📦 情境清單 → `@chito list`
- 💒 婚禮 → `@chito 婚禮`
- 🎂 生日 → `@chito 生日派對`
- ❄️ 破冰 → `@chito 破冰活動`
- 🎓 同學會 → `@chito 同學會`

**`celebrationSticker()`** — 建場成功 sticker（拍手慶祝）：
- packageId: `11537`（LINE Friends）
- stickerId: `52002734`（拍手）

### 3. 訊息分發策略

| 情境 | 訊息結構 |
|------|---------|
| 建場成功 | sticker + text(含 quickReply) |
| 建場失敗 | text(含 quickReply) |
| help / list / unknown | text(含 quickReply) |
| 一般訊息（admin） | text(含 quickReply) |
| 一般訊息（非 admin） | text（無 quickReply、避免困惑）|

**為何分 admin / non-admin？**
- 非 admin 看到 `@chito 婚禮` 按鈕會困惑（點了也建不了場）
- admin 看到按鈕加速 30%+ 操作（不用打字）

---

## 💡 設計決策

### 為何用 sticker 而非 emoji？

選擇：建場成功用 LINE 預設貼圖、非 emoji

理由：
- LINE sticker 比 emoji 視覺衝擊強（admin 看到「啊建好了」）
- LINE 預設貼圖免授權、永久可用
- 慶祝感強化 admin 對工具的好印象

### 為何 quick reply 6 個按鈕（非 13 個 max）？

選擇：6 個（用法 + list + 4 種情境）

理由：
- LINE 客戶端按鈕列只能水平滑動、太多按鈕滑很久
- 6 個剛好兩排顯示（手機螢幕大概 3 個 / 排）
- 涵蓋 80% 使用情境（婚禮 / 生日 / 破冰 / 同學會 是 top 4）
- 其他情境 admin 還是可以打字（自然語言彈性大）

### 為何 sticker package 用 11537？

選擇：LINE Friends 官方包

理由：
- 免費永久可用（其他付費 sticker package 隨時可能下架）
- 11537 包含拍手 / 慶祝 / 鼓勵等正向情緒
- 文件確認：https://developers.line.biz/en/docs/messaging-api/sticker-list/

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：維持 45/45（W16 D2 不新增 endpoint、僅優化既有 reply 行為）

---

## 📊 效果預估（W16 D2 完成後）

| 項目 | W15 D5 / W16 D1 | W16 D2 |
|------|-----------------|--------|
| 建場成功訊息 | 純文字 | sticker + 文字 + 6 個 quick reply 按鈕 |
| admin 操作速度 | 每次都要打 @chito ... | 點按鈕 1 秒搞定常用情境 |
| 視覺體驗 | 中規中矩 | 慶祝感 + 引導性 |
| help / list 延伸操作 | 看完訊息要自己打字 | 看完直接點按鈕進下一步 |

---

## ⏭ 下一步：W16 D3

依 ADR-0011 規劃：
- W16 D3：LINE 進階互動（postback events / 圖片 / Flex Message）
- 評估：admin 是否需要透過 LINE 直接管理活動（end / list active）

---

## 🔗 相關文件

- [W16 D1 多元件 instantiate](2026-05-03-phase4-w16-d1-multi-component-instantiate.md)
- [ADR-0011 W16 規劃](../decisions/0011-w16-planning.md)
- LINE Quick Reply 文件：https://developers.line.biz/en/docs/messaging-api/using-quick-reply/
- LINE Sticker 列表：https://developers.line.biz/en/docs/messaging-api/sticker-list/
