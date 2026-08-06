// 📜 全站宣告 footer — 五份文件連結（CHITO c45e8915）
// 掛在公開頁面底部；緊湊單列、不干擾主要內容。
import { Link } from "wouter";

const LINKS = [
  { href: "/legal/terms", label: "使用條款" },
  { href: "/legal/privacy", label: "隱私權政策" },
  { href: "/legal/disclaimer", label: "免責聲明" },
  { href: "/legal/risk", label: "活動風險" },
  { href: "/legal/copyright", label: "版權聲明" },
];

export default function LegalFooter() {
  return (
    <footer className="py-6 px-4 text-center" data-testid="legal-footer">
      <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground/70">
        {LINKS.map((l, i) => (
          <span key={l.href} className="flex items-center gap-3">
            <Link href={l.href} className="hover:text-foreground hover:underline">
              {l.label}
            </Link>
            {i < LINKS.length - 1 && <span aria-hidden>·</span>}
          </span>
        ))}
      </nav>
      <p className="mt-2 text-[10px] text-muted-foreground/50">
        © {new Date().getFullYear()} 大哉實業有限公司
      </p>
    </footer>
  );
}
