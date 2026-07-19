# LINE Webhook 轉拋對接規格 — game.homi.cc / 賈村

> 給「另一個系統」的對接文件。請把 LINE 送來的 webhook 事件「原封不動」轉拋到
> game.homi.cc，只要原料不變，我方簽章驗證就會通過，運作與 LINE 直連完全相同。
> 本文件不含任何機密金鑰，可直接轉給對方工程師。

---

## 01 · 轉拋目標

| 項目 | 值 |
|---|---|
| **端點** | `POST https://game.homi.cc/api/webhooks/line/JIACHUN` |
| **Content-Type** | `application/json` |
| **連通測試** | `GET https://game.homi.cc/api/webhooks/line/health` → 回 200 即通（不需簽章）|

> `JIACHUN` = 賈村場域代號，決定用哪個場域的金鑰驗證，**請勿更動**。

## 02 · 必須「原樣」帶過來的兩樣東西

1. **Body**：LINE 原始 request body 的**原始位元組（raw bytes）**。
   不可先 `JSON.parse` 再重新輸出——即使內容一樣，只要空白、欄位順序、編碼有變，簽章就會對不上。
2. **Header** `X-Line-Signature`：LINE 原本給的值，**原樣轉發**。（其他 LINE 標頭可帶可不帶。）

## 03 · 最關鍵：簽章怎麼驗

我方收到後，用**賈村 Channel Secret** 對「收到的 raw body」做 `HMAC-SHA256` → `base64`，
再跟 `X-Line-Signature` 比對。相符才處理，不符直接丟棄。

> 白話：body 的「原始位元組」和「簽章」是配對的鎖與鑰匙。中途把 body 拆開重組，
> 鑰匙就配不上鎖。所以 **不要動 body、把 signature 原樣帶上** 就好。

## 04 · 如果無法保證 raw body 不變（二選一）

- **方案 A（推薦）**：你方拿「賈村 Channel Secret」自己對送出的 body 重算
  `HMAC-SHA256 → base64`，放進 `X-Line-Signature` 再送。我方零改動。
- **方案 B**：改用「共享密鑰／白名單 IP」取代 LINE 原生簽章。需 game.homi.cc 改程式並部署。

## 05 · 需要向場域方索取（🔒 機密，只能私下給、勿入公開文件/前端/Git）

- **賈村 Channel Secret** — 走方案 A 時必需
- **Channel Access Token** — 僅當你方要代為「回覆」訊息時才需要（一般不需要，回覆由 game.homi.cc 處理）

## 06 · 方案 A 重新簽章範例（Node.js）

```js
const crypto = require("crypto");
// rawBody = 要送出那份 body 的原始 bytes
const signature = crypto
  .createHmac("SHA256", CHANNEL_SECRET)
  .update(rawBody)
  .digest("base64");
headers["X-Line-Signature"] = signature;
headers["Content-Type"]     = "application/json";
// POST 到 https://game.homi.cc/api/webhooks/line/JIACHUN
```

## 07 · 對接檢查清單

- [ ] 打通 `GET /api/webhooks/line/health`（回 200）
- [ ] 轉拋時 body 保留 LINE 原始 raw bytes（未重新序列化）
- [ ] 帶上 `X-Line-Signature`（原樣，或走方案 A 重簽）
- [ ] POST 到 `/api/webhooks/line/JIACHUN` 收到我方 `200 OK`
- [ ] LINE 官方帳號實測傳訊息 → bot 有正常回應

---

> **備註**：LINE 每個 channel 只能設一個 webhook URL。建議架構
> 「LINE → 你方系統 → 轉拋 game.homi.cc」，如此 game.homi.cc 現況零改動、風險最低。
