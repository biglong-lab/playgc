/**
 * useGamePermissions 測試（P0-B 2026-09-23）
 * 🐛 field_director（新場域預設「場域管理員」角色，見 server/routes/admin-fields.ts seedDefaultRolesForField）
 *    以前被判不能編輯 / 發布
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";
import { useGamePermissions } from "@/hooks/useGamePermissions";

function renderPerms(systemRole: string, adminFieldId: string, game: { fieldId?: string | null; creatorId?: string | null }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => null } },
  });
  client.setQueryData(["/api/admin/session"], {
    authenticated: true,
    admin: { systemRole, fieldId: adminFieldId, permissions: [] },
  });
  client.setQueryData(["/api/auth/user"], { id: "u-1" });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useGamePermissions(game), { wrapper }).result.current;
}

const sameFieldGame = { fieldId: "field-1", creatorId: null };
const otherFieldGame = { fieldId: "field-2", creatorId: null };

describe("useGamePermissions", () => {
  it("field_director 同場域：可檢視 / 編輯 / 發布 / 管場次 / 管玩家（等同場域管理員）", () => {
    const p = renderPerms("field_director", "field-1", sameFieldGame);
    expect(p.isLoaded).toBe(true);
    expect(p.canView).toBe(true);
    expect(p.canEdit).toBe(true);
    expect(p.canPublish).toBe(true);
    expect(p.canManageSessions).toBe(true);
    expect(p.canManagePlayers).toBe(true);
    // 刪除維持只給 super_admin（與 field_manager 相同）
    expect(p.canDelete).toBe(false);
  });

  it("field_director 別場域的遊戲：不能編輯", () => {
    const p = renderPerms("field_director", "field-1", otherFieldGame);
    expect(p.canView).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.canPublish).toBe(false);
  });

  it("field_manager 同場域：行為不變（可編輯）", () => {
    const p = renderPerms("field_manager", "field-1", sameFieldGame);
    expect(p.canEdit).toBe(true);
    expect(p.canPublish).toBe(true);
  });

  it("field_executor 同場域：只能看與管場次、不能編輯", () => {
    const p = renderPerms("field_executor", "field-1", sameFieldGame);
    expect(p.canView).toBe(true);
    expect(p.canManageSessions).toBe(true);
    expect(p.canEdit).toBe(false);
    expect(p.canPublish).toBe(false);
  });

  it("super_admin 跨場域全開", () => {
    const p = renderPerms("super_admin", "field-1", otherFieldGame);
    expect(p.canEdit).toBe(true);
    expect(p.canDelete).toBe(true);
  });

  it("custom 角色：不因角色名給編輯權（維持現狀）", () => {
    const p = renderPerms("custom", "field-1", sameFieldGame);
    expect(p.canEdit).toBe(false);
  });
});
