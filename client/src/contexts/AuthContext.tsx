import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { queryClient } from "@/lib/queryClient";


interface AuthContextType {
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevUserRef = useRef<User | null>(null);

  useEffect(() => {
    let authStateReceived = false;
    let unsubscribe: (() => void) | null = null;

    // 設定超時，處理 Firebase 無回應的情況
    const timeout = setTimeout(() => {
      if (!authStateReceived) {
        setIsLoading(false);
      }
    }, 2000);

    // 動態載入以處理 Firebase 初始化錯誤
    const initFirebase = async () => {
      try {
        const { auth, onAuthStateChanged, handleRedirectResult } = await import("@/lib/firebase");

        // 處理嵌入式瀏覽器的重導向登入流程
        try {
          await handleRedirectResult();
        } catch (_redirectError) {
          // 重導向結果處理失敗，繼續正常流程
        }

        if (!auth) {
          setIsLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          authStateReceived = true;
          clearTimeout(timeout);
          console.log("[AuthContext] onAuthStateChanged:", user ? `uid=${user.uid}, anonymous=${user.isAnonymous}` : "null");
          // 使用者狀態變更時（登入/登出）強制 refetch
          const wasSignedIn = !!prevUserRef.current;
          const isNowSignedIn = !!user;
          if (wasSignedIn !== isNowSignedIn) {
            console.log("[AuthContext] 狀態變更 → invalidateQueries");
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          }
          prevUserRef.current = user;
          setFirebaseUser(user);
          setIsLoading(false);
        }, (error) => {
          console.error("[AuthContext] onAuthStateChanged 錯誤:", error);
          authStateReceived = true;
          clearTimeout(timeout);
          setIsLoading(false);
        });
      } catch (error) {
        authStateReceived = true;
        clearTimeout(timeout);
        setIsLoading(false);
      }
    };

    initFirebase();

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        isLoading,
        isAuthenticated: !!firebaseUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
