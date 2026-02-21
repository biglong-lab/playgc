// 管理員登入共用 Hook
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signOut as firebaseSignOut, getIdToken } from "@/lib/firebase";
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

  // 自動觸發 Firebase 登入驗證
  useEffect(() => {
    if (isAuthenticated && step === "firebase" && fieldCode && !loginError && firebaseLoginMutation.status === "idle") {
      firebaseLoginMutation.mutate();
    }
  }, [isAuthenticated, step, fieldCode, loginError, firebaseLoginMutation.status]);

  // 登出時清除錯誤
  useEffect(() => {
    if (!isAuthenticated && loginError) {
      setLoginError(null);
      firebaseLoginMutation.reset();
    }
  }, [isAuthenticated]);

  // 處理場域編號提交
  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    firebaseLoginMutation.reset();

    if (!fieldCode.trim()) {
      toast({ title: "請輸入場域編號", variant: "destructive" });
      return;
    }

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

  // 返回選擇登入方式
  const backToLoginChoice = () => {
    setStep("firebase");
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
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    isGoogleLoading,
    firebaseUser,
    isAuthenticated,

    // Mutation 狀態
    isFirebaseLoginPending: firebaseLoginMutation.isPending,
    isPasswordLoginPending: passwordLoginMutation.isPending,

    // 事件處理
    handleFieldSubmit,
    handleGoogleLogin,
    handleSignOut,
    handlePasswordSubmit,
    switchToPasswordLogin,
    backToFieldInput,
    backToLoginChoice,
    recheckAuthorization,
  };
}
