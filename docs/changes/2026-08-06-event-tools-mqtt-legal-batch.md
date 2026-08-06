# 活動工具全面優化 + CHITO 批次修復 + MQTT 收整 — 2026-08-05 ~ 08-06

> 範圍：CHITO 9 張 open 中的 8 張、活動元件編輯器、MQTT 軟體側收整、五宣告頁
> 狀態：🟢 已部署 `5704dbbc`（bundle `index-C9RViYT8`）；六張 CHITO 轉待測試
> 前情：[2026-08-05 團隊重連修復](2026-08-05-team-rejoin-fix.md)、[ADR-0025 穩定性根因盤點](../decisions/0025-stability-root-cause-review.md)

---

## 一、CHITO 批次成果總表

| Issue | 標題 | 累計修次 | 真根因（前面沒人找到的） | 狀態 |
|---|---|---|---|---|
| `790b1c33` | 詞雲卡「請先設定玩家名稱」 | 1 | 名稱只有 LIFF 動線會寫入；掃 QR 動線**沒有任何設定 UI** → HostPlay 名稱閘門 | 🧪 測試中 |
| `c1149bc8` | 道具無效卻 +10 分 | 10 | **前 9 次修 code 沒人修 data**：舊編輯器烙進 DB 的 `rewardPoints:10` 還在（只清回報者遊戲 5 頁，其他遊戲有 8/4/5/20 手動值不可動） | 🧪 測試中 |
| `f095652b` | 進度回退/跳通關 | 13 | server 揀選其實已對（6 案例固定測試證明）；client 是一整**類** remount race → 頁索引護欄「只進不退」 | 🧪 測試中 |
| `f825215e` | 碎片收集被改壞 | 1 | **編輯器開頁即自動生成 fragments** 劫持舊條件頁（阿榮 1.0 十個道具條件全死）→ 三層修：編輯器不再開頁改寫＋runtime 防禦＋資料剝除 | 🧪 測試中 |
| `c92e32dc` | GPS 指向反向 | 13 | 換算與公式**全部正確**；「右轉箭頭左移」是世界錨定的正確行為，缺參照系 → 羅盤刻度環（N 可自驗）＋文字指令 | 🧪 測試中 |
| `c609d0c3` | 活動元件設置半成品 | 2 | 17 個 host 元件在編輯器全掉 default 分支＝唯讀 JSON → schema 驅動編輯器 | 🧪 測試中 |
| `c45e8915` | 免責聲明五宣告 | 2 | — → `/legal` 五分頁 + LegalFooter | 🧪 測試中 |
| `1bc34792` | AR WEBP 錄影靜態 | 5 | 前 3 修用 ImageDecoder，**iOS Safari 不支援**而複測全在 iPhone → Cloudinary `f_mp4` + `<video>` 幀源全平台通解 | 🧪 測試中 |
| `c0428790` | 後端 MQTT | 2 | 軟體鏈已全驗證（見下）；剩硬體端 | 🔒 硬體阻塞 |

### 三個「修最多次」問題的病理（回應業主「沒對症下藥」質疑）

```
道具 +10（9→10 修）   修 code 不修 data
進度回退（10→13 修）  堵觸發點不堵「類」
GPS 反向（11→13 修）  在修本來就正確的東西（缺參照系，翻號才會真的錯）
```

---

## 二、活動元件編輯器（本批最大塊）

- 新檔 `client/src/pages/game-editor/HostComponentEditor.tsx`（400 行）
- **HOST_FIELD_SCHEMAS**：17 型別欄位定義表 + 通用表單產生器
  - 欄位種類：text / textarea / number / boolean / string-list / object-list
  - object-list 支援 `toRow/fromRow`（搶答題 options 陣列 + 0-based correctIdx ↔ 表格「選項1-4＋正解1-4」，含夾範圍防壞資料）
  - 清單可增刪、上下排序
- 接點：`PageConfigEditor.tsx` default 分支前攔截
- **之後新增活動元件：只要在 HOST_FIELD_SCHEMAS 加一段定義**
- 測試：`__tests__/HostComponentEditor.test.tsx` 8 例，含「17 型別覆蓋完整性，少一個就紅」

