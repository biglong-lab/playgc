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

  // 🐛 2026-05-18：提前 LIFF init、把 userId 存 localStorage
  // 業主回報：點活動進預約頁時、LIFF 第二次 init 卡關 → 玩家以為頁面壞了按返回
  // 修法：在活動列表頁就先 LIFF init、把 profile 存 localStorage、BookPage 從 localStorage 讀
  useEffect(() => {
    if (!fieldCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/liff/${encodeURIComponent(fieldCode)}`);
        if (!res.ok) return;
        const j = (await res.json()) as { liffId?: string };
        if (!j.liffId) return;
        const result = await initLiff(j.liffId);
        if (cancelled || !result.profile) return;
        try {
          localStorage.setItem("__bookpage_test_lineUserId", result.profile.userId);
          localStorage.setItem("__bookpage_test_displayName", result.profile.displayName);
        } catch { /* ignore */ }
      } catch (err) {
        console.warn("[BookEntryPage] 提前 LIFF init 失敗:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldCode]);

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
