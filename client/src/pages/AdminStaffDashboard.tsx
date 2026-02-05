import { useQuery } from "@tanstack/react-query";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Gamepad2, Activity } from "lucide-react";

async function fetchWithAdminAuth(url: string) {
  const token = localStorage.getItem("adminToken");
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch");
  }
  
  return response.json();
}

export default function AdminStaffDashboard() {
  const { data: fields } = useQuery({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
  });

  const { data: roles } = useQuery({
    queryKey: ["/api/admin/roles"],
    queryFn: () => fetchWithAdminAuth("/api/admin/roles"),
  });

  const { data: accounts } = useQuery({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => fetchWithAdminAuth("/api/admin/accounts"),
  });

  const stats = [
    {
      title: "場域數量",
      value: fields?.length || 0,
      icon: Building2,
      description: "已建立的場域",
    },
    {
      title: "角色數量",
      value: roles?.length || 0,
      icon: Users,
      description: "已定義的角色",
    },
    {
      title: "管理員帳號",
      value: accounts?.length || 0,
      icon: Gamepad2,
      description: "系統管理員",
    },
    {
      title: "線上管理員",
      value: "-",
      icon: Activity,
      description: "目前在線",
    },
  ];

  return (
    <AdminStaffLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">管理儀表板</h1>
          <p className="text-muted-foreground">系統總覽與快速操作</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用管理功能</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/admin-staff/accounts"
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                data-testid="link-manage-accounts"
              >
                <div className="font-medium">管理員帳號管理</div>
                <div className="text-sm text-muted-foreground">新增、編輯或停用管理員帳號</div>
              </a>
              <a
                href="/admin-staff/roles"
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                data-testid="link-manage-roles"
              >
                <div className="font-medium">角色權限設定</div>
                <div className="text-sm text-muted-foreground">設定角色與權限對應關係</div>
              </a>
              <a
                href="/admin-staff/qrcodes"
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                data-testid="link-qrcodes"
              >
                <div className="font-medium">遊戲 QR Code</div>
                <div className="text-sm text-muted-foreground">產生與管理遊戲專屬 QR Code</div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>系統資訊</CardTitle>
              <CardDescription>目前登入狀態</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">登入時間</span>
                  <span className="text-sm">{new Date().toLocaleString("zh-TW")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">系統版本</span>
                  <span className="text-sm">1.0.0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminStaffLayout>
  );
}
