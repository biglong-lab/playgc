# 🎮 遊戲元件全面元件化升級規劃

> **目標**：每個元件更完整、更方便使用，全部可從後台設定（零硬編寫）
> **原則**：管理員在 UI 上能完成的事，絕不讓他輸 UUID / 整數 ID / 元件名
> **日期**：2026-04-22
> **來源**：4 個併行 Explore agent 盤點 16 個元件的現況

---

## 📊 16 個元件現況總評

| # | 元件 | 完整度 | 主要缺口 | 優先級 |
|---|------|--------|---------|--------|
| 1 | text_card（字卡） | 95% | 無後台預覽 | P2 |
| 2 | dialogue（對話） | 90% | 情緒頭像 raw URL，無上傳 | **P1** |
| 3 | video（影片） | 100% | — | ✅ |
| 4 | button（按鈕選擇） | 95% | **icon 欄位 raw input**，需 picker | **P1** |
| 5 | text_verify（文字驗證） | 75% | 缺 nextPageId 分支、無驗證模式切換 | **P1** |
| 6 | choice_verify（選擇驗證） | 85% | 缺「多選/部分分數」開關、legacy 模式無分支 | **P1** |
| 7 | conditional_verify（條件驗證） | 95% | Fragment 無拖曳排序、無成功/失敗分支 | P2 |
| 8 | lock（密碼鎖） | 90% | instruction 欄位缺 UI、lockType 切換 placeholder 不變 | P2 |
| 9 | shooting_mission（射擊任務） | 70% | **deviceId 無 DeviceSelect** | **P0** |
| 10 | photo_mission（拍照任務） | 75% | AI 模型選擇 UI、信心閾值滑塊 | **P1** |
| 11 | gps_mission（GPS 任務） | 95% | 可加快速 Location 引用 | P2 |
| 12 | qr_scan（QR 掃描） | 95% | 可加快速 Location 引用 | P2 |
| 13 | time_bomb（倒數） | 85% | 多階段倒數、task 拖曳 | P2 |
| 14 | motion_challenge（體感） | 90% | 桌機模擬、權限重試 | P2 |
| 15 | vote（投票） | 92% | teamMode 語意化、多選 | P2 |
| 16 | flow_router（流程路由） | **65%** 🔴 | **無 Condition Builder UI、無測試工具** | **P0** |

---

## 🔥 跨元件共性缺口（原因級）

1. **❌ 後台預覽**：幾乎所有元件都缺，管理員只能進玩家端實測
2. **❌ 共用 IconPicker**：button、任何圖示欄位還是 raw input
3. **❌ DeviceSelect**：ShootingMission 的 deviceId 自由輸入無法跨遊戲複用
4. **❌ nextPageId 分支粒度**：Legacy ChoiceVerify、ConditionalVerify 的成功/失敗分支無 UI
5. **🟡 MediaUploadButton 未普及**：Dialogue 情緒頭像還是貼 URL
6. **🔴 FlowRouter condition 完全用 JSON 式**：需要圖形化

---

## 🎯 分階段實作規劃

### Phase 1（P0 — 本輪立刻做，3 項）
最高影響、無法從後台完成的硬傷：

#### **1.1 FlowRouter Condition Builder 圖形化（🔴 最急）**
- 新增元件 `ConditionBuilder.tsx`：每條條件用 Card 卡片，人類語言展示
  - 例：「當 [玩家分數] [大於等於] [100] 時，跳到 [進階關卡]」
- 支援 9 種條件類型（variable_equals、has_item、location_visited、score_gte 等）
- 支援條件分組（AND / OR 視覺化）
- **Condition Tester**：輸入假設變數值 → 即時顯示「會路由到哪頁」
- 隨機路由加權重視覺化（小餅圖）

#### **1.2 ShootingMission `deviceId` DeviceSelect**
- 新增 `client/src/components/shared/DeviceSelect.tsx`
- 查詢 `/api/admin/devices?fieldId=...`，列出該場域已註冊的 Arduino/MQTT 裝置
- 允許「無指定（任何裝置）」或「指定 deviceId」
- 若 schema 沒有 devices 表，補上最小可用版（id, fieldId, name, type, isActive）

#### **1.3 共用元件：IconPicker**
- 新增 `client/src/components/shared/IconPicker.tsx`
- 列出常用 Lucide icons（約 30-40 個），有搜尋 + 預覽
- 分類：動作（Sword、Bow）、情感（Heart、Star）、物件（Key、Gem、Scroll）、其他
- 替換：ButtonConfigEditor 的 button.icon、（未來）Achievement icon、Item icon

---

### Phase 2（P1 — 下一輪，5 項）
功能補強，讓管理員不再需要技術背景：

#### **2.1 ChoiceVerify 補齊**
- Quiz 編輯器加 **「允許複選」** 開關（對應 schema `multiple`）
- 加 **「部分分數」** 開關（partialCredit：半對給 50% 分數）
- Legacy 模式每選項獨立 **nextPageId Select**（讓管理員做「選對/選錯各走不同路」）
- 每題獎勵 `rewardPerQuestion` UI

#### **2.2 TextVerify 補齊**
- 加驗證模式 Select（精確 / 忽略大小寫 / 包含匹配 / Regex）
- 加獨立 **nextPageId 分支**（答對/答錯各跳不同頁）

