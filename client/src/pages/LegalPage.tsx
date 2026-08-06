// 📜 平台宣告頁 — 五份法律／政策文件（CHITO c45e8915）
//
// 路由：/legal/:section?（terms / privacy / disclaimer / risk / copyright）
// 內容為平台營運通用版本；正式對外前建議由業主複核措辭。
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
  { id: "terms", title: "使用條款" },
  { id: "privacy", title: "隱私權政策" },
  { id: "disclaimer", title: "免責聲明" },
  { id: "risk", title: "活動風險告知" },
  { id: "copyright", title: "版權聲明" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const CONTENT: Record<SectionId, { title: string; body: string[] }> = {
  terms: {
    title: "使用條款",
    body: [
      "歡迎使用本平台（下稱「本服務」）。本服務由大哉實業有限公司（下稱「本公司」）營運，當您註冊、登入或以任何方式使用本服務，即表示您已閱讀、理解並同意本條款之全部內容。",
      "一、帳號與使用：您應確保註冊資料真實正確，並妥善保管帳號。因帳號遭冒用所生之損害，本公司於法令許可範圍內不負賠償責任，但將協助處理。",
      "二、使用規範：您不得利用本服務從事違法行為、干擾系統運作（包括嘗試未經授權之存取、灌入異常流量）、或以自動化程式蒐集他人資料。",
      "三、服務變更：本公司得視營運需要新增、調整或終止部分服務功能；重大變更將以平台公告方式通知。",
      "四、條款修訂：本條款修訂後公告於本頁即生效力，您於修訂後繼續使用本服務視為同意修訂內容。",
    ],
  },
  privacy: {
    title: "隱私權政策",
    body: [
      "本公司重視您的隱私，依個人資料保護法及相關法令蒐集、處理及利用您的個人資料。",
      "一、蒐集項目：帳號資訊（電子郵件、暱稱、第三方登入識別碼）、遊戲歷程（成績、進度、互動紀錄）、活動照片（您主動上傳者）、裝置與定位資訊（僅於 GPS 類任務且經您授權時）。",
      "二、利用目的：提供遊戲與活動服務、成績統計與排行、活動紀念內容產出、服務改善與問題排除。",
      "三、保存與安全：資料儲存於本公司管理之伺服器，採取存取控制、傳輸加密等合理安全措施。",
      "四、您的權利：您得依法請求查詢、閱覽、補充、更正或刪除您的個人資料，請透過場域主辦單位或本公司聯繫窗口提出。",
      "五、第三方服務：本服務使用之登入（如 LINE、Google）、圖片儲存等第三方服務，其資料處理依各該服務之隱私政策辦理。",
    ],
  },
  disclaimer: {
    title: "免責聲明",
    body: [
      "一、本服務以「現狀」提供，本公司不保證服務不中斷、無錯誤或完全符合特定需求；因網路、裝置、天候或不可抗力造成之服務中斷或資料延遲，本公司於法令許可範圍內不負賠償責任。",
      "二、遊戲內容（含關卡文案、歷史敘事）部分為創作性質，可能與史實或現況有所出入，僅供活動體驗參考。",
      "三、活動成績、排名與獎勵之最終解釋權歸各場域主辦單位；如有爭議，以主辦單位現場公告為準。",
      "四、使用者於平台上傳或發布之內容（照片、留言、暱稱等）由使用者自行負責；如有侵權或不當內容，本公司得逕行移除。",
    ],
  },
  risk: {
    title: "活動風險告知",
    body: [
      "參加實體場域活動（含戶外尋寶、GPS 任務、射擊體驗、水彈對戰等）前，請詳閱並確認以下事項：",
      "一、戶外活動存在天候變化、地面濕滑、蚊蟲等自然風險，請視自身健康狀況斟酌參加，並遵循現場工作人員指示。",
      "二、行進間請勿緊盯手機螢幕，注意人車與周遭環境安全；未成年參加者應由監護人陪同。",
      "三、射擊、水彈等體驗活動請務必配戴主辦單位提供之防護裝備，並遵守安全守則；未遵守致生事故者，責任由行為人自負。",
      "四、身體不適（含心血管疾病、孕期等）者，請於報名前主動告知主辦單位評估適宜性。",
      "五、活動中如遇緊急狀況，請立即通知現場工作人員或撥打 119。",
    ],
  },
  copyright: {
    title: "版權聲明",
    body: [
      "一、本平台之程式、介面設計、遊戲關卡內容、圖像與文字（除使用者上傳內容及另有標示者外）著作權均屬大哉實業有限公司或其授權人所有。",
      "二、未經書面同意，不得重製、改作、散布或以其他方式利用本平台內容於商業用途。",
      "三、使用者上傳之照片與文字，著作權仍屬使用者；使用者同意授權本公司及活動主辦單位於活動紀錄、成果展示範圍內無償利用。",
      "四、本平台使用之第三方開源套件與素材，依各該授權條款辦理。",
      `© ${new Date().getFullYear()} 大哉實業有限公司 版權所有`,
    ],
  },
};

export default function LegalPage() {
  const params = useParams<{ section?: string }>();
  const [, setLocation] = useLocation();
  const active: SectionId = (SECTIONS.find((s) => s.id === params.section)?.id ?? "terms");
  const content = CONTENT[active];

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-3xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            aria-label="返回"
            data-testid="legal-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">平台宣告</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* 分頁列 */}
        <nav className="flex flex-wrap gap-2" aria-label="宣告分類">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={`/legal/${s.id}`}>
              <Button
                variant={active === s.id ? "default" : "outline"}
                size="sm"
                data-testid={`legal-tab-${s.id}`}
              >
                {s.title}
              </Button>
            </Link>
          ))}
        </nav>

        <article className="space-y-4" data-testid={`legal-content-${active}`}>
          <h2 className="text-xl font-bold">{content.title}</h2>
          {content.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
          <p className="text-xs text-muted-foreground/70 pt-4 border-t">
            最後更新：2026-08-06 · 如有疑問請洽各場域主辦單位
          </p>
        </article>
      </main>
    </div>
  );
}
