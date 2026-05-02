# ADR-0007: 信件服務選用 Resend

> 日期：2026-05-02
> 狀態：採用中（Phase 3 W10 D5 啟動整合）
> 影響：所有外發信件（付費通知 / 活動回顧 / 業務 onboarding）
> 文件：[https://resend.com/docs](https://resend.com/docs)

---

## 背景

平台需要外發信件多種場景：

1. **付費成功通知**（Recur.tw webhook 後）
2. **訂閱續訂提醒**（每月扣款前 3 天）
3. **活動回顧寄送**（活動結束後彙整 polaroid / guestbook 內容）
4. **業務 onboarding 自動化**（客戶註冊 → 寄歡迎信）
5. **電子發票寄送**（Recur.tw 已含、但複雜情境可能需另發）

既有平台是否已有信件機制？需先盤點。

---

## 既有 SMTP 方案盤點

未發現既有 SMTP 整合。

---

## 選項評估

### 選項 A：Resend（推薦）

**優點**：
- 開發者體驗最佳（API 簡潔、文件清晰）
- React Email 模板（可用 JSX 寫信件）
- 100 封/日 免費（適合 MVP）
- $20/月可發 50,000 封（活動規模可擴展）
- 含 webhook（送達率 / 開信率追蹤）
- DNS 設定簡單（DKIM / SPF）

**缺點**：
- 美國公司、結算 USD（小費用）
- 中文支援需注意編碼（UTF-8 確認）
- 退信處理機制需自建

### 選項 B：SendGrid

**優點**：
- 業界標準、文件最多
- 100 封/日 免費

**缺點**：
- API 較繁雜（v3 design 老）
- 中文模板不友善
- 抽成較貴（10K 封要 $19.95）

### 選項 C：AWS SES

**優點**：
- 最便宜（每 1000 封 $0.10）
- AWS 生態系整合

**缺點**：
- 設定複雜（需 IAM / SES verification）
- 不適合 MVP 階段

### 選項 D：自架 SMTP

**優點**：
- 抽成 0%

**缺點**：
- 退信率高（沒信譽）
- DKIM / SPF / DMARC 自設
- 不適合 MVP

### 選項 E：Postmark

**優點**：
- transactional email 專精
- 送達率高

**缺點**：
- 比 Resend 貴
- 沒 React Email

---

## 決定

**Resend**

---

## 理由（≤ 5 點）

1. **DX 最佳**：API 簡單、JSX 模板、減少新功能開發成本

2. **MVP 友善**：100 封/日 免費、足夠 W10-W12 驗證 PMF

3. **整合簡單**：純 fetch API、不需裝 SDK（與既有 stripe-checkout.ts 風格一致）

4. **可擴展**：$20/月 50K 封、足以支撐 1000 場活動回顧

5. **不卡 vendor lock-in**：未來需要時可改 Postmark / SES（API 都標準化）

---

## 整合計畫（W10 D5）

### 程式碼

新增 `server/lib/resend-mailer.ts`：
```ts
export async function sendEmail({
  to, subject, html, from = "noreply@homi.cc"
}: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) throw new Error(`Resend API error: ${res.status}`);
}
```

### 信件模板（JSX 推薦）

```tsx
// emails/PaymentSuccessEmail.tsx
export function PaymentSuccessEmail({ scenarioName, amount, instances }) {
  return (
    <div>
      <h1>付款成功 ✅</h1>
      <p>感謝您購買 {scenarioName}</p>
      <p>金額：NT$ {amount}</p>
      ...
    </div>
  );
}
```

### 環境變數

| 變數 | 說明 |
|------|------|
| `RESEND_API_KEY` | re_xxxxx |
| `EMAIL_FROM_DOMAIN` | homi.cc |

---

## 影響

### 程式碼面
- W10 D5 新建 `server/lib/resend-mailer.ts`
- 信件模板放 `server/emails/*.tsx`（W10 D5 後可考慮 React Email）
- payments.ts webhook 觸發 sendEmail

### 紅線
- 信件失敗不阻擋付費流程（async fire-and-forget）
- 信件含敏感連結 → 用一次性 token（不直接放 hostUrl）
- 退信 / spam 投訴 → 監控 Resend dashboard

### 已知限制
- 100 封/日 免費上限（規模超過需升級）
- DNS 設定首次 onboarding 需 1-2 天
- 中文發信主旨 / 內文要 UTF-8 確認

---

## 後續可能變動

- 若 100 封/日 不夠 → 升級 $20/月或改 SES
- 若退信率 > 5% → 改 Postmark
- 若需要 SMS / Push → 加 Twilio / Firebase

---

## 相關文件

- [Resend 文件](https://resend.com/docs)
- [ADR-0006 付費機制（Recur.tw）](0006-payment-system.md)
- [Phase 3 W10 規劃](../changes/2026-05-02-phase3-w9-complete.md#phase-3-w10-規劃付費機制)
