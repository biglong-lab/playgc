import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
  type User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Firebase 錯誤碼提取（避免 catch error: any）
function getFirebaseErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

function isEmbeddedBrowser(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as Record<string, string>).opera || "";
  const ua = userAgent.toLowerCase();
  
  const embeddedBrowserPatterns = [
    /line\//i,
    /fbav/i,
    /fban/i,
    /fb_iab/i,
    /instagram/i,
    /twitter/i,
    /wechat/i,
    /micromessenger/i,
    /weibo/i,
    /qq\//i,
    /linkedinapp/i,
    /snapchat/i,
    /pinterest/i,
    /tiktok/i,
    /bytedance/i,
  ];
  
  for (const pattern of embeddedBrowserPatterns) {
    if (pattern.test(ua)) {
      return true;
    }
  }

  if (/android/i.test(ua) && /wv\)|\.0\.0\.0/i.test(ua)) {
    return true;
  }
  
  return false;
}

// Google OAuth Client ID（從 Firebase 專案取得）
const GOOGLE_CLIENT_ID = "885341500294-oug761eremfkjgtalnuhfpqtlj9gql6u.apps.googleusercontent.com";

/** Google 登入 — 使用 Google Identity Services 避免第三方 cookie 問題 */
export async function signInWithGoogle(): Promise<User | null> {
  console.log("[Firebase] signInWithGoogle — GIS 模式");

  // 等待 GIS 腳本載入
  const google = await waitForGoogleGIS();

  return new Promise((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          console.log("[Firebase] GIS 回傳 credential, 長度:", response.credential.length);
          const credential = GoogleAuthProvider.credential(response.credential);
          const result = await signInWithCredential(auth, credential);
          console.log("[Firebase] Google 登入成功:", result.user.uid);
          resolve(result.user);
        } catch (error) {
          console.error("[Firebase] signInWithCredential 失敗:", error);
          reject(new Error("Google 登入失敗，請重試"));
        }
      },
      auto_select: false,
      context: "signin",
    });

    // 顯示 Google One Tap 或 popup
    google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; getNotDisplayedReason: () => string; getSkippedReason: () => string }) => {
      if (notification.isNotDisplayed()) {
        console.log("[Firebase] GIS prompt 未顯示:", notification.getNotDisplayedReason());
        // One Tap 無法顯示時，改用按鈕式觸發
        triggerGoogleSignInButton(google, resolve, reject);
      } else if (notification.isSkippedMoment()) {
        console.log("[Firebase] GIS prompt 被跳過:", notification.getSkippedReason());
        triggerGoogleSignInButton(google, resolve, reject);
      }
    });
  });
}

/** 等待 Google Identity Services 腳本載入 */
function waitForGoogleGIS(): Promise<typeof globalThis.google> {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.google !== "undefined" && globalThis.google.accounts) {
      return resolve(globalThis.google);
    }
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (typeof globalThis.google !== "undefined" && globalThis.google.accounts) {
        clearInterval(interval);
        resolve(globalThis.google);
      } else if (attempts > 50) {
        clearInterval(interval);
        reject(new Error("Google 登入服務載入逾時"));
      }
    }, 100);
  });
}

/** 使用隱藏按鈕觸發 Google 登入彈窗 */
function triggerGoogleSignInButton(
  google: typeof globalThis.google,
  resolve: (user: User | null) => void,
  reject: (error: Error) => void,
) {
  // 建立暫時的 Google 登入按鈕
  const container = document.createElement("div");
  container.id = "g_id_signin_temp";
  container.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;";
  document.body.appendChild(container);

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    width: 300,
  });

  // 自動點擊按鈕
  const btn = container.querySelector('[role="button"]') as HTMLElement;
  if (btn) {
    btn.click();
  }

  // 10 秒後清理（防止殘留）
  setTimeout(() => {
    container.remove();
  }, 10000);
}

export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return result.user;
    }
    return null;
  } catch (error: unknown) {
    throw error;
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw error;
  }
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    return null;
  }
}

// Apple Sign-In
export async function signInWithApple() {
  const useRedirect = isEmbeddedBrowser();

  try {
    if (useRedirect) {
      await signInWithRedirect(auth, appleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, appleProvider);
      return result.user;
    }
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      try {
        await signInWithRedirect(auth, appleProvider);
        return null;
      } catch (_redirectError) {
        throw new Error("無法開啟登入視窗。請使用外部瀏覽器開啟。");
      }
    } else if (code === "auth/popup-closed-by-user") {
      throw new Error("登入視窗已關閉");
    } else if (code === "auth/operation-not-allowed") {
      throw new Error("Apple 登入未啟用。請在 Firebase Console 啟用。");
    }

    throw error;
  }
}

// Anonymous Sign-In (Guest Mode)
export async function signInAnonymously() {
  try {
    const result = await firebaseSignInAnonymously(auth);
    return result.user;
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/operation-not-allowed") {
      throw new Error("匿名登入未啟用。請在 Firebase Console 啟用。");
    }

    throw new Error("訪客登入失敗，請重試");
  }
}

// Email/Password Sign-Up
export async function signUpWithEmail(email: string, password: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/email-already-in-use") {
      throw new Error("此電子郵件已被使用");
    } else if (code === "auth/invalid-email") {
      throw new Error("電子郵件格式無效");
    } else if (code === "auth/weak-password") {
      throw new Error("密碼強度不足，至少需要 6 個字元");
    } else if (code === "auth/operation-not-allowed") {
      throw new Error("電子郵件登入未啟用");
    }

    throw new Error("註冊失敗，請重試");
  }
}

// Email/Password Sign-In
export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/invalid-email") {
      throw new Error("電子郵件格式無效");
    } else if (code === "auth/user-disabled") {
      throw new Error("此帳號已被停用");
    } else if (code === "auth/user-not-found") {
      throw new Error("找不到此電子郵件帳號");
    } else if (code === "auth/wrong-password") {
      throw new Error("密碼錯誤");
    } else if (code === "auth/invalid-credential") {
      throw new Error("電子郵件或密碼錯誤");
    }

    throw new Error("登入失敗，請重試");
  }
}

// Password Reset
export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/invalid-email") {
      throw new Error("電子郵件格式無效");
    } else if (code === "auth/user-not-found") {
      throw new Error("找不到此電子郵件帳號");
    }

    throw new Error("發送重設郵件失敗，請重試");
  }
}

// Link anonymous account to email/password
export async function linkAnonymousToEmail(email: string, password: string) {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) {
    throw new Error("只有訪客帳號可以綁定");
  }
  
  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(user, credential);
    return result.user;
  } catch (error: unknown) {
    const code = getFirebaseErrorCode(error);
    if (code === "auth/email-already-in-use") {
      throw new Error("此電子郵件已被其他帳號使用");
    } else if (code === "auth/weak-password") {
      throw new Error("密碼強度不足，至少需要 6 個字元");
    }

    throw new Error("帳號綁定失敗，請重試");
  }
}

// Check if current user is anonymous
export function isAnonymousUser(): boolean {
  return auth.currentUser?.isAnonymous ?? false;
}

export { onAuthStateChanged, type User };
