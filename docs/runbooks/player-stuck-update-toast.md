# Runbook: 玩家卡在「有新版本可用」toast

> 適用：客戶 / 玩家回報「按 N 次都還在跳新版本提示」
> 狀態：2026-05-07 已修、新版 client 不會再發生
> 影響：舊版 client（VITE_APP_COMMIT="unknown"）使用者

---

## 症狀

- 「有新版本可用 🎉」toast 跳出來
- 按「立即更新」→ 頁面 reload → toast 又跳
- 按 5 次、10 次、N 次都一樣
- 按 X 關掉、過幾秒又跳

---

## 根因

歷史 deploy 中有幾次漏帶 `GIT_SHA` build arg，導致那一版的 client bundle 烙印 `VITE_APP_COMMIT="unknown"`。

舊版邏輯有兩個 bug：
1. `main.tsx` 的 commit check 看到 `"unknown"` 直接 return → 不會自動 reload
2. `AppUpdateChecker` 用 HTML bundle hash 比對 → 但 SW 攔截 fetch 後，DOM 上 script src 跟 SW cache 中的 HTML hash 永遠 mismatch → 永遠跳 toast、按了沒用

---

## 救援步驟（給玩家 / 客戶）

### 路徑 A：完全退出瀏覽器（最簡單，多數有效）

| 平台 | 步驟 |
|------|------|
| iPhone/iPad Safari | App switcher（從底部上滑停留）→ 把 Safari 卡片往上滑掉 → 等 30 秒 → 重新打開 |
| Android Chrome | 最近 app（方塊鍵）→ 把 Chrome 滑掉 → 等 30 秒 → 重新打開 |
| Mac Safari | ⌘Q 完全退出 → 等 30 秒 → 重新打開 |
| Windows Chrome | 右上 ⋮ → 結束 → 工作管理員確認 chrome.exe 沒了 → 重新打開 |

90% 的使用者這樣就解決了。

### 路徑 B：無痕 / 私密模式測試（驗證新邏輯有效）

| 平台 | 步驟 |
|------|------|
| iPhone Safari | 標籤頁 → 左下「私密」→ 在那裡開 game.homi.cc |
| Android Chrome | ⋮ → 新增無痕分頁 |
| Mac Safari | 檔案 → 新增私密視窗 |
| Chrome | ⋮ → 新增無痕視窗 |

無痕視窗看不到 toast = 新邏輯部署成功了。請使用者照路徑 A 或路徑 C 救一般瀏覽器。

### 路徑 C：清網站資料（路徑 A 失敗時用，100% 有效）

#### iPhone Safari

```
設定 → Safari → 進階 → 網站資料 → 編輯 → 刪除 game.homi.cc
重新打開 game.homi.cc
```

#### Mac Safari

```
Safari → 設定 → 隱私 → 管理網站資料 → 找 homi.cc → 移除
重新打開 game.homi.cc
```

#### Chrome（Mac/Win/Android）

```
設定 → 隱私權與安全性 → 清除瀏覽資料
時間範圍：所有時間
✅ Cookie 和其他網站資料
✅ 快取的圖片和檔案
（其他不要勾，避免清掉其他網站登入）
→ 清除資料
重新打開 game.homi.cc
```

#### 已加到主畫面的 PWA（iOS）

PWA 走獨立 process、cache 比較黏。最快：
1. 長按 PWA icon → 移除 App
2. 重新打開 game.homi.cc → 加入主畫面

### 路徑 D：開發者工具強制清（給技術人員）

```
1. F12 開 DevTools
2. Application tab → Service Workers → 找 game.homi.cc → Unregister
3. Application tab → Storage → Clear site data
4. F5 重整
```

---

## 防止再發生（已做、2026-05-07）

### 工程修補

1. **`main.tsx` 強化**：CLIENT_COMMIT="unknown" 時也檢查；server commit 是真實 hash 就視為版本不符、自動 reload（不再卡死）
2. **`AppUpdateChecker` 重寫**：改用 `/api/version` commit 比對（不受 SW HTML cache 影響）；加 1 小時冷卻 + 3 次 retry 上限
3. **`deploy.md` 必做**：每次部署必須 `export GIT_SHA=$(git rev-parse HEAD)`、否則 `/api/version` 回 "unknown"、版本檢查失效

### 部署檢查（每次必做）

```bash
# 部署完跑這條，確認沒有回 "unknown"
curl -s https://game.homi.cc/api/version
# 預期：{"commit":"<真實 hash>",...}
```

---

## 客服回應模板

> 抱歉造成困擾！這是舊版瀏覽器 cache 的問題，新版本已經修好。
>
> 麻煩您**完全關閉瀏覽器**（不只是關 tab、要從手機背景滑掉、桌面 ⌘Q），等 30 秒再打開 game.homi.cc，應該就會自動更新到新版。
>
> 如果還是跳，請設定 Safari → 進階 → 網站資料 → 刪掉 game.homi.cc 那筆，再重開即可。

---

## 相關文件

- [decisions/0017+ AppUpdateChecker 重寫]（待補 ADR）
- [runbooks/deploy.md](deploy.md) — GIT_SHA 注入紅線