#### **2.3 PhotoMission AI 設定進化**
- **AI 模型選擇 dropdown**（Gemini flash / OpenRouter 常用模型），顯示每款定價
- **信心閾值用 Slider**（0.0-1.0，每 0.05 遞增，右側文字顯示「嚴格/普通/寬鬆」）
- 「AI 測試」按鈕：用當前設定上傳一張範例照片預覽結果

#### **2.4 Dialogue 情緒頭像改為 MediaUploadButton**
- neutral/happy/angry/surprised/sad/thinking 六個頭像欄位都用 MediaUploadButton
- 移除 raw URL Input

#### **2.5 Button icon 改用 IconPicker**
- 用 1.3 產出的 IconPicker 替換 ButtonConfigEditor 的 icon 欄位

---

### Phase 3（P2 — 之後再做，8 項）
體驗增強、生產力工具：

#### **3.1 通用後台預覽 Drawer**
- 新增 `PagePreviewDrawer`：管理員按「預覽此頁」→ 右側滑出模擬玩家端
- 支援所有 16 種 pageType（用 GamePageRenderer 包裝，mock session/state）
- 重要：不用開新頁，不用實機，不用登出

#### **3.2 ConditionalVerify 補齊**
- Fragment 清單拖曳排序（框架有 Reorder.Group）
- 成功 / 失敗分支 `successNextPageId` / `failureNextPageId` UI

#### **3.3 Lock 小改**
- 補 `instruction` 欄位 UI
- `lockType` 切換時 `combination` placeholder 自動變（「1234」/「ABCD」）
- 鎖類型預覽示意圖

#### **3.4 TimeBomb 進階**
- Per-task 時間限制欄位
- Task 拖曳排序

#### **3.5 MotionChallenge 便利性**
- 編輯器加「桌機模擬」按鈕（開發測試用）
- 感測器權限被拒絕時，提示重試或自動降級到下一個可用 challenge

#### **3.6 Vote 進階**
- Schema 加 `teamMode: 'consensus' | 'individual'` 欄位（語意更清楚）
- UI 加 Tooltip 說明兩種策略
- 支援 `multipleChoice`（複選投票）

#### **3.7 GPS / QR 快速引用 Location**
- 編輯器加「從現有 Location 引用」按鈕 → 跳出 LocationSelect
- 選定後自動填入 lat/lng/qrCodeData

#### **3.8 共用 PageSelect 元件**
- 目前很多地方各自實作 nextPageId dropdown
- 抽出 `client/src/components/shared/PageSelect.tsx`
- 支援「無（依預設順序）」、「結束遊戲」、「指定頁面」
- 列出頁面時顯示「#3 · 選擇驗證」或 customName

---

## 🏗 底層共用工具需求（全部 Phase 會用到）

| 元件 | 用途 | 狀態 |
|------|------|------|
| `ItemSelect` / `ItemMultiSelect` | 道具選擇 | ✅ 已有 |
| `LocationSelect` | 地點選擇 | ✅ 已有 |
| `AchievementSelect` | 成就選擇 | ✅ 已有 |
| `PageSelect` | 頁面選擇（nextPageId） | 🔴 未有，Phase 3 產 |
| `ChapterSelect` | 章節選擇 | 🔴 未有 |
| `IconPicker` | Lucide 圖示選擇 | 🔴 未有，Phase 1 產 |
| `DeviceSelect` | 硬體裝置選擇 | 🔴 未有，Phase 1 產 |
| `ConditionBuilder` | FlowRouter 條件構建 | 🔴 未有，Phase 1 產 |
| `MediaUploadButton` | 媒體上傳 | ✅ 已有（PageConfigEditor 內） |
| `PagePreviewDrawer` | 後台預覽 | 🔴 未有，Phase 3 產 |

---

## 📏 完工判準（Definition of Done）

### 每個元件上線前必須符合：
- [ ] 管理端 editor 覆蓋所有 config 欄位
- [ ] 無 raw Input for 任何「會引用其他 entity」的欄位
- [ ] 玩家端對所有 config 分支有正確處理 / graceful degradation
- [ ] `getDefaultConfig(pageType)` 回傳合理預設值
- [ ] TypeScript 零錯誤
- [ ] 本地 build 通過
- [ ] 部署後 health check 通過

### 全專案級：
- [ ] 零 `<Input placeholder="locationId">` / 類似 raw ID input
- [ ] 所有 editor 都導入 common Select 元件
- [ ] 後台預覽 Drawer 至少支援 P0/P1 元件

---

## 🚀 本輪（Phase 1）立刻開工順序

1. **IconPicker**（獨立共用元件，其他 Phase 都會用）→ 建一個
2. **ButtonConfigEditor** 的 icon 欄位改用 IconPicker（即時 ROI）
3. **DeviceSelect**（同 items slug pattern，用 game/field 層級 API）
4. **ShootingMission** 的 deviceId 改用 DeviceSelect
5. **ConditionBuilder**（FlowRouter 圖形化，最複雜但最值得）
6. **FlowRouterEditor** 整合 ConditionBuilder + Condition Tester

預估工作量：5-8 次 /loop 迭代。每次一個子項，build + deploy + verify。
