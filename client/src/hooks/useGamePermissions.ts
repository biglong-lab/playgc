// 🔒 統一遊戲權限判斷 hook
// 單一來源，避免各頁面各自組合邏輯造成 bug
import { useQuery } from "@tanstack/react-query";

interface AdminInfo {
  systemRole: string;
  fieldId: string;
  permissions?: string[];
}

interface AdminSessionResponse {
  authenticated: boolean;
  admin?: AdminInfo;
}

interface PlayerUser {
  id: string;
  role?: string;
}

interface GameLike {
  creatorId?: string | null;
  fieldId?: string | null;
}

export interface GamePermissions {
  /** 是否已載入使用者資訊（判斷用） */
  isLoaded: boolean;
  /** 系統角色（super_admin / field_manager / field_executor / game_editor / null） */
  systemRole: string | null;
  /** 檢視遊戲 — 基本權限，登入後 + 同場域都有 */
  canView: boolean;
  /** 編輯遊戲內容、頁面、道具 — field_manager 以上 */
  canEdit: boolean;
  /** 發布遊戲 */
  canPublish: boolean;
  /** 刪除遊戲 — 只有 super_admin */
  canDelete: boolean;
  /** 查看遊戲管理後台 session / leaderboard */
  canManageSessions: boolean;
  /** 管理玩家（授權、停權）— field_manager 以上 */
  canManagePlayers: boolean;
}

/**
 * 依當前登入者 + 遊戲資訊，回傳所有相關權限
 *
 * 角色矩陣：
 * - super_admin：全平台全部 ✅
 * - field_manager：同場域，可 CRUD 遊戲 / 發布 / 刪除
 * - game_editor：同場域，可 CRUD + 發布，不可刪除
 * - field_executor：同場域，可 view + 執行 session
 * - 建立者 (legacy)：視為 editor
 */
export function useGamePermissions(game?: GameLike | null): GamePermissions {
  const { data: sessionData } = useQuery<AdminSessionResponse>({
    queryKey: ["/api/admin/session"],
    staleTime: 60_000,
  });

  const { data: playerUser } = useQuery<PlayerUser>({
    queryKey: ["/api/auth/user"],
    staleTime: 60_000,
  });

  const admin = sessionData?.admin;
  const isLoaded = !!sessionData && !!playerUser;
  const systemRole = admin?.systemRole ?? null;

  // 是否同場域
  const sameField = !!(admin?.fieldId && game?.fieldId && admin.fieldId === game.fieldId);
  const isSuperAdmin = systemRole === "super_admin";
  const isManager = systemRole === "field_manager" && sameField;
  const isEditor = systemRole === "game_editor" && sameField;
  const isExecutor = systemRole === "field_executor" && sameField;

  // legacy 相容
  const legacyAdmin = playerUser?.role === "admin";
  const isCreator = !!(playerUser?.id && game?.creatorId && game.creatorId === playerUser.id);

  return {
    isLoaded,
    systemRole,
    canView: isSuperAdmin || isManager || isEditor || isExecutor || legacyAdmin || isCreator,
    canEdit: isSuperAdmin || isManager || isEditor || legacyAdmin || isCreator,
    canPublish: isSuperAdmin || isManager || isEditor,
    canDelete: isSuperAdmin || legacyAdmin,
    canManageSessions: isSuperAdmin || isManager || isEditor || isExecutor,
    canManagePlayers: isSuperAdmin || isManager,
  };
}
