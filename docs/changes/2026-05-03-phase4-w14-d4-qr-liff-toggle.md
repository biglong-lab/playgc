# Phase 4 W14 D4 — QR 列印頁加 LIFF URL 切換

**日期**：2026-05-03
**範圍**：W14 D4、ScenarioQrPrint URL 模式切換
**狀態**：🟢 W14 D4 完成、admin 可選 一般網頁 / LINE LIFF QR

---

## 🎯 目標達成

> Phase 4 W14 D1-D3 完成 LIFF SDK + /play 整合 + useMyUserName hook
> W14 D4 補上「列印 QR 時可選 LIFF URL」 — admin 可一鍵切換

---

## 📦 改動

### 1. `client/src/pages/ScenarioQrPrint.tsx`

**新增 state**：
```ts
type UrlMode = "web" | "liff";
const [urlMode, setUrlMode] = useState<UrlMode>(...);  // 預設讀 localStorage
```

**新增 helper**：
```ts
function maybeLiffify(playUrl: string, mode: UrlMode): string {
  if (mode !== "liff") return playUrl;
  return playUrl.replace(/^\/play\//, "/liff/play/");
}
```

**Toolbar UI 切換器**（桌面版顯示）：
- 🌐 一般網頁（預設、白底）
- 💚 LINE（綠色、強調）

**處理規則**：
- 大螢幕 QR：永遠用一般 URL（LIFF 不適合 host）
- 玩家 QR：依模式切換
- multi/solo gameUrl：永遠用一般 URL（W14 D5 後續可考慮 LIFF）

**狀態保留**：
- localStorage `chitoQrUrlMode` 記住選擇
- 切換時自動重新生成 QR

### 2. UI 提示

LIFF 模式啟用時 toolbar 下方顯示：
> 💚 LINE 模式：玩家 QR 改為 LIFF URL（玩家從 LINE 點開、自動帶名字）

---

## 💡 設計決策

### 為何只切換玩家 QR？

選擇：大螢幕用一般 / 玩家可選 LIFF

理由：
- 大螢幕需要桌機瀏覽器 + hostToken（LIFF 不支援）
- 玩家手機 LIFF 體驗最佳（不離開 LINE）
- 不混淆：admin 知道大螢幕永遠是一般網頁

### 為何用 localStorage 記住選擇？

選擇：cache 用戶偏好

理由：
- admin 通常一個 venue 統一用一種模式
- 不每次重設
- 不影響其他 admin（local-only）

### 為何 multi/solo gameUrl 不切換？

選擇：暫不支援

理由：
- gameUrl 用 publicSlug（`/g/<slug>`）走既有 game player 流程
- LIFF 整合需要更多工作（HostPlay 是 host 元件特化）
- W14 D5 後可評估是否整合

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 41/41

---

## ⏭ 下一步：W14 D5

- W14 D5：W14 完整收尾 + W15 LINE Bot 規劃

---

## 🔗 相關文件

- [W14 D3 useMyUserName hook](2026-05-03-phase4-w14-d3-username-hook.md)
- [W14 D2 LINE profile 整合](2026-05-03-phase4-w14-d2-line-profile-integration.md)
- [W14 D1 LIFF MVP](2026-05-03-phase4-w14-d1-liff-mvp.md)
