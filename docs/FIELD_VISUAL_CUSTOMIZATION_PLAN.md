# 🎨 場域視覺客製化系統規劃

> **需求來源**：2026-04-23 使用者請求
> **目標**：讓每個場域（如賈村、后浦小鎮）有獨立視覺風格，超級管理員可在場域間搬移遊戲
> **參考**：myarts 名片（可套樣式），但更簡單（遊戲為主，不放大量資訊）

---

## 一、需求拆解

| 需求 | 說明 | 優先級 |
|------|------|--------|
| 多場域建立 | 可開立 `賈村`、`后浦小鎮` 等平行場域 | ✅ 已完成（schema 已有 fields 表） |
| 遊戲搬移 | super_admin 可把遊戲從 A 場域移到 B 場域 | 🟡 Phase 1 |
| 主題色系 | 每場域有自己的 primary/accent/背景色 | 🟡 Phase 1 |
| 版面模組 | 可切換 3–5 種排版模板（如 classic / card / fullscreen） | 🟢 Phase 2 |
| 底圖上傳 | 每場域可上傳 1 張大圖當 hero/背景 | 🟢 Phase 2 |
| 管理端預覽 | 設定當下即看到效果（類 myarts） | 🟢 Phase 2 |

---

## 二、資料模型

### 2.1 不破壞 schema — 全部放進 `fields.settings` jsonb

`fields.settings.theme` 新增物件：

```ts
interface FieldTheme {
  /** 主題預設配色（省略則用系統預設） */
  colorScheme?: "dark" | "light" | "custom";
  /** 主色（hex，如 #f97316） */
  primaryColor?: string;
  /** 輔色 */
  accentColor?: string;
  /** 背景色 / 漸層 */
  backgroundColor?: string;
  /** 版面模板 id */
  layoutTemplate?: "classic" | "card" | "fullscreen" | "minimal";
  /** 場域封面圖片（hero/登入頁/遊戲列表頂部） */
  coverImageUrl?: string;
  /** 場域 Logo（覆蓋原 logoUrl，顯示於 header 左上） */
  brandingLogoUrl?: string;
  /** 文字調色（選用） */
  textColor?: string;
  /** 字體風格 */
  fontFamily?: "default" | "serif" | "mono" | "display";
}
```

### 2.2 不新增資料表

所有主題欄位都用 `fields.settings.theme` 儲存，新增欄位時不用 migration。
原有 `settings.primaryColor` 保留（向後相容），但推薦改用 `settings.theme.primaryColor`。

---

## 三、API 設計

### 3.1 GET /api/fields/:code/theme（公開）
**用途**：玩家端登入場域後拿到該場域的主題設定，套到 CSS variables

**回傳**：
```json
{
  "fieldId": "abc",
  "code": "JIACHUN",
  "name": "賈村",
  "theme": {
    "primaryColor": "#f97316",
    "accentColor": "#06b6d4",
    "layoutTemplate": "classic",
    "coverImageUrl": "https://...",
    "brandingLogoUrl": "https://..."
  }
}
```

### 3.2 PATCH /api/admin/fields/:id/theme（admin）
**權限**：field:manage（任何 admin 可改自己場域；super_admin 可改任意）
**用途**：更新主題設定，與 `/settings` 類似但專注於視覺

### 3.3 POST /api/admin/games/:id/move-field（super_admin ONLY）
**用途**：super_admin 將遊戲從 A 場域搬到 B 場域
**body**：`{ targetFieldId: string }`
**效果**：
- 更新 `games.fieldId`
- 審計 log
- 不影響現有 sessions / 玩家紀錄

---

## 四、前端實作

### 4.1 Theme Provider

`client/src/providers/FieldThemeProvider.tsx`（新增）：

```tsx
export function FieldThemeProvider({ children }: { children: ReactNode }) {
  const { data: theme } = useQuery({
    queryKey: ["/api/fields/current/theme"],
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.primaryColor) root.style.setProperty("--primary", theme.primaryColor);
    if (theme.accentColor) root.style.setProperty("--accent", theme.accentColor);
    if (theme.backgroundColor) root.style.setProperty("--background", theme.backgroundColor);
    if (theme.textColor) root.style.setProperty("--foreground", theme.textColor);
    // layoutTemplate 透過 body class 控制
    document.body.dataset.layout = theme.layoutTemplate || "classic";
  }, [theme]);

  return <>{children}</>;
}
```

放在 `App.tsx` 的根元件外層。

### 4.2 Layout 模板

`client/src/layouts/` 下加：
- `ClassicLayout.tsx` — 目前的樣式（header + cards）
- `CardLayout.tsx` — 大尺寸卡片堆疊，滑動瀏覽
- `FullscreenLayout.tsx` — 每個遊戲滿版、滑動切換
- `MinimalLayout.tsx` — 純 list、單色、極簡

