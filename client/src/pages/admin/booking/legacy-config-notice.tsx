// 📅 舊版單一時間表提示（2026-09-24）
//
// 背景：場域原本只有一張「預約時間表」（booking_configs.scheduleTemplate），
//   後來每個活動都有自己的排程、取消政策與提醒（activity_schedules）。
//   現在活動預約「只看活動自己的設定」，場域這張表只服務「未綁活動的舊預約」。
//
// 問題：後台還是把這些欄位大喇喇地擺著，管理員改了以為會生效 → 實際上完全沒作用。
//   這支負責把「這一項已經被活動接管」講清楚，避免白改。
import { useQuery } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface ActivityRow {
  id: string;
  name: string;
  isActive: boolean;
}

/** 這個場域有沒有啟用中的活動（有 → 場域的單一時間表已不再影響活動預約） */
export function useActiveActivities() {
  const { data } = useQuery({
    queryKey: ["admin-activities"],
    queryFn: async () =>
      (await fetchWithAdminAuth("/api/admin/activities")) as { activities?: ActivityRow[] },
  });
  const activities = (data?.activities ?? []).filter((a) => a.isActive);
  return { activities, hasActivities: activities.length > 0 };
}

/** 設定頁最上方的橫幅：說明目前哪一套設定在生效 */
export function LegacyConfigBanner({ activities }: { activities: { id: string; name: string }[] }) {
  if (activities.length === 0) return null;
  const names = activities.map((a) => a.name).join("、");
  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      data-testid="banner-legacy-config"
    >
      <p className="font-semibold">⚠️ 這頁是「舊版單一時間表」</p>
      <p className="mt-1 leading-relaxed">
        此場域已經有 {activities.length} 個啟用中的活動（{names}）。
        <strong>玩家預約活動時，一律依照該活動自己的時段與規則</strong>，不會看這裡的設定。
      </p>
      <p className="mt-1 leading-relaxed">
        要調整時段、價格、取消或提醒 → 請到 <strong>活動管理</strong> 編輯對應活動。
        這頁只剩「啟用預約」總開關，以及沒有綁活動的舊預約會用到。
      </p>
    </div>
  );
}

/** 單一欄位的「已被活動接管」標註 */
export function OverriddenByActivity({ what }: { what: string }) {
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
      已由活動各自設定接管，這裡的{what}不影響活動預約
    </p>
  );
}
