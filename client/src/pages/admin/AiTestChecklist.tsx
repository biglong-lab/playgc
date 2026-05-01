// 🤖 AI 元件正式上線實機測試清單（admin 內頁）
//
// 路由：/admin/ai-test-checklist
// 用途：發布前複製此清單，逐項打勾驗證 AI 元件
//
// 設計：
//   - 純靜態內容（與 docs/AI_LIVE_TEST_CHECKLIST.md 同步）
//   - admin 可勾選（local state 不存 DB）
//   - 列印友善
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ChecklistItem {
  label: string;
  detail?: string;
}

interface AiTaskCheck {
  emoji: string;
  pageType: string;
  zhName: string;
  rows: { kind: "✅" | "❌" | "⚠️" | "⏱️" | "🔁" | "🌐" | "💰" | "🚨" | "🎨" | "🖼️" | "⚡"; expect: string }[];
}

const PRE_TEST: ChecklistItem[] = [
  { label: "已 commit 所有變更並推到 main" },
  { label: "已部署到生產（https://game.homi.cc）" },
  { label: "場域 settings 已設定有效 API key（OpenRouter / Gemini）" },
  { label: "場域額度充足（OpenRouter > $1 / Vision > 100 次）" },
  { label: "用真實玩家帳號登入（不要用 admin）" },
  { label: "準備測試素材：清晰過關照 / 無關失敗照 / 模糊邊緣案例" },
];

const AI_TASKS: AiTaskCheck[] = [
  {
    emoji: "⚡",
    pageType: "photo_spot",
    zhName: "拍照定點",
    rows: [
      { kind: "✅", expect: "拍對的東西 → AI verified=true，顯示 success 變體" },
      { kind: "❌", expect: "拍無關物件 → verified=false，顯示 fail 變體" },
      { kind: "⚠️", expect: "拍模糊照片 → 合理回饋（不卡住）" },
      { kind: "⏱️", expect: "回應 < 5 秒" },
      { kind: "🔁", expect: "失敗後可重試不卡死" },
      { kind: "🌐", expect: "主模型 fail → fallback chain 接手" },
    ],
  },
  {
    emoji: "📊",
    pageType: "photo_compare",
    zhName: "拍照比對",
    rows: [
      { kind: "✅", expect: "拍與目標相似 → similarity > threshold 過關" },
      { kind: "❌", expect: "拍與目標差異大 → similarity < threshold 失敗" },
      { kind: "⚠️", expect: "拍部分相似（角度不同）→ fuzzy 區間 P13 自適應預期" },
      { kind: "⏱️", expect: "回應 < 8 秒（兩張圖比對較慢）" },
      { kind: "🖼️", expect: "參考照可看見" },
    ],
  },
  {
    emoji: "🪧",
    pageType: "photo_ocr",
    zhName: "招牌辨識（Google Vision）",
    rows: [
      { kind: "✅", expect: "拍清楚招牌 → OCR 命中 targetKeywords" },
      { kind: "❌", expect: "拍無文字物件 → detected=false，顯示 fail" },
      { kind: "⚠️", expect: "拍部分遮蔽 / 反光 → 降級判定（含部分 keyword）" },
      { kind: "⏱️", expect: "Vision API < 4 秒" },
      { kind: "💰", expect: "確認本月用量未超 1000 免費額度" },
      { kind: "🚨", expect: "達 95% 自動切換 fallback" },
    ],
  },
  {
    emoji: "📸",
    pageType: "photo_mission",
    zhName: "拍照任務",
    rows: [
      { kind: "✅", expect: "拍符合 instruction 照片 → verified=true，給分" },
      { kind: "❌", expect: "拍離題照片 → verified=false，顯示提示" },
      { kind: "🎨", expect: "confidence 顯示 0-100% 區間" },
      { kind: "⏱️", expect: "回應 < 5 秒" },
    ],
  },
  {
    emoji: "✏️",
    pageType: "text_verify",
    zhName: "文字驗證",
    rows: [
      { kind: "✅", expect: "完全正確答案 → passed=true" },
      { kind: "✅", expect: "模糊正確（同義詞 / 錯別字）→ AI 語意 passed=true" },
      { kind: "❌", expect: "完全錯誤 → passed=false" },
      { kind: "⚠️", expect: "答錯但接近 → nearMiss 變體訊息（鼓勵）" },
      { kind: "⏱️", expect: "回應 < 3 秒（純文字較快）" },
    ],
  },
  {
    emoji: "☑️",
    pageType: "choice_verify",
    zhName: "選擇題驗證",
    rows: [
      { kind: "✅", expect: "選對 → passed=true，立即成功" },
      { kind: "❌", expect: "選錯 → passed=false，顯示提示" },
      { kind: "🔁", expect: "失敗後選項可再點" },
      { kind: "⚡", expect: "即時 < 1 秒（本地判定無需 AI）" },
    ],
  },
  {
    emoji: "🧩",
    pageType: "conditional_verify",
    zhName: "條件驗證",
    rows: [
      { kind: "✅", expect: "條件滿足 → passed=true，前往下一頁" },
      { kind: "❌", expect: "條件不足 → passed=false，顯示哪個條件未達" },
      { kind: "🔁", expect: "玩家補完後重試可通過" },
    ],
  },
];