切換由 `document.body.dataset.layout` 決定（CSS `[data-layout="card"] .game-list { ... }`）。

### 4.3 管理端設定頁 `/admin/field-theme`

結構：
```
┌─────────────────┬─────────────────────────────┐
│  左側控制面板    │      右側即時預覽            │
│  - 顏色選擇器   │  ┌─────────────────────┐   │
│  - 版面選擇     │  │  [模擬遊戲列表]      │   │
│  - 底圖上傳     │  │  ...                 │   │
│  - 字體選擇     │  └─────────────────────┘   │
│  [儲存]          │                              │
└─────────────────┴─────────────────────────────┘
```

用 `<iframe>` 或 React portal 渲染預覽，套用即時主題。

### 4.4 super_admin 移動遊戲 UI

在 `AdminGames.tsx`（遊戲管理頁）加按鈕：
- 只有 `systemRole === "super_admin"` 看得到
- 點擊後跳 Dialog：選擇目標場域下拉 → 確認 → `POST /api/admin/games/:id/move-field`

---

## 五、實作順序

### Phase 1（最小可用）— 預估 1–2 天
1. ✅ 擴充 `FieldSettings.theme` 介面（shared/schema/fields.ts）
2. ⬜ 擴充 `PATCH /api/admin/fields/:id/settings` 支援 theme 欄位
3. ⬜ 新增 `GET /api/fields/:code/theme` 公開端點
4. ⬜ 新增 `POST /api/admin/games/:id/move-field`（super_admin）
5. ⬜ 玩家端加 `FieldThemeProvider` 套 CSS 變數
6. ⬜ 管理端 `AdminFieldTheme.tsx` 基本表單（顏色選擇器 + 儲存）

### Phase 2（增強）— 預估 2–3 天
1. ⬜ 版面模板 4 種 + `data-layout` CSS 切換
2. ⬜ 底圖 / Logo 上傳（cloudinary）
3. ⬜ 字體切換
4. ⬜ 管理端即時預覽（右側 iframe / portal）
5. ⬜ 遊戲移動 UI（AdminGames 加按鈕 + Dialog）

### Phase 3（未來）— 預估 1–2 天
1. ⬜ 更多主題模板預設（5 套預設配色可一鍵套用）
2. ⬜ 場域 SEO 設定（每場域獨立 OG tags）
3. ⬜ 場域自訂登入背景
4. ⬜ 場域自訂歡迎訊息 / 公告

---

## 六、安全與一致性注意

1. **權限控制**
   - 一般 admin 只能改自己場域的主題
   - super_admin 才能改任意場域 + 移動遊戲
   - 遊戲移動必須寫 audit log

2. **XSS 防護**
   - 主題欄位（color / url）都要驗證格式
   - `primaryColor` 必須符合 hex 格式 `/^#[0-9a-f]{6}$/i`
   - `coverImageUrl` 必須是 https cloudinary URL

3. **玩家端 fallback**
   - 沒有主題設定時用系統預設（不要白屏）
   - coverImageUrl 失敗不要阻擋頁面渲染
   - 主題 API 失敗 → 用 localStorage 快取的上次主題

4. **效能**
   - `GET /api/fields/:code/theme` 快取 5 分鐘（客戶端）
   - server 端可加 Redis 快取

5. **相容性**
   - 原有 `settings.primaryColor` 保留，讀取時優先用 `settings.theme.primaryColor`，fallback 到 `settings.primaryColor`

---

## 七、參考 myarts 的簡化

myarts 名片有的功能 | 本系統要簡化為
--- | ---
多區塊可自由排列（Experience / Projects / Links） | 固定「Hero → 遊戲列表」兩區塊
每區塊樣式可獨立調 | 全場域統一主題
社群連結 / QR / 聯絡資訊 | 可選「場域公告」一區即可
動態色彩 / 漸層 | 單色 + 輔色即可（簡單好看）
字體工具庫 | 4 個預設字體風格

**核心哲學**：讓管理員花 < 5 分鐘就能改完，不用學設計。

---

## 八、開放問題（下次跟使用者確認）

1. 底圖要強制幾個尺寸規格？（建議 1920x1080，hero 用）
2. 是否允許 admin 自訂 CSS（進階模式）？（建議暫不開放，避免壞頁面）
3. 是否要場域層級的「推薦遊戲」/「置頂遊戲」功能？
4. 遊戲搬移後，原場域的該遊戲 sessions 是否保留顯示？（建議：保留，只改 fieldId）

---

**下一步行動**：實作 Phase 1 的 1、2、3（schema 擴充 + API），前端 UI 留待 Phase 1 後半段。
