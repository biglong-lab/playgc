// 認證 fetch 輔助 — 自動附帶 Firebase token
import { getIdToken } from "@/lib/firebase";

export async function authFetch(url: string, options: RequestInit = {}) {
  const token = await getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });
}