const COMMON_CHECKS = [
  { title: "速度 & 穩定性", items: ["沒有 504 / 502 錯誤", "沒有 console.log 紅色 error", "沒有「載入中」轉圈卡 > 30 秒", "退出再進入仍能繼續"] },
  { title: "UX 品質", items: ["success 變體訊息多元（不重複）", "fail 變體訊息鼓勵性", "hint 出現時機合理", "錯誤訊息全中文"] },
  { title: "資料正確性（管理後台確認）", items: ["/platform/ai-center 用量總覽顯示新呼叫", "/admin AI 服務用量數字增加", "ai_usage_logs 有 success=true 紀錄", "player_event_logs 有 page_complete 事件", "variant_feedback 玩家按讚 / 踩有寫入"] },
  { title: "安全 / Fallback", items: ["故意斷網 → 友善錯誤訊息（不白屏）", "OpenRouter 限額 → 自動 fallback 次選模型", "AI timeout → 不卡死可放棄或重試"] },
];

const RED_FLAGS = [
  { metric: "AI 呼叫成功率", redLine: "< 80%", note: "4 月實際 0% 是極端 bug，不能再發生" },
  { metric: "回應速度", redLine: "> 30 秒", note: "玩家會放棄" },
  { metric: "中文化", redLine: "看到 raw error message", note: '如「Internal Server Error」' },
  { metric: "帳號額度", redLine: "用量超 95%", note: "會自動停用" },
];

export default function AiTestChecklist() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ChevronLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          列印
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🤖 AI 元件正式上線實機測試清單
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          每次發布含 AI 元件的遊戲前，務必走過此清單一次。預覽模式 AI 已 mock pass，實際 AI 行為（速度 / 正確率 / 失敗處理）只能在正式環境驗證。
        </p>
      </div>

      {/* 紅燈條件 */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            紅燈項目（任一不過 → 不可上線）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 pr-2">項目</th>
                <th className="pb-2 pr-2">紅燈條件</th>
                <th className="pb-2">說明</th>
              </tr>
            </thead>
            <tbody>
              {RED_FLAGS.map((r) => (
                <tr key={r.metric} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{r.metric}</td>
                  <td className="py-2 pr-2 text-destructive">{r.redLine}</td>
                  <td className="py-2 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 測試前準備 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 測試前準備</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRE_TEST.map((item, i) => (
            <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1" />
              <span>{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* 7 種 AI 任務 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🎯 7 種 AI 任務逐項測試</h2>
        <div className="space-y-4">
          {AI_TASKS.map((task) => (
            <Card key={task.pageType}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-lg">{task.emoji}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {task.pageType}
                  </Badge>
                  {task.zhName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {task.rows.map((r, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" className="mt-0.5" />
                    <span className="font-medium w-6 flex-shrink-0">{r.kind}</span>
                    <span>{r.expect}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 共通確認 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔍 共通確認項目（測完所有任務後）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {COMMON_CHECKS.map((sec) => (
            <div key={sec.title}>
              <h4 className="text-sm font-semibold mb-2">{sec.title}</h4>
              <div className="space-y-1.5 ml-1">
                {sec.items.map((it, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" className="mt-0.5" />
                    <span>{it}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 結尾 */}
      <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300">
        <CardContent className="p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            測試完成後
          </div>
          <ol className="list-decimal list-inside text-xs space-y-1 ml-2">
            <li>到該遊戲編輯器 → 點「<strong>標記已實測</strong>」按鈕</li>
            <li>確認 <code>games.last_live_tested_at</code> 已更新</li>
            <li>有發現 bug → 修復後再走一遍</li>
            <li>全部 ✅ → 點「發布」</li>
          </ol>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setLocation("/admin/games")}>
              返回遊戲列表
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
