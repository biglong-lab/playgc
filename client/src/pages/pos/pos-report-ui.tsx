// 📊 POS 報表共用小元件（2026-09-22 從 PosReports 抽出，供區間卡片共用）

/** 分 → NT$ 字串 */
export const money = (cents: number) => `NT$${(cents / 100).toLocaleString()}`;

/** 報表一列：左標籤、右數值 */
export function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
