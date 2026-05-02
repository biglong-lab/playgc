# Phase 4 W14 完整收尾 — LINE LIFF 整合上線

**期間**：2026-05-03（W14 連續推進）
**範圍**：Phase 4 W14 D1-D5
**狀態**：🟢 W14 全部完成、玩家可從 LINE 直接玩、不離開 LINE app

---

## 🎯 W14 整體目標達成

> Phase 4 W13 業務工作（找客戶）— 暫無條件做
> W14 主軸：LINE LIFF 整合（玩家不離開 LINE）
>
> 技術成果：完整 LIFF 玩家入口、自動帶 LINE 名字、QR 列印支援 LIFF URL
> 業務成果：玩家門檻降到最低（不用註冊、不開瀏覽器）

---

## 📅 5 天時序

### W14 D1（commit `aee902a7`）— LIFF SDK + PlayLiff 中繼頁
- `client/src/lib/liff.ts` LIFF SDK wrapper（lazy load CDN）
- `client/src/pages/PlayLiff.tsx` LIFF 玩家中繼頁
- App.tsx /liff/play/:sessionId 路由
- smoke test 40 → 41

### W14 D2（commit `d6b3b19c`）— /play LINE profile 整合
- HostPlay useLineProfileFromQuery hook
- 讀 query → 存 localStorage chitoUserName
- Header 顯示「👋 {LINE 名字}」
- HostPageRenderer 加 myUserName prop

### W14 D3（commit `409b4c2c`）— useMyUserName hook + 4 Page 元件
- 新 hook：URL query > localStorage > "" 三層優先序
- 跨 tab 同步（storage event）
- 4 Page 元件整合：Polaroid / Guestbook / Trivia / KnowledgeMap
- Pattern：`lineName || useAuth user || "匿名"`

### W14 D4（commit `3a771976`）— QR 列印頁 LIFF URL 切換
- ScenarioQrPrint urlMode: "web" | "liff"
- Toolbar UI 切換器（🌐 一般 / 💚 LINE）
- maybeLiffify() helper
- 大螢幕 QR 永遠用一般 URL（hostToken 需要）

### W14 D5（本次）— W14 收尾 + W15 規劃
- W14 完整收尾（本檔）
- ADR-0010 LINE Bot 規劃

---

## 📊 W14 累積成果

### 程式碼貢獻
| 階段 | 檔案 | 行數 |
|------|------|------|
| W14 D1 | 6 | ~435 |
| W14 D2 | 4 | ~160 |
| W14 D3 | 7 | ~217 |
| W14 D4 | 3 | ~187 |
| W14 D5 | 3 | ~400 |
| **總** | **23** | **~1,400** |

### 新檔案
- `client/src/lib/liff.ts`
- `client/src/pages/PlayLiff.tsx`
- `client/src/hooks/useMyUserName.ts`

### 改造檔案
- `client/src/pages/HostPlay.tsx`（query reader）
- `client/src/components/game/host/HostPageRenderer.tsx`（myUserName prop）
- `client/src/components/game/host/PolaroidCollagePage.tsx`
- `client/src/components/game/host/GuestbookDigitalPage.tsx`
- `client/src/components/game/host/TriviaShowdownPage.tsx`
- `client/src/components/game/host/KnowledgeMapPage.tsx`
- `client/src/pages/ScenarioQrPrint.tsx`（URL mode toggle）

### Smoke test
**41/41 全綠**（W14 加 1 個 /liff/play 守衛）

---

## 🛠 環境變數（前端）

| 變數 | 說明 |
|------|------|
| `VITE_LIFF_ID_PLAY` | 玩家 LIFF ID（LINE 後台申請）|

未設 → PlayLiff fallback 到 `/play/:sessionId`

---

## 💼 完整玩家旅程

```
方式 1：admin 用「💚 LINE」模式列印 QR
  ↓
玩家從 LINE 訊息點 https://game.homi.cc/liff/play/abc123
  ↓ LIFF SDK
LINE 自動登入 → 取 displayName + userId
  ↓
跳轉 /play/abc123?line_display_name=Hung
  ↓ useMyUserName() hook
存 localStorage chitoUserName = "Hung"
  ↓
HostPlay header 顯示「👋 Hung」
  ↓
4 個 host Page 元件全部用「Hung」當作者
  ↓
玩家在拍立得牆 / 簽名簿 / 搶答 / 場域地圖直接互動
（不需手動輸入名字、不需註冊、不離開 LINE）
```

---

## ⏭ Phase 4 W15 規劃（LINE Bot）

詳見 [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)。

W15 路徑（候選）：
- D1 LINE Bot scaffold（Webhook receiver + reply）
- D2 訊息 → 建場 trigger（`@chito 婚禮`）
- D3 推播：活動結束自動發 LINE 訊息
- D4 報名管理（活動前 1 天通知）
- D5 W15 收尾

---

## 🔗 W14 文件索引

### W14 五天 changes
- [W14 D1 LIFF MVP](2026-05-03-phase4-w14-d1-liff-mvp.md)
- [W14 D2 LINE profile 整合](2026-05-03-phase4-w14-d2-line-profile-integration.md)
- [W14 D3 useMyUserName hook](2026-05-03-phase4-w14-d3-username-hook.md)
- [W14 D4 QR LIFF 切換](2026-05-03-phase4-w14-d4-qr-liff-toggle.md)
- [W14 完整收尾（本檔）](2026-05-03-phase4-w14-complete.md)

### Phase 4 規劃
- [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md)
- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)

### LIFF 文件
- [LINE LIFF 官方文件](https://developers.line.biz/en/docs/liff/)
