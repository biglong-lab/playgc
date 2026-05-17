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
        const { auth, onAuthStateChanged, handleRedirectResult, consumeLineTokenFromHash } = await import("@/lib/firebase");

        // 🆕 2026-05-17 LINE Login：先試 hash 裡的 custom token
        // （後端 callback 會 redirect 到 returnTo + #lineToken=xxx）
        // 🐛 2026-05-18：失敗時用 console + alert 讓業主可見（原本靜默會造成無限迴圈）
        try {
          await consumeLineTokenFromHash();
        } catch (lineErr) {
          console.error("[AuthContext] LINE 登入處理失敗:", lineErr);
          if (typeof window !== "undefined" && window.location.hash.includes("lineToken=")) {
            const msg = lineErr instanceof Error ? lineErr.message : "未知錯誤";
            // 用 alert 強制可見（toast 在 AuthProvider mount 階段未必準備好）
            setTimeout(() => alert(`LINE 登入失敗：${msg}\n\n請重試或改用其他登入方式。`), 100);
          }
        }

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
          // 使用者狀態變更時（登入/登出）強制 refetch
          const wasSignedIn = !!prevUserRef.current;
          const isNowSignedIn = !!user;
          if (wasSignedIn !== isNowSignedIn) {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          }
          prevUserRef.current = user;
          setFirebaseUser(user);
          setIsLoading(false);
        }, () => {
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
