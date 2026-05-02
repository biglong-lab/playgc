# Runbook — 代理商 onboarding 完整 SOP

> 給業務 / admin 接洽代理商用
> 適用：第一次帶代理商從合作意向到第一次成功 API 呼叫
> 時間：60-120 分鐘（含技術設定）

---

## 🎯 適用情境

- 婚禮顧問公司（想在自家網站 widget 建場）
- 活動公司（CRM 整合、收 lead 自動派場）
- 教育平台（內訓課程結束自動建破冰場）
- SaaS 整合商

---

## 📞 Step 1：接洽前準備（admin 自查）

### 評估代理商
- [ ] 是否技術整合能力足夠（有開發人員）？
- [ ] 月預期建場量 > 10 場？（少於 10 場建議走業務模式）
- [ ] 是否能自行管理客戶關係？（CHITO 不直接對接終端客戶）

### 收費模式選項

| 方案 | 適合對象 | 內容 |
|------|---------|------|
| 抽成 | 初期合作 | 每場 NT$ 500-1,500 抽成（依規模）|
| 月費 | 中型代理商 | NT$ 5,000-15,000 / 月 + 配額 |
| 包月無限 | 大型代理商 | NT$ 30,000+ / 月、無建場上限 |

---

## 🎤 Step 2：會面 / 帶看（30 分鐘）

### 動線

```
1. /pitch                  → 看 CHITO 完整介紹（10 分鐘）
2. /api-docs                → 看 API 規格（10 分鐘）
3. 看 OpenAPI JSON         → 給技術人員匯入 Postman
4. 一起跑 GET /api/v1/health → 確認連線
5. 簽合作協議 → 收費 → 設定環境變數
```

### 講解重點

- **CHITO 12 情境模板** — 代理商可選擇對哪些情境收費
- **API 認證** — Bearer ck_test_*（測試）/ ck_live_*（生產）
- **速率限制** — 60 req/min/key（不夠可申請升級）
- **Idempotency** — POST 必帶 Idempotency-Key（避免重複）
- **計費** — 每場 instantiate 計費、退款 7 天內可申請

---

## 🔑 Step 3：API key 發放（admin 操作）

### 取得代理商資訊
- 代理商名稱
- 技術窗口（email / LINE）
- 對應場域 fieldId（自己場域或 super_admin 指定）

### 生成 API key

```bash
# 生成 32 字元 hex random（可用 node 一行）
node -e "console.log('ck_test_' + require('crypto').randomBytes(16).toString('hex'))"
# 例：ck_test_a3f8b2c4d5e6f7g8h9i0j1k2l3m4n5o6
```

### 設定生產環境變數

```bash
# 加進 docker-compose.prod.yml 的 .env

# 1. API key whitelist（逗號分隔）
API_KEYS=ck_test_a3f8b2c4d5e6f7g8h9i0j1k2l3m4n5o6,ck_live_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5

# 2. API key → fieldId mapping（key 前 8 字元）
API_KEY_FIELD_ck_test_=field_jc_jiacun
# 或
API_KEY_DEFAULT_FIELD=field_jc_jiacun
```

### 重啟 docker

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
docker compose -f docker-compose.prod.yml up -d
```

### 驗證

```bash
# 1. health 應 200
curl https://game.homi.cc/api/v1/health

# 2. 用代理商的 key 列情境
curl -H "Authorization: Bearer ck_test_a3f8b2..." \
  https://game.homi.cc/api/v1/scenarios

# 3. POST /instances 應建立成功（202）
curl -X POST https://game.homi.cc/api/v1/instances \
  -H "Authorization: Bearer ck_test_a3f8b2..." \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"wedding"}'
```

---

## 📋 Step 4：交付給代理商

### 給代理商的訊息模板

```
您好！

CHITO API 已開通：

🔑 API Key（測試環境）：ck_test_a3f8b2c4d5e6f7g8h9i0j1k2l3m4n5o6
🌐 Base URL: https://game.homi.cc/api/v1
📖 文件: https://game.homi.cc/api-docs
📦 OpenAPI: https://game.homi.cc/api/v1/openapi.json
🛡 速率: 60 req/min
🔁 Idempotency: 建議所有 POST 都帶 Idempotency-Key

請先用 GET /api/v1/health 確認連線：
$ curl https://game.homi.cc/api/v1/health

完成測試後通知我，我會發 ck_live_xxx 上線 key。

技術窗口：[name / LINE]
帳務窗口：[name / LINE]
```

---

## 🛠 Step 5：代理商自我測試（代理商執行）

代理商照 `/api-docs` 步驟驗證：

1. ✅ `GET /api/v1/health` → 200
2. ✅ `GET /api/v1/scenarios` 帶 key → 200
3. ✅ 改用無效 key → 401
4. ✅ 連續發 65 次 → 第 61 次起 429
5. ✅ POST `/api/v1/instances` 帶 Idempotency-Key
6. ✅ 24h 內重發相同 key → 回相同結果（含 `Idempotent-Replay: true`）

代理商通知 admin 測試完成 → 發 ck_live_xxx 上線。

---

## 🚀 Step 6：上線後監控（持續）

### 每週查看代理商使用統計

```bash
# 查代理商建場數（用 [via:api/v1] 標記）
psql -c "SELECT COUNT(*) FROM games WHERE description LIKE '%[via:api/v1]%' AND created_at > NOW() - INTERVAL '7 days'"
```

### 每月帳務

- 從 game.description 抽取 `[via:api/v1]` + `[scenario:<id>]`
- 對應到代理商方案（抽成 / 月費 / 包月）
- 寄帳單（Resend 自動寄、待 W12 整合）

### 異常處理

| 問題 | 處理 |
|------|------|
| 代理商說「429 太常」 | 升級配額（環境變數 `API_RATE_LIMIT_KEY_*`，待 W12 補上）|
| 代理商說「建場後找不到 game」| 確認 fieldId 對應正確 |
| 代理商 ck 外洩 | 立即從 API_KEYS 環境變數移除 + 重啟 + 通知代理商 |
| 計費爭議 | 用 game.description 標記重新計算 |

---

## 🚨 紅線（不可違反）

1. **不直接接觸終端客戶** — 代理商客戶 = 代理商客戶（CHITO 不挖牆腳）
2. **不在 LINE 公開 API key** — 用加密 email / 私訊
3. **不接代理商的 webhook 反向觸發**（W12 +）— 目前只有 outbound API
4. **不承諾 SLA**（W11 階段）— 等正式商業化（Phase 4+）才簽 SLA
5. **API key 測試 / 生產嚴格區分**（ck_test_* / ck_live_*）

---

## ⏭ 後續優化方向（W12+）

- API key DB 表（取代環境變數）
- 代理商 dashboard 看自己的用量 / 帳務
- Webhook 反向觸發（活動結束通知代理商）
- API SDK（TypeScript / Python）
- Rate limit 動態調整

---

## 🔗 相關文件

- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)
- [W11 完整收尾](../changes/2026-05-03-phase3-w11-complete.md)
- [客戶 onboarding（B2C）](customer-onboarding.md)
- [API 公開文件](https://game.homi.cc/api-docs)
- [OpenAPI JSON](https://game.homi.cc/api/v1/openapi.json)
