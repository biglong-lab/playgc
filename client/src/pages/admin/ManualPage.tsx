// 📖 ManualPage — 後台使用說明手冊頁（含 tab 切換 + markdown 渲染）
// 路由：/admin/manual
//
// 來源：client/public/manual/*.md（部署時 vite 自動帶上、由 docs/manual/ 同步）

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { parseMarkdown } from "@/lib/markdown-mini";

interface ManualSection {
  slug: string;
  filename: string;
  title: string;
  description: string;
  emoji: string;
}

const SECTIONS: ManualSection[] = [
  {
    slug: "readme",
    filename: "README.md",
    title: "主目錄 / 平台速覽",
    description: "平台一句話、三大軸線、5 大市場速查、各角色快速入口",
    emoji: "📖",
  },
  {
    slug: "host",
    filename: "01-host-components.md",
    title: "Host 元件 — 14 個",
    description: "大螢幕主視覺元件群（婚禮、園遊會、頒獎、企業大會）",
    emoji: "📺",
  },
  {
    slug: "multi",
    filename: "02-multi-components.md",
    title: "Multi 元件 — 14 個",
    description: "多人協作 / 對戰元件（街區、企業內訓、員工旅遊、密室）",
    emoji: "👥",
  },
  {
    slug: "scenarios",
    filename: "03-scenario-templates.md",
    title: "情境模板 — 12 個",
    description: "5 大市場全覆蓋、現成可一鍵建場",
    emoji: "🎬",
  },
  {
    slug: "business",
    filename: "04-business-pages.md",
    title: "業務工具頁 — 11 個",
    description: "簡報、找情境、後台、API、ROI 計算等",
    emoji: "🛠️",
  },
  {
    slug: "flow",
    filename: "05-platform-flow.md",
    title: "整體運作流程",
    description: "業務 / 客戶 / admin / 玩家 / 開發者 5 角色動線",
    emoji: "🔄",
  },
];

interface InternalDoc {
  title: string;
  description: string;
  emoji: string;
  audience: string;
}

/** 內部維護的延伸文件清單（純列表、不外連 — 需閱讀請聯絡工程團隊） */
const INTERNAL_DOCS: InternalDoc[] = [
  {
    title: "客戶 onboarding SOP",
    description: "新客戶從接觸到開帳號的完整流程",
    emoji: "🚀",
    audience: "業務 / 客服",
  },
  {
    title: "代理商接入指南",
    description: "API key 申請、環境變數、整合範例",
    emoji: "🔗",
    audience: "技術夥伴 / API 接入方",
  },
  {
    title: "QA 測試確認清單",
    description: "新功能上線前的測試 checklist",
    emoji: "✅",
    audience: "QA / 工程團隊",
  },
  {
    title: "錯誤處理政策（ADR-0016）",
    description: "Stage 1+2+3 錯誤處理體系設計依據",
    emoji: "🛡️",
    audience: "工程團隊內部",
  },
  {
    title: "版本紀錄 CHANGELOG",
    description: "歷次部署紀錄、新功能上線時序",
    emoji: "📋",
    audience: "全員 / 工程",
  },
];

export default function ManualPage() {
  const [activeSlug, setActiveSlug] = useState<string>("readme");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSection = useMemo(() => SECTIONS.find((s) => s.slug === activeSlug)!, [activeSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/manual/${activeSection.filename}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "載入失敗");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const html = useMemo(() => (content ? parseMarkdown(content) : ""), [content]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="manual-back">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回後台
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-amber-600" />
              使用說明手冊
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              平台所有元件、情境、業務工具的完整介紹與使用流程
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {SECTIONS.map((s) => (
            <button
              key={s.slug}
              data-testid={`manual-tab-${s.slug}`}
              onClick={() => setActiveSlug(s.slug)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                activeSlug === s.slug
                  ? "bg-amber-100 dark:bg-amber-900/40 border-amber-500 text-amber-900 dark:text-amber-100"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-amber-300"
              }`}
            >
              <div className="text-2xl mb-1">{s.emoji}</div>
              <div className="font-semibold text-sm">{s.title}</div>
              <div className="text-xs opacity-70 mt-1 line-clamp-2">{s.description}</div>
            </button>
          ))}
        </div>

        {/* Markdown content */}
        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                載入中...
              </div>
            ) : error ? (
              <div className="text-red-600 dark:text-red-400 text-sm">
                ⚠️ 載入失敗：{error}
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  請重新整理頁面、或聯絡工程團隊取得 <code className="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">{activeSection.filename}</code> 內容。
                </p>
              </div>
            ) : (
              <div
                data-testid="manual-content"
                className="prose-mini text-zinc-800 dark:text-zinc-200"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  const link = target.closest("a[data-manual-file]") as HTMLAnchorElement | null;
                  if (!link) return;
                  e.preventDefault();
                  const file = link.dataset.manualFile;
                  if (!file) return;
                  const section = SECTIONS.find((s) => s.filename === file);
                  if (section) {
                    setActiveSlug(section.slug);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </CardContent>
        </Card>

        {/* Internal docs — 純列表、不外連（repo 為 private、避免洩露結構）*/}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-amber-600" />
              延伸文件清單（工程團隊維護）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
              下列文件由工程團隊內部維護、需閱讀請聯絡管理員或工程窗口取得。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {INTERNAL_DOCS.map((doc) => (
                <div
                  key={doc.title}
                  data-testid={`internal-doc-${doc.title}`}
                  className="block p-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{doc.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{doc.title}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        {doc.description}
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        對象：{doc.audience}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer note */}
        <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          💡 <strong>提示</strong>：手冊內容隨平台更新會同步更新。
          需要更新內容、新增文件、或回報手冊錯誤、請聯絡工程團隊。
        </div>
      </div>
    </div>
  );
}
