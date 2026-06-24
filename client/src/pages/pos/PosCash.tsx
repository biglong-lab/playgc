// 💰 POS 櫃檯現金（2026-06-22）
//
// 上班清點 / 下班結算（面額張數統計）/ 隔日對帳差異 / 清帳 / 差異確認 / 歷史。
// mobile-first；清帳 + 差異確認僅 pos_cash_admin 可見。

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const FACES = [1000, 500, 100, 50, 10, 5, 1] as const;
const NT = (cents: number) => `NT$${Math.round(cents / 100).toLocaleString()}`;

interface CashCount {
  id: string;
  businessDate: string;
  countType: "opening" | "closing";
  countedCents: number;
  expectedCents: number;
  varianceCents: number;
  varianceReason: string | null;
  varianceStatus: "none" | "pending" | "confirmed";
  adjustmentCents: number | null;
  countedByName: string | null;
  countedAt: string;
  denominations: Record<string, number>;
}
interface Drawdown {
  id: string;
  businessDate: string;
  amountCents: number;
  reason: string | null;
  drawdownByName: string | null;
  drawdownAt: string;
}
interface Settlement {
  id: string;
  businessDate: string;
  openingCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  drawdownCents: number;
  expectedCashCents: number;
  countedCashCents: number;
  varianceCents: number;
  varianceReason: string | null;
  actualCashCents: number;
  salesTotalCents: number;
  txnCount: number;
  settledByName: string | null;
  settledAt: string;
}
interface Adjustment {
  id: string;
  businessDate: string;
  targetType: string;
  fieldChanged: string;
  oldCents: number | null;
  newCents: number | null;
  reason: string;
  adjustedByName: string | null;
  adjustedAt: string;
}
interface Today {
  date: string;
  opening: CashCount | null;
  closing: CashCount | null;
  openingExpected: number;
  closingExpected: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  todayDrawdownsCents: number;
  todayExpensesCents: number;
  settlement: Settlement | null;
  locked: boolean;
  stage: "not_started" | "open" | "closing_done" | "settled";
  canCashAdmin: boolean;
}
interface Expense {
  id: string;
  category: string;
  amountCents: number;
  note: string | null;
  spentByName: string | null;
  spentAt: string;
}

