// 📊 useComponentTelemetry — 元件健康度自動紀錄 hook（Phase 1 / 2026-05-12）
//
// 設計原則：
//   - 元件作者只需 1 行：const tele = useComponentTelemetry({ componentType, ... });
//   - 自動紀錄 mount / unmount（unmount 未完成 → abandoned）
//   - 提供 reportInteraction() / reportComplete() / reportError() / reportRetry()
//   - fire-and-forget：tele 任何呼叫失敗都不影響元件
//   - 對 server 端極輕（mount 1 次 POST、完成 1 次 PATCH）
//
// 用法：
//   const tele = useComponentTelemetry({
//     componentType: "trivia_showdown",
//     sessionId, userId, teamId, pageId,
//   });
//
//   // 玩家第一次互動（按按鈕、答題、滑動 etc）
//   <Button onClick={() => { tele.reportInteraction(); ... }}>
//
//   // 完成
//   onComplete: () => { tele.reportComplete("completed"); onCompleteOrig(...); }
//
//   // 玩家跳過
//   <Button onClick={() => tele.reportComplete("skipped")}>跳過</Button>
//
//   // 錯誤
//   catch (err) { tele.reportError(err); }

import { useEffect, useRef, useCallback } from "react";

export interface UseComponentTelemetryOptions {
  /** 元件類型（如 "trivia_showdown" / "lock_coop" / "photo_team_gather"）*/
  componentType: string;
  /** session id（如有）*/
  sessionId?: string | null;
  /** 玩家 id（如有）*/
  userId?: string | null;
  /** 隊伍 id（如有）*/
  teamId?: string | null;
  /** 頁面 id（如有）*/
  pageId?: string | null;
  /** 啟用（false 全部 no-op、預設 true）*/
  enabled?: boolean;
}

export interface ComponentTelemetryApi {
  /** 紀錄首次互動 */
  reportInteraction: () => void;
  /** 紀錄完成（含 skipped）*/
  reportComplete: (finalState: "completed" | "skipped") => void;
  /** 紀錄錯誤（會 increment errorCount + 存 lastError）*/
  reportError: (err: unknown, isNetwork?: boolean) => void;
  /** 紀錄重試 */
  reportRetry: () => void;
}

/**
 * useComponentTelemetry — fire-and-forget 元件紀錄 hook
 */
export function useComponentTelemetry(
  opts: UseComponentTelemetryOptions,
): ComponentTelemetryApi {
  const enabled = opts.enabled !== false;
  const runIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const interactedRef = useRef(false);
  const retryCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const networkErrorCountRef = useRef(0);
  const lastErrorRef = useRef<string | null>(null);

  // mount: POST start
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/component-runs/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: opts.sessionId ?? null,
        userId: opts.userId ?? null,
        teamId: opts.teamId ?? null,
        pageId: opts.pageId ?? null,
        componentType: opts.componentType,
      }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { id?: string } | null) => {
        if (cancelled || !data?.id) return;
        runIdRef.current = data.id;
      })
      .catch(() => {
        // 失敗不影響元件
      });

    // unmount: 沒完成 → abandoned
    return () => {
      cancelled = true;
      if (completedRef.current) return;
      const id = runIdRef.current;
      if (!id) return;
      // sendBeacon 為主（unmount / page hide 仍能送）、fallback fetch
      const body = JSON.stringify({
        finalState: "abandoned",
        completedAt: new Date().toISOString(),
        retryCount: retryCountRef.current,
        errorCount: errorCountRef.current,
        networkErrorCount: networkErrorCountRef.current,
        lastError: lastErrorRef.current ?? undefined,
      });
      try {
        // sendBeacon 不支援 PATCH、改用 fetch keepalive（unmount / page hide 仍能送）
        fetch(`/api/component-runs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // 失敗不影響 unmount
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, opts.componentType]);

  // ─── Public API ────────────────────────────────────────────
  const reportInteraction = useCallback(() => {
    if (!enabled) return;
    if (interactedRef.current) return; // 只記錄首次
    interactedRef.current = true;
    const id = runIdRef.current;
    if (!id) return;
    fetch(`/api/component-runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstInteractionAt: new Date().toISOString() }),
      keepalive: true,
    }).catch(() => {});
  }, [enabled]);

  const reportComplete = useCallback(
    (finalState: "completed" | "skipped") => {
      if (!enabled) return;
      if (completedRef.current) return;
      completedRef.current = true;
      const id = runIdRef.current;
      if (!id) return;
      fetch(`/api/component-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalState,
          completedAt: new Date().toISOString(),
          retryCount: retryCountRef.current,
          errorCount: errorCountRef.current,
          networkErrorCount: networkErrorCountRef.current,
          lastError: lastErrorRef.current ?? undefined,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [enabled],
  );

  const reportError = useCallback(
    (err: unknown, isNetwork: boolean = false) => {
      if (!enabled) return;
      errorCountRef.current += 1;
      if (isNetwork) networkErrorCountRef.current += 1;
      lastErrorRef.current = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const id = runIdRef.current;
      if (!id) return;
      fetch(`/api/component-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorCount: errorCountRef.current,
          networkErrorCount: networkErrorCountRef.current,
          lastError: lastErrorRef.current,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [enabled],
  );

  const reportRetry = useCallback(() => {
    if (!enabled) return;
    retryCountRef.current += 1;
    const id = runIdRef.current;
    if (!id) return;
    fetch(`/api/component-runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retryCount: retryCountRef.current }),
      keepalive: true,
    }).catch(() => {});
  }, [enabled]);

  return { reportInteraction, reportComplete, reportError, reportRetry };
}
