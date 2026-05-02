# @chito/api-client — CHITO Public API v1 TypeScript SDK

> CHITO 數位遊戲平台對外 API 的 TypeScript 客戶端
> 對應 OpenAPI 3.1 規格：https://game.homi.cc/api/v1/openapi.json

## 安裝

目前 SDK 尚未發佈到 npm，可直接複製 `src/` 內檔案到您的專案：

```bash
# 複製 sdk/typescript/src/* 到您的 lib/
cp -r sdk/typescript/src ./lib/chito-client
```

或在 monorepo 中：

```jsonc
// package.json
{
  "dependencies": {
    "@chito/api-client": "file:../../sdk/typescript"
  }
}
```

## 用法

### 建立 client

```ts
import { ChitoClient } from "@chito/api-client";

const chito = new ChitoClient({
  apiKey: process.env.CHITO_API_KEY!,
  // baseUrl: "https://game.homi.cc/api/v1", // 預設
});
```

### 列出情境

```ts
const result = await chito.scenarios.list({ status: "live" });
console.log(`共 ${result.total} 個情境`);
for (const s of result.data) {
  console.log(s.id, s.name, s.tagline);
}
```

### 取得單一情境

```ts
const wedding = await chito.scenarios.get("wedding");
console.log(wedding.components); // 完整元件列表
```

### 建立實例（一鍵建場）

```ts
const instance = await chito.instances.create({
  scenarioId: "wedding",
  displayName: "Hung & Anita 5/15 婚禮",
  customerEmail: "couple@example.com",
  idempotencyKey: "agency-order-001", // 可選、防重發
});

console.log(`建立 ${instance.totalCreated} 個元件`);
for (const c of instance.components) {
  if (c.hostUrl) console.log(`📺 ${c.label}: ${c.hostUrl}`);
  if (c.playUrl) console.log(`📱 ${c.label}: ${c.playUrl}`);
  if (c.gameUrl) console.log(`🎮 ${c.label}: ${c.gameUrl}`);
}
```

### 查自己的 metadata

```ts
const me = await chito.keys.me();
console.log(`label: ${me.label}, fieldId: ${me.fieldId}, quota: ${me.quota}`);
```

### 健康檢查

```ts
const health = await chito.health();
console.log(`API ${health.version} - ${health.status}`);
```

## 錯誤處理

```ts
import { ChitoClient, ChitoApiError } from "@chito/api-client";

try {
  await chito.instances.create({ scenarioId: "non-existent" });
} catch (err) {
  if (err instanceof ChitoApiError) {
    console.error(`API error: ${err.code} (${err.status})`);
    if (err.code === "rate_limit_exceeded") {
      // wait + retry
    } else if (err.code === "scenario_not_found") {
      // handle specifically
    }
  }
}
```

## 完整類型

詳見 `src/types.ts`。重點型別：

- `Scenario` / `ScenarioListItem` — 情境
- `Instance` / `InstanceComponent` — 實例
- `ApiKeyMetadata` — 自己的 key 設定
- `ChitoApiError` — 統一錯誤類型

## 速率限制

API 限速：每 key 60 req/min。

超過上限會丟 `ChitoApiError`，code = `"rate_limit_exceeded"`，可看 `err.status` (429)。

```ts
try {
  // ...
} catch (err) {
  if (err instanceof ChitoApiError && err.code === "rate_limit_exceeded") {
    await new Promise((r) => setTimeout(r, 60000)); // 等 60 秒
    // 重試
  }
}
```

## Idempotency

POST `/instances` 建議帶 `idempotencyKey`：

- 24 小時內相同 key 重發回相同結果
- 防止網路重試導致重複建場 / 扣款

```ts
await chito.instances.create({
  scenarioId: "wedding",
  idempotencyKey: `order-${orderId}`, // 用您的訂單 ID
});
```

## Node 版本要求

- Node 18+ （內建 fetch）
- 若用 Node < 18，請傳入 `fetch` polyfill：

```ts
import nodeFetch from "node-fetch";
const chito = new ChitoClient({
  apiKey: "...",
  fetch: nodeFetch as any,
});
```

## 取得 API key

聯絡 CHITO 業務（LINE / Email）：
- 提供：公司名稱 + 技術窗口 + 預期月使用量
- 審核後發 `ck_test_*`（測試）+ `ck_live_*`（生產）

## 支援與回報

- 文件：https://game.homi.cc/api-docs
- OpenAPI：https://game.homi.cc/api/v1/openapi.json
- 問題回報：聯絡業務窗口

## License

MIT © CHITO 平台