export default function PosCash() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [denoms, setDenoms] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"opening" | "closing" | null>(null);
  const [drawAmount, setDrawAmount] = useState("");
  const [drawReason, setDrawReason] = useState("");

  const { data: today } = useQuery<Today>({
    queryKey: ["pos-cash-today"],
    queryFn: () => fetchWithAdminAuth("/api/pos/cash/today"),
    refetchInterval: 60_000,
  });
  const { data: history } = useQuery<{ counts: CashCount[]; drawdowns: Drawdown[] }>({
    queryKey: ["pos-cash-history"],
    queryFn: () => fetchWithAdminAuth("/api/pos/cash/history?limit=40"),
  });
  const { data: adjData } = useQuery<{ adjustments: Adjustment[] }>({
    queryKey: ["pos-cash-adjustments"],
    queryFn: () => fetchWithAdminAuth("/api/pos/cash/adjustments?limit=40"),
  });

  // 預設清點型別：未開班→開班；已開班未收班→收班
  const effectiveMode: "opening" | "closing" =
    mode ?? (today && !today.opening ? "opening" : today && !today.closing ? "closing" : "opening");

  const countedCents = useMemo(
    () => FACES.reduce((s, f) => s + f * 100 * Math.max(0, Math.floor(denoms[String(f)] || 0)), 0),
    [denoms],
  );
  const expectedCents = effectiveMode === "opening" ? today?.openingExpected ?? 0 : today?.closingExpected ?? 0;
  const varianceCents = countedCents - expectedCents;

  const submitCount = useMutation({
    mutationFn: () =>
      fetchWithAdminAuth("/api/pos/cash/count", {
        method: "POST",
        body: JSON.stringify({ countType: effectiveMode, denominations: denoms, note: reason || undefined }),
      }),
    onSuccess: () => {
      toast({ title: `${effectiveMode === "opening" ? "上班清點" : "下班結算"}已記錄` });
      setDenoms({});
      setReason("");
      setMode(null);
      qc.invalidateQueries({ queryKey: ["pos-cash-today"] });
      qc.invalidateQueries({ queryKey: ["pos-cash-history"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "記錄失敗", description: e.message }),
  });

  const submitDrawdown = useMutation({
    mutationFn: () =>
      fetchWithAdminAuth("/api/pos/cash/drawdown", {
        method: "POST",
        body: JSON.stringify({ amountCents: Math.round(Number(drawAmount) * 100), reason: drawReason || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "清帳已記錄" });
      setDrawAmount("");
      setDrawReason("");
      qc.invalidateQueries({ queryKey: ["pos-cash-today"] });
      qc.invalidateQueries({ queryKey: ["pos-cash-history"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "清帳失敗", description: e.message }),
  });

  const confirmVariance = useMutation({
    mutationFn: (v: { id: string; mode: "record" | "adjust"; adjustmentCents?: number }) =>
      fetchWithAdminAuth(`/api/pos/cash/count/${v.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ mode: v.mode, adjustmentCents: v.adjustmentCents }),
      }),
    onSuccess: () => {
      toast({ title: "差異已確認" });
      qc.invalidateQueries({ queryKey: ["pos-cash-history"] });
      qc.invalidateQueries({ queryKey: ["pos-cash-today"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "確認失敗", description: e.message }),
  });

  const settleMut = useMutation({
    mutationFn: (v: { varianceReason?: string }) =>
      fetchWithAdminAuth("/api/pos/cash/settle", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      toast({ title: "✅ 今日已結帳並鎖定" });
      qc.invalidateQueries({ queryKey: ["pos-cash-today"] });
      qc.invalidateQueries({ queryKey: ["pos-cash-history"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "結帳失敗", description: e.message }),
  });

  const adjustMut = useMutation({
    mutationFn: (v: { targetType: string; targetId: string; newCents: number; reason: string }) =>
      fetchWithAdminAuth("/api/pos/cash/adjust", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      toast({ title: "調整已記錄（軌跡保留）" });
      qc.invalidateQueries({ queryKey: ["pos-cash-today"] });
      qc.invalidateQueries({ queryKey: ["pos-cash-adjustments"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "調整失敗", description: e.message }),
  });

  const pendingVariances = (history?.counts ?? []).filter((c) => c.varianceStatus === "pending");
  const locked = !!today?.locked;
  const stage = today?.stage ?? "not_started";
  const STEP = { not_started: 1, open: 2, closing_done: 3, settled: 4 }[stage] ?? 1;
  // 點階段 → 跳到對應動作
  const goStep = (n: number) => {
    if (n === 1) { setMode("opening"); document.getElementById("cash-count-form")?.scrollIntoView({ behavior: "smooth" }); }
    else if (n === 2) { navigate("/pos/checkout?return=/pos/cash"); }
    else if (n === 3) { setMode("closing"); document.getElementById("cash-count-form")?.scrollIntoView({ behavior: "smooth" }); }
    else if (n === 4) { document.getElementById("cash-settle-card")?.scrollIntoView({ behavior: "smooth" }); }
  };

  return (
    <PosLayout title="櫃檯現金" backTo="/pos">
      {/* 閉環階段引導（可點，導向對應動作）*/}
      {today && (
        <div className="flex items-center gap-1 mb-3 text-xs">
          {[
            { n: 1, label: "開帳" },
            { n: 2, label: "記帳" },
            { n: 3, label: "收班" },
            { n: 4, label: "結帳" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => !locked && goStep(s.n)}
                disabled={locked}
                data-testid={`cash-step-${s.n}`}
                className={`flex items-center gap-1 px-2 py-1 rounded-full ${STEP >= s.n ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"} ${STEP === s.n && !locked ? "ring-2 ring-emerald-300" : ""}`}
              >
                <span className="font-bold">{STEP > s.n ? "✓" : s.n}</span>{s.label}
              </button>
              {i < 3 && <div className={`h-0.5 flex-1 ${STEP > s.n ? "bg-emerald-500" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
      )}

      {/* 👉 下一步動作卡（閉環核心：把記帳/收款串進來）*/}
      {today && !locked && (
        <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-3 mb-3">
          {stage === "not_started" && (
            <>
              <div className="font-semibold text-sm mb-1">👉 第一步：開帳清點</div>
              <p className="text-xs text-muted-foreground mb-2">上班先清點抽屜現金（下方面額表），確立今日起始金額。</p>
              <Button className="w-full" onClick={() => goStep(1)} data-testid="cash-action-open">開始開帳清點</Button>
            </>
          )}
          {stage === "open" && (
            <>
              <div className="font-semibold text-sm mb-1">💰 營業中：記帳收款</div>
              <p className="text-xs text-muted-foreground mb-2">
                今日現金收 <b>{NT(today.cashSalesCents)}</b>　退 {NT(today.cashRefundsCents)}　清帳 {NT(today.todayDrawdownsCents)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => navigate("/pos/checkout?return=/pos/cash")} data-testid="cash-action-checkout">
                  ➕ 現金收款
                </Button>
                <Button variant="outline" onClick={() => goStep(3)} data-testid="cash-action-toclose">
                  打烊 → 收班清點
                </Button>
              </div>
            </>
          )}
          {stage === "closing_done" && (
            <>
              <div className="font-semibold text-sm mb-1">🧾 最後一步：結帳鎖定</div>
              <p className="text-xs text-muted-foreground mb-2">確認今日帳務無誤後結帳，數字成隔日對帳基礎。</p>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => goStep(4)} data-testid="cash-action-tosettle">前往結帳</Button>
            </>
          )}
        </div>
      )}

      {/* 今日概況 */}
      {today && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3 mb-3 text-sm space-y-1">
          <div className="font-semibold text-base mb-1 flex items-center justify-between">
            <span>📅 {today.date}</span>
            {locked && <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">🔒 已結帳鎖定</span>}
          </div>
          <Row label="開班清點" value={today.opening ? NT(today.opening.adjustmentCents ?? today.opening.countedCents) : "—"} />
          <Row label="現金收款" value={NT(today.cashSalesCents)} />
          <Row label="現金退款" value={`−${NT(today.cashRefundsCents)}`} />
          <Row label="今日清帳" value={`−${NT(today.todayDrawdownsCents)}`} />
          <Row label="下班結算" value={today.closing ? NT(today.closing.adjustmentCents ?? today.closing.countedCents) : "—"} bold />
        </div>
      )}

      {/* 已結帳：摘要 + (管理員)調整 */}
      {locked && today?.settlement && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3 mb-3 text-sm space-y-1">
          <div className="font-semibold text-base mb-1">🧾 結帳摘要</div>
          <Row label="銷售總額" value={`${NT(today.settlement.salesTotalCents)}（${today.settlement.txnCount} 筆）`} />
          <Row label="現金預期 / 實點" value={`${NT(today.settlement.expectedCashCents)} / ${NT(today.settlement.countedCashCents)}`} />
          {today.settlement.varianceCents !== 0 && (
            <Row label="差異" value={`${today.settlement.varianceCents > 0 ? "溢" : "短"}${NT(Math.abs(today.settlement.varianceCents))}（${today.settlement.varianceReason ?? ""}）`} highlight />
          )}
          <Row label="櫃檯實際現金（隔日基礎）" value={NT(today.settlement.actualCashCents)} bold />
          <div className="text-xs text-muted-foreground">結帳人：{today.settlement.settledByName ?? "—"}</div>
          {today.canCashAdmin && (
            <button
              onClick={() => {
                const v = prompt("調整「櫃檯實際現金」為（元）", String(Math.round(today.settlement!.actualCashCents / 100)));
                if (v == null || !(Number(v) >= 0)) return;
                const r = prompt("調整原因（必填）");
                if (!r) return;
                adjustMut.mutate({ targetType: "settlement", targetId: today.settlement!.id, newCents: Math.round(Number(v) * 100), reason: r });
              }}
              className="mt-2 w-full py-2 rounded-lg border-2 border-amber-400 text-amber-700 dark:text-amber-300 text-sm font-medium"
              data-testid="cash-adjust-settlement"
            >
              🛠 管理員調整（保留軌跡）
            </button>
          )}
        </div>
      )}

      {/* 清點表單（未鎖定才顯示）*/}
      {!locked && (
      <div id="cash-count-form" className="rounded-xl border bg-white dark:bg-slate-900 p-3 mb-3">
        <div className="flex gap-2 mb-3">
          {(["opening", "closing"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              data-testid={`cash-mode-${m}`}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                effectiveMode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {m === "opening" ? "🌅 上班清點" : "🌆 下班結算"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {FACES.map((f) => {
            const qty = Math.max(0, Math.floor(denoms[String(f)] || 0));
            return (
              <div key={f} className="flex items-center gap-2">
                <span className="w-16 text-right font-medium tabular-nums">${f}</span>
                <span className="text-muted-foreground">×</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={denoms[String(f)] ?? ""}
                  onChange={(e) => setDenoms((d) => ({ ...d, [String(f)]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                  placeholder="0"
                  data-testid={`cash-denom-${f}`}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-background text-base text-right tabular-nums"
                />
                <span className="w-24 text-right text-muted-foreground tabular-nums">{NT(f * 100 * qty)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t space-y-1">
          <Row label="點鈔總額" value={NT(countedCents)} bold />
          <Row label="系統預期" value={NT(expectedCents)} />
          <Row
            label="差異"
            value={`${varianceCents > 0 ? "溢 " : varianceCents < 0 ? "短 " : ""}${NT(Math.abs(varianceCents))}`}
            highlight={varianceCents !== 0}
          />
        </div>

        {varianceCents !== 0 && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="差異原因（必填）"
            data-testid="cash-variance-reason"
            className="mt-2 w-full px-3 py-2 rounded-lg border bg-background text-sm"
            rows={2}
          />
        )}

        <Button
          onClick={() => submitCount.mutate()}
          disabled={submitCount.isPending || countedCents === 0 || (varianceCents !== 0 && !reason.trim())}
          className="w-full mt-3"
          data-testid="cash-submit-count"
        >
          {effectiveMode === "opening" ? "記錄上班清點" : "記錄下班結算"}
        </Button>
      </div>
      )}

      {/* 結帳（收班完成、未結帳）— 閉環收尾 */}
      {!locked && today?.closing && (
        <div id="cash-settle-card" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-3 mb-3">
          <div className="font-semibold text-sm mb-1">🧾 今日結帳</div>
          <p className="text-xs text-muted-foreground mb-2">
            確認後送出當日帳務並鎖定，數字成為隔日對帳基礎。鎖定後僅管理員可調整（保留軌跡）。
          </p>
          <Button
            onClick={() => {
              const variance = (today.closing!.adjustmentCents ?? today.closing!.countedCents) - today.closingExpected;
              let vr: string | undefined;
              if (variance !== 0) {
                vr = today.closing!.varianceReason ?? prompt(`現金有差異 ${variance > 0 ? "溢" : "短"}${NT(Math.abs(variance))}，請填原因`) ?? undefined;
                if (!vr) return;
              }
              if (!confirm(`確定結帳 ${today.date}？結帳後當日鎖定。`)) return;
              settleMut.mutate({ varianceReason: vr });
            }}
            disabled={settleMut.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            data-testid="cash-settle"
          >
            {settleMut.isPending ? "結帳中…" : "✅ 確認結帳並鎖定"}
          </Button>
        </div>
      )}

      {/* 清帳（僅 cash admin）*/}
      {today?.canCashAdmin && !locked && (
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 p-3 mb-3">
          <div className="font-semibold text-sm mb-2">💵 清帳（取走現金）</div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={drawAmount}
              onChange={(e) => setDrawAmount(e.target.value)}
              placeholder="金額（元）"
              data-testid="cash-drawdown-amount"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-background text-base"
            />
            <Button
              onClick={() => submitDrawdown.mutate()}
              disabled={submitDrawdown.isPending || !(Number(drawAmount) > 0)}
              data-testid="cash-drawdown-submit"
            >
              清帳
            </Button>
          </div>
          <input
            value={drawReason}
            onChange={(e) => setDrawReason(e.target.value)}
            placeholder="事由（如：存銀行）"
            className="mt-2 w-full px-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
      )}

      {/* 待確認差異（僅 cash admin）*/}
      {today?.canCashAdmin && pendingVariances.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 mb-3">
          <div className="font-semibold text-sm mb-2 text-red-700 dark:text-red-300">⚠️ 待確認差異 ({pendingVariances.length})</div>
          <div className="space-y-2">
            {pendingVariances.map((c) => (
              <div key={c.id} className="text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <div>{c.businessDate} {c.countType === "opening" ? "上班" : "下班"}：差異 {c.varianceCents > 0 ? "溢" : "短"}{NT(Math.abs(c.varianceCents))}</div>
                {c.varianceReason && <div className="text-muted-foreground text-xs">原因：{c.varianceReason}</div>}
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => confirmVariance.mutate({ id: c.id, mode: "record" })} data-testid={`cash-confirm-record-${c.id}`}>
                    依紀錄確認
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const v = prompt("輸入調整後的實際金額（元）", String(Math.round(c.countedCents / 100)));
                      if (v != null && Number(v) >= 0) confirmVariance.mutate({ id: c.id, mode: "adjust", adjustmentCents: Math.round(Number(v) * 100) });
                    }}
                    data-testid={`cash-confirm-adjust-${c.id}`}
                  >
                    輸入調整金額
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 歷史 */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
        <div className="font-semibold text-sm mb-2">📜 歷史紀錄</div>
        <div className="space-y-1.5 text-sm">
          {(history?.counts ?? []).slice(0, 20).map((c) => (
            <div key={c.id} className="flex justify-between gap-2 border-b pb-1.5 last:border-b-0">
              <span className="text-muted-foreground shrink-0">{c.businessDate} {c.countType === "opening" ? "上班" : "下班"}</span>
              <span className="text-right">
                {NT(c.adjustmentCents ?? c.countedCents)}
                {c.varianceCents !== 0 && (
                  <span className={c.varianceStatus === "confirmed" ? "text-muted-foreground" : "text-red-600"}>
                    {" "}（{c.varianceCents > 0 ? "溢" : "短"}{NT(Math.abs(c.varianceCents))}{c.varianceStatus === "confirmed" ? "已確認" : "待確認"}）
                  </span>
                )}
                <span className="text-muted-foreground text-xs block">{c.countedByName ?? "—"}</span>
              </span>
            </div>
          ))}
          {(history?.drawdowns ?? []).slice(0, 10).map((d) => (
            <div key={d.id} className="flex justify-between gap-2 border-b pb-1.5 last:border-b-0">
              <span className="text-amber-600 shrink-0">{d.businessDate} 清帳</span>
              <span className="text-right">
                −{NT(d.amountCents)}
                <span className="text-muted-foreground text-xs block">{d.drawdownByName ?? "—"}{d.reason ? `・${d.reason}` : ""}</span>
              </span>
            </div>
          ))}
        </div>
        {/* 調整軌跡（append-only，永不刪除）*/}
        {(adjData?.adjustments ?? []).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="font-semibold text-sm mb-2">🛠 調整軌跡</div>
            <div className="space-y-1.5 text-sm">
              {(adjData?.adjustments ?? []).slice(0, 20).map((a) => (
                <div key={a.id} className="border-b pb-1.5 last:border-b-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{a.businessDate} {a.targetType === "count" ? "清點" : "結帳"}</span>
                    <span className="text-right tabular-nums">{NT(a.oldCents ?? 0)} → <span className="font-semibold">{NT(a.newCents ?? 0)}</span></span>
                  </div>
                  <div className="text-muted-foreground text-xs">{a.adjustedByName ?? "—"}・{a.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PosLayout>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""} ${highlight ? "text-red-600 font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
