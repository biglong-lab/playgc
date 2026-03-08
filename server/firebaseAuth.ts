import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import type { Response, NextFunction } from "express";
import { storage } from "./storage";
import type { AuthenticatedRequest } from "./routes/types";

let firebaseAdmin: App | null = null;

function getFirebaseAdmin(): App {
  const apps = getApps();

  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  // Check if an app already exists
  if (apps.length > 0) {
    firebaseAdmin = apps[0];
    return firebaseAdmin;
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // 處理 private key 換行符：
    // .env 中可能是 "...\\n..." 或 "...\n..."
    // node --env-file 在雙引號內會把 \\n 解析成 \+換行符（charCode 92,10）
    // 需要移除多餘的反斜線，只保留真正的換行符
    let formattedPrivateKey = privateKey
      .replace(/\\\n/g, '\n')   // \+實際換行 → 只保留換行
      .replace(/\\n/g, '\n');   // literal \n → 實際換行

    try {
      firebaseAdmin = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });
    } catch {
      // 服務帳號初始化失敗，fallback 至僅 projectId 模式（token 驗證可能失敗）
      firebaseAdmin = initializeApp({ projectId });
    }
  } else {
    // 缺少服務帳號憑證，fallback 至僅 projectId 模式
    firebaseAdmin = initializeApp({ projectId });
  }
  
  return firebaseAdmin;
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken | null> {
  try {
    const app = getFirebaseAdmin();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (_error: unknown) {
    return null;
  }
}

export async function isAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[AUTH] 請求無 Authorization header:", req.path);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  console.log("[AUTH] 收到 token, 長度:", idToken.length, "路徑:", req.path);

  try {
    const decodedToken = await verifyFirebaseToken(idToken);

    if (!decodedToken) {
      console.log("[AUTH] Token 無效, 路徑:", req.path);
      return res.status(401).json({ message: "Invalid token" });
    }

    const userId = decodedToken.uid;
    let user = await storage.getUser(userId);
    
    if (!user) {
      user = await storage.upsertUser({
        id: userId,
        email: decodedToken.email || `user-${userId}@firebase.local`,
        firstName: decodedToken.name?.split(" ")[0] || null,
        lastName: decodedToken.name?.split(" ").slice(1).join(" ") || null,
        profileImageUrl: decodedToken.picture || null,
      });
    }

    req.user = {
      claims: {
        sub: userId,
      },
      dbUser: user,
    };

    next();
  } catch (_error) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const idToken = authHeader.split("Bearer ")[1];
  
  try {
    const decodedToken = await verifyFirebaseToken(idToken);
    
    if (decodedToken) {
      const userId = decodedToken.uid;
      const user = await storage.getUser(userId);
      
      if (user) {
        req.user = {
          claims: {
            sub: userId,
          },
          dbUser: user,
        };
      }
    }
  } catch (error) {
    // 忽略 optional auth 錯誤
  }
  
  next();
}
