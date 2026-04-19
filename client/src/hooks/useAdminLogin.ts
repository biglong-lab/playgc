// 管理員登入共用 Hook
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signInWithCustomToken, signOut as firebaseSignOut, getIdToken } from "@/lib/firebase";
import { useAuthContext } from "@/contexts/AuthContext";

export interface AdminLoginResponse {
  success: boolean;
  admin: {
    id: string;
    accountId: string;
    fieldId: string;
    fieldCode: string;
    fieldName: string;
    username?: string;
    displayName: string | null;
    roleId: string | null;
    systemRole: string;
    permissions: string[];
  };
}

export type LoginStep = "field" | "firebase" | "pending";

export interface UseAdminLoginOptions {
  // 登入成功後導向的路徑
  successRedirect: string;
}

export function useAdminLogin(options: UseAdminLoginOptions) {
  const { successRedirect } = options;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { firebaseUser, isAuthenticated } = useAuthContext();

  // 表單狀態
  const [fieldCode, setFieldCode] = useState("");
  const [step, setStep] = useState<LoginStep>("field");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Firebase 登入 mutation
  const firebaseLoginMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();

      if (!token) {
        throw new Error("無法取得登入令牌，請重新登入 Google");
      }

      const response = await fetch("/api/admin/firebase-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ fieldCode }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.status === 202) {
        return { status: "pending", message: data.message } as const;
      }

      if (!response.ok) {
        throw new Error(data.message || "登入失敗");
      }

      return { status: "success", ...data } as AdminLoginResponse & { status: "success" };
    },
    onSuccess: (data) => {
      if (data.status === "pending") {
        setStep("pending");
        toast({
          title: "申請已提交",
          description: data.message,
        });
        return;
      }

      toast({
        title: "登入成功",
        description: `歡迎回來，${data.admin.displayName || firebaseUser?.displayName || "管理員"}`,
      });
      navigate(successRedirect);
    },
    onError: (error: Error) => {
      const errorMsg = error.message || "登入失敗";
      setLoginError(errorMsg);
      toast({
        title: "登入失敗",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  // 自動觸發 Firebase 登入驗證（fieldCode 可空，super_admin 不需要場域碼）
  useEffect(() => {
    if (isAuthenticated && step === "firebase" && !loginError && firebaseLoginMutation.status === "idle") {
      firebaseLoginMutation.mutate();
    }
  }, [isAuthenticated, step, loginError, firebaseLoginMutation.status]);

  // 登出時清除錯誤
  useEffect(() => {
    if (!isAuthenticated && loginError) {
      setLoginError(null);
      firebaseLoginMutation.reset();
    }
  }, [isAuthenticated]);

  // 處理場域編號提交（允許空場域碼，super_admin 可跳過）
  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    firebaseLoginMutation.reset();

    if (isAuthenticated) {
      firebaseLoginMutation.mutate();
    } else {
      setStep("firebase");
    }
  };

  // 處理 Google 登入
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Google 登入失敗，請重試";
      setLoginError(errorMessage);
      toast({
        title: "登入失敗",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 處理 Email 登入
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsEmailLoading(true);
    setLoginError(null);
    firebaseLoginMutation.reset();
    try {
      await signInWithEmail(email, password);
      setStep("firebase");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Email 登入失敗";
      setLoginError(errorMessage);
      toast({ title: "登入失敗", description: errorMessage, variant: "destructive" });
    } finally {
      setIsEmailLoading(false);
    }
  };

  // 處理 Email 註冊
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast({ title: "密碼太短", description: "密碼至少需要 6 個字元", variant: "destructive" });
      return;
    }
    setIsEmailLoading(true);
    setLoginError(null);
    firebaseLoginMutation.reset();
    try {
      await signUpWithEmail(email, password);
      setStep("firebase");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "註冊失敗";
      setLoginError(errorMessage);
      toast({ title: "註冊失敗", description: errorMessage, variant: "destructive" });
    } finally {
      setIsEmailLoading(false);
    }
  };

  // 開發環境：透過 custom token 快速登入（跳過 Google popup）
  const handleDevLogin = async (devEmail: string) => {
    setIsEmailLoading(true);
    setLoginError(null);
    firebaseLoginMutation.reset();
    try {
      const resp = await fetch("/api/dev/custom-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: devEmail }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || "取得 token 失敗");
      }
      const { customToken } = await resp.json();
      await signInWithCustomToken(customToken);
      // 設定 step 為 firebase，讓 useEffect 偵測到 isAuthenticated + step 後自動觸發 mutation
      setStep("firebase");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Dev 登入失敗";
      setLoginError(msg);
      toast({ title: "登入失敗", description: msg, variant: "destructive" });
    } finally {
      setIsEmailLoading(false);
    }
  };

  // 處理登出
  const handleSignOut = async () => {
    setLoginError(null);
    firebaseLoginMutation.reset();
    await firebaseSignOut();
  };

  // 返回場域輸入
  const backToFieldInput = () => {
    setLoginError(null);
    firebaseLoginMutation.reset();
    setStep("field");
  };

  // 重新檢查授權狀態
  const recheckAuthorization = () => {
    firebaseLoginMutation.mutate();
  };

  return {
    // 狀態
    fieldCode,
    setFieldCode,
    step,
    setStep,
    loginError,
    isGoogleLoading,
    firebaseUser,
    isAuthenticated,
    email,
    setEmail,
    password,
    setPassword,
    isEmailLoading,

    // Mutation 狀態
    isFirebaseLoginPending: firebaseLoginMutation.isPending,

    // 事件處理
    handleFieldSubmit,
    handleGoogleLogin,
    handleEmailLogin,
    handleEmailSignup,
    handleDevLogin,
    handleSignOut,
    backToFieldInput,
    recheckAuthorization,
  };
}
