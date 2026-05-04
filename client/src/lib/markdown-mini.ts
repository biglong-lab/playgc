// 🔣 markdown-mini — 輕量 markdown → HTML 轉換（不裝 deps、< 200 行）
// 支援：H1-H4、粗體、斜體、inline code、code block、列表、表格、連結、引言、空行段落
// 使用：parseMarkdown(rawString) → htmlString（用於 dangerouslySetInnerHTML）

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 解析 markdown 連結 — 安全策略：
 *  - 純 manual 內 .md filename → 內部 tab 切換
 *  - `../` 跨目錄 .md → plain text（不變超連結，避免洩露 repo 結構或外連 private repo）
 *  - http/https → 維持外連（白名單未實作、由內容把關）
 *  - 錨點 #xxx → 內部錨點
 */
function resolveLink(url: string): { href: string; manualFile?: string; external: boolean; plainText?: boolean } {
  // 1. 完整 URL（http/https）→ 維持外連（內容自身把關不指向 private repo）
  if (/^https?:\/\//.test(url)) {
    // 額外保險：阻擋指向 github.com 的 private repo 連結
    if (/github\.com\/[\w-]+\/[\w-]+/.test(url)) {
      return { href: url, external: false, plainText: true };
    }
    return { href: url, external: true };
  }
  // 2. 錨點（#xxx）→ 內部錨點
  if (url.startsWith("#")) {
    return { href: url, external: false };
  }
  // 3. 純 .md filename（不含 /）→ 內部 manual 切換
  if (/^[^/]+\.md(#.*)?$/.test(url)) {
    const file = url.split("#")[0];
    return { href: "#", manualFile: file, external: false };
  }
  // 4. 含 ../ 或 / 的 .md 連結 → plain text（不可外連 private repo）
  if (url.endsWith(".md") || /\.md#/.test(url)) {
    return { href: "#", external: false, plainText: true };
  }
  // 5. 其他（非 .md、非 http）→ plain text 安全處理
  return { href: "#", external: false, plainText: true };
}

const inlineMarkdown = (s: string): string => {
  // inline code 先處理（不被其他規則影響）
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code class="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-xs">${escapeHtml(code)}</code>`);
  // 粗體
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  // 斜體
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
  // 連結（內部 / 外部 / plain text 三類）
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const { href, manualFile, external, plainText } = resolveLink(url);
    const cls = "text-amber-700 dark:text-amber-400 underline hover:text-amber-900";
    if (manualFile) {
      return `<a href="${escapeHtml(href)}" class="${cls}" data-manual-file="${escapeHtml(manualFile)}">${text}</a>`;
    }
    if (plainText) {
      // 不變超連結、保持原文字（避免外連 private repo / 洩露結構）
      return `<span class="text-zinc-600 dark:text-zinc-400">${text}</span>`;
    }
    if (external) {
      return `<a href="${escapeHtml(href)}" class="${cls}" target="_blank" rel="noreferrer">${text}</a>`;
    }
    return `<a href="${escapeHtml(href)}" class="${cls}">${text}</a>`;
  });
  return s;
};

const parseTable = (lines: string[], startIdx: number): { html: string; consumed: number } => {
  const rows: string[][] = [];
  let i = startIdx;
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
    rows.push(cells);
    i++;
  }
  if (rows.length < 2) return { html: "", consumed: 0 };
  const [header, separator, ...body] = rows;
  // 第二列是 |---|---|
  if (!separator || !separator.every((c) => /^[-:]+$/.test(c))) {
    return { html: "", consumed: 0 };
  }
  const headerHtml = header.map((c) => `<th class="px-3 py-2 text-left font-semibold border-b border-zinc-300 dark:border-zinc-700">${inlineMarkdown(escapeHtml(c))}</th>`).join("");
  const bodyHtml = body
    .map((row) => `<tr>${row.map((c) => `<td class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">${inlineMarkdown(escapeHtml(c))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<div class="overflow-x-auto my-3"><table class="text-sm w-full"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
  return { html, consumed: 2 + body.length };
};

export function parseMarkdown(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let pBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(`<ul class="list-disc list-inside my-2 space-y-1">${listBuffer.map((li) => `<li>${inlineMarkdown(escapeHtml(li))}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };
  const flushParagraph = () => {
    if (pBuffer.length > 0) {
      out.push(`<p class="my-2 leading-relaxed">${inlineMarkdown(escapeHtml(pBuffer.join(" ")))}</p>`);
      pBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // code block
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushList();
        flushParagraph();
        out.push(`<pre class="my-3 p-3 rounded bg-zinc-900 text-zinc-100 text-xs overflow-x-auto"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList();
        flushParagraph();
        inCodeBlock = true;
      }
      i++;
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    // 表格
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      flushList();
      flushParagraph();
      const { html, consumed } = parseTable(lines, i);
      if (consumed > 0) {
        out.push(html);
        i += consumed;
        continue;
      }
    }

    // 標題
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushList();
      flushParagraph();
      const level = headingMatch[1].length;
      const text = inlineMarkdown(escapeHtml(headingMatch[2]));
      const sizes = ["text-3xl mt-6 mb-3", "text-2xl mt-5 mb-3", "text-xl mt-4 mb-2", "text-lg mt-3 mb-2"];
      out.push(`<h${level} class="font-bold ${sizes[level - 1]}">${text}</h${level}>`);
      i++;
      continue;
    }

    // 列表
    const listMatch = /^[-*]\s+(.+)$/.exec(line.trim());
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      i++;
      continue;
    }

    // 引言
    if (line.trim().startsWith("> ")) {
      flushList();
      flushParagraph();
      out.push(`<blockquote class="border-l-4 border-amber-400 pl-3 my-2 italic text-zinc-700 dark:text-zinc-300">${inlineMarkdown(escapeHtml(line.trim().slice(2)))}</blockquote>`);
      i++;
      continue;
    }

    // 分隔線
    if (/^---+$/.test(line.trim())) {
      flushList();
      flushParagraph();
      out.push(`<hr class="my-4 border-zinc-300 dark:border-zinc-700" />`);
      i++;
      continue;
    }

    // 空行
    if (line.trim() === "") {
      flushList();
      flushParagraph();
      i++;
      continue;
    }

    // 一般段落
    flushList();
    pBuffer.push(line);
    i++;
  }

  flushList();
  flushParagraph();

  return out.join("\n");
}
