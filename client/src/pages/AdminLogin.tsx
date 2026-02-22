// 已棄用 — 重導向到統一登入頁
import { Redirect } from "wouter";

export default function AdminLogin() {
  return <Redirect to="/admin/login" />;
}
