// 🚪 預約入口（智能路由）— 2026-05-18
//
// 路徑：/book/:fieldCode
// 邏輯：
//   - 場域有 ≥1 個啟用中活動 → 顯示活動列表（BookActivitiesPage）
//   - 場域沒有活動 → fallback 到既有單一預約頁（BookPage）
//
// 向下相容：沒設 activities 的場域維持原本流程、不會壞

import { useParams } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import BookActivitiesPage from "./BookActivitiesPage";
import BookPage from "./BookPage";
import { initLiff } from "@/lib/liff";

interface ActivitiesResponse {
  activities: Array<{ id: string }>;
}

export default function BookEntryPage() {
  const params = useParams<{ fieldCode: string }>();
  const fieldCode = params.fieldCode ?? "";

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["public-activities-count", fieldCode],
    queryFn: async () => {
      const res = await fetch(`/api/fields/${encodeURIComponent(fieldCode)}/activities`);
      if (!res.ok) return { activities: [] };
      return await res.json();
    },
    enabled: !!fieldCode,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="container-player py-8 flex flex-col items-center gap-3" role="status">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">載入中…</p>
      </div>
    );
  }

  // 有活動 → 顯示卡片列表
  if (data && data.activities.length > 0) {
    return <BookActivitiesPage />;
  }

  // fallback 既有單一預約配置
  return <BookPage />;
}
