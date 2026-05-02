// ❓ FAQ — 公開常見問題頁（W17 D2）
//
// 路徑：/faq
// 用途：客戶 self-service 看常見問題、業務介紹時可給連結
//
// 內容對齊 docs/runbooks/customer-pilot.md 的 FAQ 區段
// 但加 8 個問題（業務 + 工程角度補完整）

import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft, MessageCircle } from "lucide-react";

interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  // 活動規模
  {
    category: "活動規模",
    question: "最低活動人數是多少？",
    answer:
      "建議 ≥ 10 人才有趣。host_polaroid_collage / host_emoji_react 等元件都需要群眾感。" +
      "10 人以下建議用 single 軸線元件（如 trivia_showdown 個人答題、jigsaw_puzzle 個人解謎）。",
  },
  {
    category: "活動規模",
    question: "最多支援多少人同時上線？",
    answer:
      "預設一場 maxPlayers=100 人。實測 200+ 人同時連線無壓力。" +
      "超大型（500+）可委辦方案、會做專屬伺服器配置。",
  },

  // 玩家體驗
  {
    category: "玩家體驗",
    question: "玩家需要安裝 App 嗎？",
    answer:
      "不用。掃 QR 在瀏覽器即玩。" +
      "LINE 用戶可選擇 LIFF 模式（自動帶入 LINE 名字、體驗更順、不必再輸入名字）。",
  },
  {
    category: "玩家體驗",
    question: "玩家手機版本要求？",
    answer:
      "Safari 14+ / Chrome 90+ / Edge 90+（過去 3 年的手機都支援）。" +
      "iPhone 7 以後 / 大部分 Android 7+ 都可以。",
  },

  // 資料保留
  {
    category: "資料保留",
    question: "活動結束後資料會保留多久？",
    answer:
      "host session 12 小時 token 過期、但活動內容（玩家照片 / 留言 / 簽名）會視方案保留：\n" +
      "• 一次性方案：活動結束後寄打包檔給客戶（保留 7 天）\n" +
      "• 訂閱方案：永久雲端保存、隨時可下載\n" +
      "• 委辦方案：含完整數位資產交付",
  },
  {
    category: "資料保留",
    question: "玩家照片 / 簽名可以下載嗎？",
    answer:
      "可以。活動結束後 admin 可從後台下載完整資料包（含照片高清原檔 + JSON 元數據）。" +
      "婚禮 / 同學會等情境特別好用、可作為紀念冊素材。",
  },

  // 連線問題
  {
    category: "連線問題",
    question: "活動中有玩家連不上怎麼辦？",
    answer:
      "1. 確認 wifi / 4G 訊號（多數情況）\n" +
      "2. 玩家手機重新掃 QR（hostToken 12h 內都有效）\n" +
      "3. admin 用 LINE「@chito 我的活動」確認 session 還 active\n" +
      "4. 仍無法 → 業務 / 工程立即遠端 join 排查",
  },
  {
    category: "連線問題",
    question: "現場 wifi 不穩定能用嗎？",
    answer:
      "可以。設計時已考慮：\n" +
      "• 玩家端用 4G / 5G 也能玩（每場流量約 10MB）\n" +
      "• 大螢幕端如連不上、回 hostUrl 重新整理即可\n" +
      "• WebSocket 斷線會自動重連（最多 3 次重試）",
  },

  // 客製化
  {
    category: "客製化",
    question: "可以換 logo / 顏色嗎？",
    answer:
      "視方案：\n" +
      "• 一次性方案：default 設計（不含客製）\n" +
      "• 訂閱方案：含基本客製（logo + 主色）\n" +
      "• 委辦方案：完整客製（含設計師參與）",
  },
  {
    category: "客製化",
    question: "可以新增自己的題目 / 內容嗎？",
    answer:
      "可以。admin 後台可編輯：\n" +
      "• 投票題目（host_poll_live）\n" +
      "• 搶答題庫（host_trivia_showdown）\n" +
      "• 拼圖內容（jigsaw_puzzle）\n" +
      "• 角色設定（role_assign）\n" +
      "等所有內容欄位。也可用 AI（DeepSeek）一鍵生成符合主題的內容。",
  },

  // 收費
  {
    category: "收費",
    question: "三方案有什麼不同？",
    answer:
      "• 一次性 NT$3K-30K：單次活動、12h hostToken、適合婚禮 / 同學會\n" +
      "• 訂閱 NT$1.5K-5K/月：無限建場、含客服、適合月活動 ≥ 3 場\n" +
      "• 委辦 NT$80K-200K：業務全包 + 設計 + 拍攝、適合大型活動 / 客製化需求",
  },
  {
    category: "收費",
    question: "可以先試用嗎？",
    answer:
      "可以！我們有：\n" +
      "• 公開 demo：[/showcase](/showcase) 看所有元件實際操作\n" +
      "• 免費 pilot：聯繫業務、第一場可優惠 50% 試水溫\n" +
      "• 試用期：訂閱方案首月免費（活動 ≤ 1 場）",
  },

  // 技術整合
  {
    category: "技術整合",
    question: "代理商可以介接 API 嗎？",
    answer:
      "可以。我們有完整 Public API（OpenAPI 3.1）：\n" +
      "• REST API + TypeScript SDK\n" +
      "• Webhook 雙向（HMAC SHA-256 簽章）\n" +
      "• Rate limit 60 req/min\n" +
      "見 [API 文件](/api-docs) 或聯繫業務取得 API key。",
  },
  {
    category: "技術整合",
    question: "可以 LINE 整合嗎？",
    answer:
      "可以。我們的 LINE Bot 支援：\n" +
      "• 玩家端：LINE LIFF 自動進入遊戲\n" +
      "• admin 端：@chito 自然語言建場（30 秒內收到網址）\n" +
      "• 系統推播：活動即將過期 / 客戶 webhook 自動派發",
  },
];

const CATEGORIES = Array.from(new Set(FAQ_ITEMS.map((item) => item.category)));

export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              首頁
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            常見問題
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">客戶最常問的問題</h2>
          <p className="text-slate-600">
            找不到答案？聯繫業務：
            <Link href="/pitch" className="text-blue-600 hover:underline ml-1">
              查看簡報
            </Link>
            或
            <Link href="/find-scenario" className="text-blue-600 hover:underline ml-1">
              客製建議
            </Link>
          </p>
        </div>

        {/* 分類顯示 */}
        {CATEGORIES.map((category) => (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-bold text-slate-700 mb-3 border-l-4 border-blue-500 pl-3">
              {category}
            </h3>
            <div className="space-y-2">
              {FAQ_ITEMS.filter((item) => item.category === category).map((item) => {
                const idx = FAQ_ITEMS.indexOf(item);
                const isOpen = openIdx === idx;
                return (
                  <Card
                    key={idx}
                    className={`transition-all cursor-pointer hover:shadow-md ${isOpen ? "ring-2 ring-blue-300" : ""}`}
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    data-testid={`faq-item-${idx}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-slate-900">
                          Q. {item.question}
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 mt-0.5 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      {isOpen && (
                        <div className="mt-3 pt-3 border-t text-slate-700 whitespace-pre-line">
                          {item.answer}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {/* 還沒解答？ */}
        <Card className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold mb-2">還沒解答？</h3>
            <p className="text-slate-600 mb-4">
              聯繫業務、或先看完整介紹簡報
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/pitch">
                <Button>查看完整簡報</Button>
              </Link>
              <Link href="/find-scenario">
                <Button variant="outline">三問配對情境</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline">查看價格</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
