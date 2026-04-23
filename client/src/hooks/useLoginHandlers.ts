import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  signInWithGoogle,
  signInWithApple,
  signInAnonymously,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from "@/lib/firebase";

/**
 * 從當前 context（URL path 或 localStorage）推出 fieldCode
 * 優先序：URL /f/:code > localStorage.lastFieldCode > null
 */
function readFieldCodeFromContext(): string | null {
  if (typeof window === "undefined") return null;
  // URL path
  const m = window.location.pathname.match(/^\/f\/([A-Z0-9_-]{2,50})(?:\/|$)/i);
  if (m) return m[1].toUpperCase();
  // localStorage
  try {
    const v = localStorage.getItem("lastFieldCode");
    if (v && /^[A-Z0-9_-]{2,50}$/i.test(v)) return v.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

/** 登入方法類型 */
export type LoginMethod = "google" | "apple" | "guest" | "email" | null;

/** 登入處理 Hook 的回傳介面 */
export interface LoginHandlers {
  isLoggingIn: boolean;
  loginMethod: LoginMethod;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  handleGoogleLogin: () => Promise<void>;
  handleAppleLogin: () => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  handleEmailLogin: (e: React.FormEvent) => Promise<void>;
  handleEmailSignup: (e: React.FormEvent) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
}

/**
 * 封裝所有登入方式的處理邏輯
 * @param onSuccess - 登入成功後的回呼（通常是關閉 Dialog）
 * @param options.redirectTo - 登入後重導向路徑
 *    - 未傳 / undefined：智能 redirect → 當前場域的 /f/{code}/home，找不到場域則 /f
 *    - 傳字串：redirect 到該路徑
 *    - 傳 null：不 redirect（留在當前頁）
 */
export function useLoginHandlers(
  onSuccess?: () => void,
  options?: { redirectTo?: string | null },
): LoginHandlers {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLoginSuccess = () => {
    setIsLoggingIn(false);
    setLoginMethod(null);
    // 登入後強制 refetch 使用者資料，確保 UI 更新
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    onSuccess?.();

    const target = options?.redirectTo;
    if (target === null) return; // 明確不 redirect

    if (typeof target === "string" && target.length > 0) {
      setLocation(target);
      return;
    }

    // 智能 redirect：當前場域的 /home，找不到場域就去 /f 選場域
    const code = readFieldCodeFromContext();
    setLocation(code ? `/f/${code}/home` : "/f");
  };

  const handleLoginError = (error: unknown) => {
    const errorMessage =
      error instanceof Error ? error.message : "登入失敗，請重試";
    setIsLoggingIn(false);
    setLoginMethod(null);
    toast({
      variant: "destructive",
      title: "登入失敗",
      description: errorMessage,
    });
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("google");
    try {
      const user = await signInWithGoogle();
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("apple");
    try {
      const user = await signInWithApple();
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("guest");
    try {
      const user = await signInAnonymously();
      if (user) {
        toast({
          title: "歡迎訪客！",
          description: "您可以稍後在設定中綁定正式帳號",
        });
        handleLoginSuccess();
      }
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signInWithEmail(email, password);
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "密碼太短",
        description: "密碼至少需要 6 個字元",
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signUpWithEmail(email, password);
      if (user) {
        toast({
          title: "註冊成功！",
          description: "歡迎加入 CHITO 七逃",
        });
        handleLoginSuccess();
      }
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "請輸入電子郵件",
        description: "請在上方輸入您的電子郵件",
      });
      return;
    }
    setIsLoggingIn(true);
    try {
      await resetPassword(email);
      toast({
        title: "已發送重設郵件",
        description: "請檢查您的電子郵件收件箱",
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "請重試";
      toast({
        variant: "destructive",
        title: "發送失敗",
        description: msg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return {
    isLoggingIn,
    loginMethod,
    email,
    setEmail,
    password,
    setPassword,
    handleGoogleLogin,
    handleAppleLogin,
    handleGuestLogin,
    handleEmailLogin,
    handleEmailSignup,
    handleForgotPassword,
  };
}
