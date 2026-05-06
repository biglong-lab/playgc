# 三條路線架構

> 建立日期：2026-05-07
> 狀態：穩定（基於 ADR-0004）
> 此文件解釋系統的三條互動路線、認證模型、元件歸屬，避免規劃時混淆。

---

## 為什麼需要這份

過去多次規劃發生「把 A 路線元件塞進 B 路線容器」的設計衝突，原因是缺乏清晰的路線對照表。本文件作為架構單一真實來源（SoT），所有未來規劃必先對照此文件。

---

## 三條路線總覽

```
┌──────────────────────────────────────────────────────────────────┐
│ 路線 I — 手機遊戲（傳統 game）                                      │
├──────────────────────────────────────────────────────────────────┤
│ 入口：/f/:fieldCode/game/:gameId[/chapters/:chapterId]              │
│ 元件：solo（18）+ multi（13）+ shared（4）                           │
│ 認證：✅ 必須 Firebase + 隊伍                                        │
│ 結構：game = 多 page 闖關 / 章節分支                                  │
│ 玩法：個人闖關 / 隊伍協作 / 副本腳本（未來）                            │
│ 持久化：完整（player_progress / squad / 隊伍狀態）                     │
│ 持續：長（30+ 分鐘）                                                 │
│ 商業：賈村風遊戲、未來副本、長時間沉浸                                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 路線 II — 活動現場玩家手機端（HostPlay）                              │
├──────────────────────────────────────────────────────────────────┤
│ 入口：/play/:sessionId                                              │
│ 元件：host（17）的玩家互動端 + shared                                 │
│ 認證：❌ 可匿名（不強制登入）                                          │
│ 結構：對應 host 大螢幕、用 host_screen_pulse 互動                     │
│ 玩法：投票 / 舉手 / emoji / 簽到 / 答題                                │
│ 持久化：弱（session 級別、活動結束釋放）                                │
│ 持續：短（5-10 分鐘 per 互動）                                         │
│ 商業：婚禮、破冰、頒獎、現場活動                                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 路線 III — 活動現場大螢幕（HostScreen）                               │
├──────────────────────────────────────────────────────────────────┤
│ 入口：/host/:sessionId?token=xxx                                    │
│ 元件：host（17）的大螢幕呈現端（同路線 II）                            │
│ 認證：🔑 hostToken（admin 簽發、12 小時）                              │
│ 結構：唯讀展示、單向廣播、自動全螢幕                                   │
│ 用途：投影機 / 電視 / 現場大螢幕                                      │
│ 持續：跟路線 II 同 session                                            │
└──────────────────────────────────────────────────────────────────┘

註：路線 II + III 是同一 host_session 的兩端、配對使用
```

---

## 三軸元件分類（ADR-0004）

| 軸 | 數量 | 認證 | 路線歸屬 | 範例 |
|----|------|------|---------|------|
| **solo** | 18 | Firebase 必須 | 路線 I | shooting_mission, gps_mission, choice_verify |
| **multi** | 13 | Firebase + 隊伍必須 | 路線 I | lock_coop, relay_mission, vote_team |
| **host** | 17 | 玩家匿名 / 大螢幕 token | 路線 II + III | host_poll_live, host_emoji_react, host_polaroid_collage |
| **shared** | 4 | 通用 | 任何路線 | text_card, dialogue, video, flow_router |

---

## 商業流向 → 路線對應

| 商業情境 | 主要路線 | 為什麼 |
|---------|---------|--------|
| 賈村冒險（戰鬥/解謎/探索）| I | 個人/隊伍闖關、需要持續身份 |
| 婚禮現場互動 | II + III | 賓客掃 QR 不該卡登入、大螢幕同步 |
| 破冰活動 | II + III | 同上、輕量互動 |
| 頒獎典禮 | II + III | 同上、即時投票 + 排行榜 |
| 工作坊敏捷回顧 | I | 持久化重要、組隊討論 |
| 內訓開場（簽到/破冰段）| II + III | 不該強制登入 |
| 內訓主流程（任務/協作）| I | 組隊持久化 |
| 場域導覽（GPS 巡禮）| I | 個人闖關、持久化重要 |

---

## Templates 機制對照

| | PAGE_TEMPLATES | SCENARIO_TEMPLATES |
|--|---------------|-------------------|
| 用途 | 一鍵插入頁面到當前 game | 一鍵建多個 game + session |
| 入口 | game editor 內 ToolboxSidebar | /admin/scenarios |
| 對應路線 | I（編輯單一 game）| 主要 II/III、少量 I |
| 數量 | 5 個（intro_sequence 等賈村風）| 12 個（婚禮/生日/破冰...）|
| 客戶 use case | 自由建單一 game | 一鍵部署整場活動 |

---

## 既有混亂與已採取的修正

### 混亂 1（已修：2026-05-07）：admin editor 看不到 host 元件
**現況**：codebase 有 17 個 host 元件、admin editor PAGE_TYPES 只有 1 個（host_word_cloud）
**影響**：admin 想自由建含 host 元件的 game 時、99% 選不到 → SCENARIO_TEMPLATES 只能用 91% multi 元件
**修正**：補接 16 個 host_* 到 PAGE_TYPES + getDefaultConfig + 加 PageCategory 第 6 類「host_screen 📺」（commit `66170476`）

### 混亂 2（已紀錄、待修）：SCENARIO_TEMPLATES 內含路線錯置
**現況**：12 情境包共用元件 multi 437 個 + host 44 個 + shared 1 個
**影響**：「破冰包」91% 元件要登入、跟「現場活動不該登入」本意違背
**修正方向**：未來重組情境包為「路線 I 版」+「路線 II/III 版」（依客戶需求拆分）

### 混亂 3（已修紀錄）：A2 多人元件 L3 持久化驗證
**現況**：next-action-guide 寫的「L0/L1→L3 升級」實為 2026-05-05 已完成
**修正**：補 e2e + 實機 checklist（commit `3535976a`）
**詳情** → [docs/changes/2026-05-07-a2-l3-validation.md](../changes/2026-05-07-a2-l3-validation.md)

---

## 規劃新元件 / 新 templates 必先對照

依紅線 #11「新元件必須對應五大商業情境之一」，本文件擴充為：

### 新元件 checklist
- [ ] 對應五大商業情境之一（公部門 / 私部門 / 活動 / 空間 / 交誼）
- [ ] 確認屬於哪一軸（solo / multi / host / shared）
- [ ] 確認對應的路線（I / II+III / 通用）
- [ ] 確認認證需求（要登入嗎？要組隊嗎？）
- [ ] 列入 PAGE_TYPES + getDefaultConfig + HostPageRenderer（如為 host）/ GamePageRenderer（如為 solo/multi）

### 新 templates checklist
- [ ] 是「插入式段落」（PAGE_TEMPLATES）或「整場部署」（SCENARIO_TEMPLATES）
- [ ] 對應路線是哪條
- [ ] 元件組成：路線 I 比例 vs 路線 II/III 比例（避免錯置）
- [ ] 客戶使用情境真實存在（不是「為了豐富度」加的）

---

## 相關文件

- [ADR-0004 HostScreen 第三軸線](../decisions/0004-host-screen-axis.md)
- [ADR-0017 Loop 護欄](../decisions/0017-loop-mode-safeguards.md)
- [host + multi 配對 spec](../domains/host-multi-pairing.md)
- [Phase 1 D3 元件分類](../changes/2026-05-07-phase-1-complete.md)
- [A2 L3 驗證紀錄](../changes/2026-05-07-a2-l3-validation.md)
- [本次補接 host 元件](../changes/2026-05-07-host-component-admin-integration.md)
