import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/AuthContext";
import { getIdToken } from "@/lib/firebase";
import type { User } from "@shared/schema";

export function useAuth() {
  const { firebaseUser, isLoading: firebaseLoading, isAuthenticated: isSignedIn } = useAuthContext();

  // 🛡️ 2026-05-05: 改 retry: Infinity + exp backoff
  //   原 retry: 2 + 固定 500ms：API 暫時性 503/網路抖過 1.5s 就放棄、user 變 null
  //   → 多人元件誤判「未登入」→ 整個遊戲 unmount/reset → 體感「玩到一半被登出 + 同步崩」
  //   修法：無限重試（API 真的回 200 才停）、exp backoff 1s→2s→4s→max 10s
  const { data: dbUser, isLoading: dbLoading, isError, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: !firebaseLoading && isSignedIn,
    retry: Infinity,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10_000),
    staleTime: 30_000,
  });

  // 🛡️ 2026-05-05: dbUser query 暫失敗時、用 firebaseUser 衍生 fallback user
  //   只要 Firebase Auth 仍有效（firebaseUser 有值）→ user 不為 null
  //   避免短暫 API 失敗導致多人遊戲 unmount/reset
  const fallbackUser: User | null = firebaseUser
    ? {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? null,
        firstName: firebaseUser.displayName?.split(" ")[0] ?? null,
        lastName:
          firebaseUser.displayName?.split(" ").slice(1).join(" ") || null,
        profileImageUrl: firebaseUser.photoURL ?? null,
        role: "player",
        defaultFieldId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    : null;

  const user = dbUser
    ? {
        ...dbUser,
        firstName: firebaseUser?.displayName?.split(" ")[0] || dbUser.firstName,
        lastName: firebaseUser?.displayName?.split(" ").slice(1).join(" ") || dbUser.lastName,
        profileImageUrl: firebaseUser?.photoURL || dbUser.profileImageUrl,
      }
    : fallbackUser;

  // Don't stay stuck in loading state if there's an error
  const isActuallyLoading = firebaseLoading || (isSignedIn && dbLoading && !isError);

  return {
    user,
    firebaseUser,
    isLoading: isActuallyLoading,
    // 🛡️ 2026-05-05: 改用 firebaseUser 為 source of truth
    //   原本要 dbUser 也成功才算 isAuthenticated → 一次 API 失敗就「未登入」
    isAuthenticated: !firebaseLoading && isSignedIn,
    isSignedIn,
    getToken: getIdToken,
    authError: isError ? error : null,
  };
}