## 三、MQTT 收整

- **單一總表**：[docs/domains/mqtt-devices.md](../domains/mqtt-devices.md) —— 下次 MQTT 討論先讀這裡
- **模擬設備全鏈測試**：`server/__tests__/mqtt-ingest-chain.test.ts` 10 例（真 DB、免 broker 免硬體）
  - 契約（⚠️ `schemaVersion` 是**數字 1** 不是 "v1"）、跨場域拒收、QoS1 去重、租約歸屬、伺服器計分、HMAC 強制
  - **硬體實測當天若不通 = 問題必在韌體/網路層**
- 接線卡補 §08 HMAC：**韌體就緒才發密鑰**（提前發會讓連通測試全被拒收）
- ADR 撞號修正：穩定性盤點 0024 → 0025

### ⚠️ 部署後發現：gateway 靜默狀態（下一輪首要）

重啟 30+ 分鐘**既無「已連線」也無「連線錯誤」log**。
推斷：`mqtt-client.ts` 的 `close` 事件（無 error 的連線失敗，如 connack timeout）
只 `scheduleReconnect()` 不留 log → **靜默重連迴圈無從察覺**。
待辦：close/reconnect 事件補 log + `/api/admin/mqtt/broker-config` 的
`status.connected` 加進管理介面實測；並查 HiveMQ Cloud 憑證是否仍有效。

## 四、其他

- `/legal` 五宣告頁（使用條款/隱私/免責/活動風險/版權）+ `LegalFooter`（已掛 template-market）
  - ⚠️ 業主正式對外前請複核措辭
- AR 貼圖 iOS 通解：`animatedSticker.ts` 無 ImageDecoder 時走 Cloudinary `f_mp4` → 隱藏 `<video>`（muted+playsInline+crossOrigin）當幀源；`drawArFrame.ts` 尺寸取法相容 video
- 詞雲真互動 e2e：`e2e/host-wordcloud-interaction.spec.ts`
  - 鷹架要點：假大螢幕必須「收 pulse → 聚合 → **回播完整 state**」（四欄位缺一玩家端 render 會炸）
  - 架構事實：**大螢幕沒開時玩家端計數/上限不會動**

## 五、驗證與部署

- 全套 3380 tests / 236 檔綠、tsc 零錯誤、lint 熱點零 error
- 部署 `5704dbbc`：commit+bundle 內外一致、安全 headers 6/6、六個關鍵路由 200
- 生產資料修正（即時生效、有備份）：阿榮 2.0 道具分數歸零 ×5 頁、阿榮 1.0 碎片頁剝除注入欄位

## 六、接續開發指引（下一輪從這裡開始）

1. **MQTT gateway 靜默狀態**（上述 ⚠️）—— 補 close log + 實測 broker 連通
2. **等測試員回報** 六張測試中的卡；GPS 與 AR **務必 iPhone 實機**
3. `device_commands` 帳本表（「已發送≠已執行」）—— 規格在 7/22 計畫 §5.2
4. 活動元件「即時預覽」（原 Phase 1 規劃項，未做）
5. LegalFooter 擴掛其他公開頁（目前只有 template-market）
6. template-market 通盤盤點的 Phase 2-4（容量壓測 host 房型、join 無上限限流）尚未做 —— 見對話規劃
7. 殭屍隊伍會再生：`npm run health:data` 定期跑

## 相關檔案速查

```
活動元件編輯器  client/src/pages/game-editor/HostComponentEditor.tsx
MQTT 總表       docs/domains/mqtt-devices.md
MQTT 全鏈測試   server/__tests__/mqtt-ingest-chain.test.ts
接線卡          docs/hardware-onboarding-card.md（§08 HMAC）
宣告頁          client/src/pages/LegalPage.tsx + components/LegalFooter.tsx
CHITO 寫回      https://plan.aihomi.cc/api/debug/ai/{token}/issues（memory 有用法）
```
