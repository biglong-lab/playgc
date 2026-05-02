# Phase 2 W8 D1 — Scenario Health + Smoke Test 自動化

**日期**：2026-05-02
**範圍**：W8 D1、新增 1 個健康檢查端點 + 1 個 smoke test 腳本
**狀態**：🟢 W8 D1 完成、CI/監控可自動驗證情境平台

---

## 🎯 目標達成

> Phase 2 W5-W7 三週功能全部完成、E2E 手動驗證 20 端點全綠
> Phase 2 W8 D1 補上「自動化驗證」 — 用一個指令跑完整 smoke test，未來 CI 可自動檢查

---

## 📦 新增

### 1. 健康檢查端點：`server/routes/scenario-health.ts`

**端點**：`GET /api/scenarios/health`（公開、不需認證）

**回應結構**：
```json
{
  "status": "ok",
  "timestamp": "2026-05-02T...",
  "total": 12,
  "byStatus": { "live": 9, "preview": 3, "planned": 0 },
  "byCategory": { "social": 4, "event": 3, "public": 2, "corporate": 2, "venue": 1 },
  "categoryLabels": { ... },
  "totalComponents": 36,
  "uniquePageTypes": 18,
  "scenarios": [
    {
      "id": "wedding",
      "name": "婚禮派對情境包",
      "category": "social",
      "status": "live",
      "componentCount": 3,
      "axes": ["host"]
    },
    ...
  ]
}
```

**用途**：
- smoke test 驗證情境清單可正常讀取
- 監控系統定期 ping 確認服務健康
- 業務工具確認生產資料一致性
- 未來「客戶端統計儀表板」可用此 endpoint

### 2. Smoke test 腳本：`scripts/smoke-test-scenarios.mjs`

**用法**：
```bash
# 預設打 production
node scripts/smoke-test-scenarios.mjs

# 指定 base URL
BASE_URL=http://localhost:3333 node scripts/smoke-test-scenarios.mjs
```

**驗證 5 大區塊**（共 24 個檢查）：

1. **公開頁**（6 個）：/ /pitch /find-scenario /template-market /showcase /admin/scenario-qr-print
2. **12 情境詳情頁**：每個 /template-market/:id
3. **Health endpoint**：JSON 結構 + 12 情境 + 9+ live
4. **POST instantiate 認證守衛**（3 個）：401 認證守衛正確
5. **host/play SPA 路徑**：/host/smoke-test、/play/smoke-test

**輸出**：彩色結果（綠 ✅ / 紅 ❌）+ 失敗清單 + exit code（0/1）

**CI 整合**：可加到 GitHub Actions 部署後驗收：
```yaml
- name: Smoke Test
  run: node scripts/smoke-test-scenarios.mjs
  env:
    BASE_URL: https://game.homi.cc
```

---

## 💡 設計決策

### 為何 health endpoint 放公開（不需認證）？

選擇：公開 + 不含敏感資料

理由：
- 監控工具不需要 token 即可檢查
- 內容只有情境 metadata（已是公開的 SCENARIO_TEMPLATES 資料）
- 不洩漏 admin / fieldId / hostToken
- 簡化 CI 整合

### 為何 smoke test 用 mjs 不用 ts？

選擇：純 ESM JavaScript（.mjs）

理由：
- 不依賴 ts-node / tsx 即可跑
- CI 環境只需 Node 18+ 即可
- 純 fetch API、無第三方套件
- 部署 image 不用安裝額外依賴

### 為何不用既有 Vitest？

選擇：獨立 smoke test 腳本而非加到 vitest test suite

理由：
- smoke test 是「對生產 / staging 環境」的驗證，不是單元測試
- vitest 適合單元 + 整合，不適合外部 HTTP 測試
- smoke test 是「部署後立即跑」的工具，跑得越快越好
- 可獨立給 CRON / 監控用，不需安裝 dev dependencies

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署：（即將）
- Smoke test 預期結果：24/24 通過

---

## ⏭ 下一步：W8 D2-D5

- W8 D2：admin scenario instances 列表頁（/admin/my-scenarios）
- W8 D3：第一場真實付費情境的 demo 影片（30 秒 / 情境）
- W8 D4：Phase 2 整體收尾文件
- W8 D5：Phase 3 規劃啟動

---

## 🔗 相關文件

- [W7 完整收尾](2026-05-02-phase2-w7-complete.md)
- [W5-W7 三週回顧](2026-05-02-phase2-w5w6w7-recap.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
