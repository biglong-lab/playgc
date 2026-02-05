import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

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
    // Use service account credentials for production
    // Handle both literal \n (from env vars) and actual newlines
    let formattedPrivateKey = privateKey;
    if (privateKey.includes("\\n")) {
      formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    }

    try {
      firebaseAdmin = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });
    } catch (initError: any) {
      console.error("[Firebase Admin] Init error:", initError?.message || initError);
      // Fallback - this likely won't work for token verification
      firebaseAdmin = initializeApp({ projectId });
    }
  } else {
    // Fallback to project ID only (may not work for token verification)
    console.warn("[Firebase Admin] Missing FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY");
    console.warn("[Firebase Admin] Token verification may fail without proper service account credentials");
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
  } catch (error: any) {
    return null;
  }
}

export async function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  
  try {
    const decodedToken = await verifyFirebaseToken(idToken);
    
    if (!decodedToken) {
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

    (req as any).user = {
      claims: {
        sub: userId,
      },
      dbUser: user,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function optionalAuth(
  req: Request,
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
        (req as any).user = {
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
