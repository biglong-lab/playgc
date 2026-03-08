import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/AuthContext";
import { getIdToken } from "@/lib/firebase";
import type { User } from "@shared/schema";

export function useAuth() {
  const { firebaseUser, isLoading: firebaseLoading, isAuthenticated: isSignedIn } = useAuthContext();

  const queryEnabled = !firebaseLoading && isSignedIn;

  const { data: dbUser, isLoading: dbLoading, isError, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: queryEnabled,
    retry: 2,
    retryDelay: 500,
    staleTime: 30_000,
  });

  // debug log（上線前移除）
  if (firebaseLoading || isSignedIn || dbUser || isError) {
    console.log("[useAuth]", {
      firebaseLoading,
      isSignedIn,
      queryEnabled,
      dbUser: dbUser ? `id=${dbUser.id}` : null,
      dbLoading,
      isError,
      error: isError ? String(error) : null,
    });
  }

  const user = dbUser ? {
    ...dbUser,
    firstName: firebaseUser?.displayName?.split(" ")[0] || dbUser.firstName,
    lastName: firebaseUser?.displayName?.split(" ").slice(1).join(" ") || dbUser.lastName,
    profileImageUrl: firebaseUser?.photoURL || dbUser.profileImageUrl,
  } : null;

  // Don't stay stuck in loading state if there's an error
  const isActuallyLoading = firebaseLoading || (isSignedIn && dbLoading && !isError);

  return {
    user,
    firebaseUser,
    isLoading: isActuallyLoading,
    isAuthenticated: !firebaseLoading && isSignedIn && !!dbUser,
    isSignedIn,
    getToken: getIdToken,
    // Expose error state for components that need it
    authError: isError ? error : null,
  };
}
