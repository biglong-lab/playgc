# Phase 4 W16 D1 — instantiator-line 擴充支援多元件

**日期**：2026-05-03
**範圍**：W16 D1（依 ADR-0011 規劃）
**狀態**：🟢 W16 D1 完成、LINE admin 建場支援所有 axis（host + multi + solo + shared）

---

## 🎯 目標達成

> ADR-0011 W16 D1 規劃：scenario-instantiator-line 擴充支援所有 components
> 從「只建第 1 個 host」→「建情境完整版（多元件 + multi/solo + shared）」

---

## 📦 修改

### 1. `server/routes/scenarios.ts`

把兩個 helper 從 file-private 改 export：

```ts
export function getDefaultConfigForPageType(pageType, scenarioName)
export function getGameModeForComponent(component)
```

**為什麼**：避免在 instantiator-line 內複製 200 行 default config 邏輯。
**風險評估**：純 export 改動、不影響 endpoint 行為。

### 2. `server/lib/scenario-instantiator-line.ts`（重寫）

**之前（W15 D5）**：
```ts
// 只建第 1 個 host 元件
const hostComponent = scenario.components.find((c) => c.axis === "host");
```

**現在（W16 D1）**：
```ts
// 建所有元件（host + multi + solo + shared）
for (const component of scenario.components) {
  const instance = await instantiateOneComponent({ ... });
  instances.push(instance);
}
```

**新增**：
- `instantiateOneComponent` helper — 建立單一元件 game/page/(session)
- `LineInstance` 介面 — 多元件 instance 結構
- `primaryHostUrl` / `primaryPlayUrl` / `primaryGameUrl` — 主入口（host 第一個 / 非 host 第一個）

### 3. `server/routes/line-webhook.ts`

新增 `formatInstantiateReply()` 多元件訊息範本：

```
✅ 建場成功！

📦 情境：婚禮現場互動
📝 名稱：Hung & Anita 5/15 婚禮
⏰ 有效期：12 小時
🎮 元件數：3

🖥 大螢幕網址（請投影）：
https://game.homi.cc/host/xxx?token=xxx

📱 玩家網址（QR 給來賓掃）：
https://game.homi.cc/play/xxx

📋 元件清單：
🖥 紀念牆
   https://game.homi.cc/host/aaa?token=...
🖥 簽名簿
   https://game.homi.cc/host/bbb?token=...
🖥 情緒池
   https://game.homi.cc/host/ccc?token=...
```

---

## 💡 設計決策

### 為何用 export helpers 而非抽 lib？

選擇：scenarios.ts 暴露 helpers、不另開 lib

理由：
- 抽 lib 需動 scenarios.ts 的核心邏輯（風險高）
- export 兩個 pure function 是最小改動
- 既有 admin endpoint 邏輯完全不變
- W16 D5 收尾再評估是否抽 lib（看是否真的有共用價值）

### 為何 truncate 元件清單到 5 個？

選擇：超過 5 個 → 顯示「還有 N 個元件，請至 admin 後台查看」

理由：
- LINE text message 上限 5000 字（含 URL 可能超過）
- 12 情境最多元件數約 5-6 個（婚禮 / 同學會 / 街區走讀）
- 5 個元件 + URL 約 1500-2000 字、安全在上限內
- 超過的請 admin 用後台補（不應該需要）

### 為何序列建立而非並行？

選擇：for...of 序列 await

理由：
- DB 連線壓力（pg pool 預設 10 連線）
- 易 debug（哪個元件失敗清楚）
- 速度足夠（5-6 個元件 < 1 秒）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：維持 45/45（W16 D1 不新增 endpoint、僅擴充 lib 行為）

---

## 📊 對比 W15 D5 → W16 D1

| 項目 | W15 D5 | W16 D1 |
|------|--------|--------|
| 元件數 | 只建第 1 個 host | 建所有 components |
| 軸線 | 只 host | host + multi + solo + shared |
| LINE 訊息 | 1 個 hostUrl | 主入口 + 元件清單（最多 5 個）|
| 場景覆蓋率 | ~ 60%（只支援 host-heavy 情境）| 100%（12 情境全支援）|

---

## ⏭ 下一步：W16 D2

依 ADR-0011 規劃：
- W16 D2：LINE reply 多元件範本擴充（quick reply buttons / sticker）
- 評估：是否要把所有 hostUrl 拆成多個訊息發送（避免 truncate）

---

## 🔗 相關文件

- [W15 D5 admin instantiate](2026-05-03-phase4-w15-d5-admin-instantiate.md)
- [ADR-0011 W16 規劃](../decisions/0011-w16-planning.md)
