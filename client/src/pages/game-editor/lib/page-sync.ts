// 頁面同步邏輯 - 處理頁面 CRUD 與伺服器同步
import { apiRequest } from "@/lib/queryClient";
import type { Page } from "@shared/schema";

/** 更新頁面 ID 參照（如按鈕跳轉目標），處理 temp ID → 真實 ID 的映射 */
export function updatePageIdReferences(
  pagesToUpdate: Page[],
  idMapping: Map<string, string>
): Page[] {
  return pagesToUpdate.map((page) => {
    const config = page.config as Record<string, unknown>;
    if (page.pageType === "button" && config.buttons) {
      const buttons = config.buttons as Array<Record<string, unknown>>;
      const updatedButtons = buttons.map((btn) => ({
        ...btn,
        nextPageId:
          btn.nextPageId && idMapping.has(btn.nextPageId as string)
            ? idMapping.get(btn.nextPageId as string)
            : btn.nextPageId,
      }));
      return { ...page, config: { ...config, buttons: updatedButtons } };
    }
    return page;
  });
}

interface SyncPagesOptions {
  apiGamesPath: string;
  apiPagesPath: string;
}

/**
 * 同步頁面到伺服器
 * 比對本地與遠端頁面，進行新增/更新/刪除
 */
export async function syncPages(
  targetGameId: string,
  currentPages: Page[],
  serverPages: Page[],
  options: SyncPagesOptions
): Promise<Page[]> {
  const { apiGamesPath, apiPagesPath } = options;
  const tempIdMapping = new Map<string, string>();
  const serverPageIds = new Set(serverPages.map((p) => p.id));
  const currentPageIds = new Set(currentPages.map((p) => p.id));

  const pagesToCreate = currentPages.filter((p) => p.id.startsWith("temp-"));
  const pagesToUpdate = currentPages.filter(
    (p) => !p.id.startsWith("temp-") && serverPageIds.has(p.id)
  );
  const pagesToDelete = serverPages.filter((p) => !currentPageIds.has(p.id));

  // 刪除遠端已移除的頁面
  for (const page of pagesToDelete) {
    await apiRequest("DELETE", `${apiPagesPath}/${page.id}`);
  }

  // 建立新頁面
  const createdPages: Page[] = [];
  for (const page of pagesToCreate) {
    const tempId = page.id;
    const response = await apiRequest(
      "POST",
      `${apiGamesPath}/${targetGameId}/pages`,
      {
        pageType: page.pageType,
        pageOrder: page.pageOrder,
        config: page.config,
      }
    );
    const createdPage = await response.json();
    tempIdMapping.set(tempId, createdPage.id);
    createdPages.push(createdPage);
  }

  // 合併並更新 ID 參照
  let allPages = [
    ...currentPages.filter((p) => !p.id.startsWith("temp-")),
    ...createdPages,
  ];
  allPages = updatePageIdReferences(allPages, tempIdMapping);

  // 更新既有頁面
  for (const page of pagesToUpdate) {
    const updatedConfig =
      allPages.find((p) => p.id === page.id)?.config || page.config;
    await apiRequest("PATCH", `${apiPagesPath}/${page.id}`, {
      pageType: page.pageType,
      pageOrder: page.pageOrder,
      config: updatedConfig,
    });
  }

  // 更新新建頁面的參照
  for (const page of createdPages) {
    const updatedPage = allPages.find((p) => p.id === page.id);
    if (updatedPage) {
      await apiRequest("PATCH", `${apiPagesPath}/${page.id}`, {
        config: updatedPage.config,
      });
    }
  }

  return allPages;
}
