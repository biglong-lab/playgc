// 🔣 markdown-mini — 輕量 markdown → HTML 轉換（不裝 deps、< 200 行）
// 支援：H1-H4、粗體、斜體、inline code、code block、列表、表格、連結、引言、空行段落
// 使用：parseMarkdown(rawString) → htmlString（用於 dangerouslySetInnerHTML）

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inlineMarkdown = (s: string): string => {
  // inline code 先處理（不被其他規則影響）
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code class="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-xs">${escapeHtml(code)}</code>`);
  // 粗體
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  // 斜體
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
  // 連結
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => `<a href="${escapeHtml(url)}" class="text-amber-700 dark:text-amber-400 underline hover:text-amber-900" target="_blank" rel="noreferrer">${text}</a>`,
  );
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
