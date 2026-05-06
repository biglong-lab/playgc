# 多人元件大清理 — 2026-05-06

> 範圍：客戶端 multi/ 元件 + admin editor + GamePageRenderer
> 狀態：✅ 完成
> 部署：尚未部署（待使用者明確指示）
> 部署 commits：`9d634b21..8762d5da`

---

## 背景

使用者測試 session URL 後發現「並不會有實際動作」，要求盤點現況。盤點結果：

- multi/ 目錄累積 416 個多人元件
- admin editor `constants.ts` 中只有 30 種 page type 可選
- 意思是 416 - 30 = **386 個元件雖然有 GamePageRenderer 路由，但永遠不會被執行**（沒有 admin 能建立這個 type 的 page）
- 這些元件橫跨多個 session 累積（從 Round 16 → Round 145+ → 本次 Round 1-43）
- 主題從合理（破冰、團建）漂移到詩意（鳥居、霜晶、楓葉飄落）

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `client/src/components/game/multi/` | 1057 檔刪除（元件 + Page + 測試）|
| `client/src/components/game/GamePageRenderer.tsx` | 1602 → 540 行（-1062 行）|
| `client/src/pages/game-editor/constants.ts` | +30 page type 接入（30 → 60）|
| `client/src/pages/game-editor/getDefaultConfig.ts` | +51 個 default config |

---

## 解決方案

### 兩階段執行

#### 階段 A：本次 session 事件清理（commit 9d634b21）

從本次 session loop（Round 1-43）產生的 84 個元件中：
- **保留 21 個**對應五大商業情境的互動模組
- **刪除 63 個**詩意自然 / 抽象重複主題
- **同時刪除之前 session 累積的 202 個明確空轉元件**
- 共刪除 265 個元件 = 784 個檔案

接入 admin editor：
- 新增 21 種 page type 到 `PAGE_TYPES`
- 補建 21 個 default config

#### 階段 B：未接入元件再篩選（commit 8762d5da）

階段 A 後剩 121 個未接入元件，再按重複度精選：
- **保留 30 個**真正不重複、有用的工具
- **刪除 91 個**內部重複（22 Wall/Board 中刪 18，12 能量心情中刪 10 等）
- 共刪除 91 個元件 = 273 個檔案

接入 admin editor：
- 新增 30 種 page type
- 補建 30 個 default config

---

## 實作步驟（commit 序列）

### `9d634b21` — 階段 A
```
refactor(multi): 移除 265 個空轉元件 + 接入 21 個保留元件到 admin editor

- 變更檔案：787
- 刪除行數：-105,007
- 新增行數：+71
```

### `8762d5da` — 階段 B
```
refactor(multi): 階段B 精選 30 個接入 + 刪除 91 個重複互動工具

- 變更檔案：276
- 刪除行數：-36,033
- 新增行數：+106
```

### 兩個 commit 累計
- 變更檔案：1,060
- 刪除行數：-141,040
- 新增行數：+177

---

## 最終資產（60 個可用 page type）

### 工具元件（9）
`vote_team`, `shooting_team`, `gps_team_mission`, `choice_verify_race`, `lock_coop`, `relay_mission`, `territory_capture`, `photo_team`, 含 `PhotoTeamGather`

### 階段 A 互動模組（21）— 對應商業情境
| 情境 | page type |
|------|-----------|
| 婚禮生日 | `wedding_vow`, `birthday_candle`, `gratitude_tree` |
| 頒獎聚會 | `award_ceremony`, `dinner_table`, `party_menu` |
| 破冰團建 | `spot_vote`, `team_dream`, `group_nickname`, `peer_praise`, `scale_check` |
| 場域反饋 | `venue_rating`, `activity_memo` |
| 內訓結尾 | `micro_commit`, `closing_thought`, `gift_to_team`, `ability_badge` |
| 團體互動 | `high_low_card`, `role_board`, `discovery_card`, `flag_design` |

### 階段 B 互動模組（30）
| 分類 | page type |
|------|-----------|
| 協作關卡（Phase 3 真實規劃）| `jigsaw_puzzle`, `treasure_hunt`, `gps_cascade`, `collective_score`, `role_assign` |
| 工作坊破冰 | `never_have_i_ever`, `would_you_rather`, `two_truths`, `check_in`, `speed_networking` |
| 敏捷回顧 | `kpt_retro`, `four_ls`, `rose_bud_thorn` |
| 團隊建構 | `team_pact`, `team_health_check`, `team_radar` |
| 簽到能量 | `safety_check`, `energy_map` |
| 互動牆 | `wish_wall`, `idea_wall`, `story_wall`, `brain_dump` |
| 投票工具 | `dot_vote`, `rank_choice`, `multi_vote`, `scaled_feedback` |
| 經典思考 | `thinking_hats`, `host_word_cloud`, `mad_libs`, `quest_chain` |

---

## 驗證

| 驗證項 | 結果 |
|--------|------|
| TypeScript 編譯 | ✅ 通過 |
| 階段 A 取樣測試（10 元件）| ✅ 189/189 全綠 |
| 階段 B 取樣測試（5 元件）| ✅ 66/66 全綠 |
| GamePageRenderer 編譯 | ✅ 1602 → 540 行 |
| admin editor 可選 page type | ✅ 30 → 60 |

待手動驗證：
- ⏳ 實際在 admin editor 拖拉新元件建立 scenario
- ⏳ 跑真實 session 端對端流程
- ⏳ Playwright e2e 測試（後續）

---

## 已知限制 / 後續優化

1. **本次未做 e2e 驗證**：下次必須補。原指令就是要 e2e，這次清理只做了單元測試
2. **60 個 page type 在編輯器列表會很長**：未來可能需要分組顯示
3. **部分元件可能還有重複**：60 個中可能還有 5-10 個機制相似（如 spot_vote vs dot_vote vs multi_vote），實際使用後再決定是否再精簡
4. **未部署**：等使用者明確指示再部署到生產

---

## 預防機制（防止再次失控）

寫入 [ADR-0017](../decisions/0017-loop-mode-safeguards.md) + [CLAUDE.md 紅線 #9-#12](../../CLAUDE.md)：

1. **規則 1**：Loop 模式每 5 輪強制接地驗證
2. **規則 2**：禁止「測試綠 = 進度正常」邏輯
3. **規則 3**：模板化任務紅旗識別（連 3 輪純複製貼上 = 必停）
4. **規則 4**：商業情境強制對照（對應不到五大情境的元件不做）

---

## 相關文件

- [ADR-0017 Loop 模式安全護欄](../decisions/0017-loop-mode-safeguards.md) — 此次事件觸發的決策
- [CLAUDE.md 紅線 #9-#12](../../CLAUDE.md) — 寫入專案紅線
- 之前真實規劃：[ADR-0005 Phase 3 方向](../decisions/0005-phase3-direction.md) / [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md)

---

## 教訓總結

> 「完整完成」≠「持續新增」
>
> 程式碼存在 ≠ 功能可用
>
> Vitest 通過 ≠ e2e 通過
>
> 測試綠 ≠ 進度正常
>
> 接地驗證（admin editor 看得到、玩家玩得到）才是唯一真實。
