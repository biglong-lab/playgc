// 📝 公開場域申請頁 — /apply
// 任何人都可以送出申請，不需登入
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Building2,
} from "lucide-react";

const BUSINESS_TYPES = [
  { value: "homestay", label: "🏡 民宿" },
  { value: "camp", label: "⛺ 營隊" },
  { value: "tourism", label: "🗺️ 觀光地" },
  { value: "school", label: "🏫 學校" },
  { value: "enterprise", label: "🏢 企業" },
  { value: "event", label: "🎪 活動公司" },
  { value: "other", label: "✨ 其他" },
];

const PREFERRED_PLANS = [
  { value: "free", label: "🆓 免費版（測試用）" },
  { value: "pro", label: "💼 專業版 NT$ 1,999/月" },
  { value: "enterprise", label: "🚀 企業版（客製報價）" },
  { value: "revshare", label: "🤝 分潤合作" },
];

export default function Apply() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    businessName: "",
    businessType: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    preferredFieldCode: "",
    address: "",
    expectedPlayersPerMonth: "",
    preferredPlan: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.businessName || !form.businessType || !form.contactName || !form.contactEmail) {
      toast({ title: "請填寫必填欄位", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        expectedPlayersPerMonth: form.expectedPlayersPerMonth
          ? Number(form.expectedPlayersPerMonth)
          : undefined,
        preferredFieldCode: form.preferredFieldCode.toUpperCase() || undefined,
        preferredPlan: form.preferredPlan || undefined,
      };
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "送出失敗",
          description: data.error ?? "請檢查資料後重試",
          variant: "destructive",
        });
        return;
      }

      setSubmitted(true);
      toast({ title: "✅ 申請已送出！" });
    } catch (err) {
      toast({
        title: "網路錯誤",
        description: "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold mb-2">申請已送出！</h1>
            <p className="text-muted-foreground text-sm mb-6">
              我們已收到您的申請，將在 3 個工作天內透過 Email 與您聯絡。
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-1 mb-6">
              <p>📧 聯絡 Email：{form.contactEmail}</p>
              <p>🏢 商業名稱：{form.businessName}</p>
            </div>
            <Link href="/">
              <Button className="w-full">返回首頁</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-blue-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold mb-2">🌐 申請場域開通</h1>
          <p className="text-muted-foreground">
            加入賈村遊戲雲，為您的場域開通互動遊戲與對戰體驗
          </p>
        </div>

        {/* 說明 */}
        <Card className="mb-6 border-blue-200">
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-2">✨ 我們提供</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>🎮 QR Code 解謎遊戲</div>
              <div>⚔️ 水彈對戰預約系統</div>
              <div>💳 付費與兌換碼管理</div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="商業名稱"
                  required
                  value={form.businessName}
                  onChange={(v) => setForm({ ...form, businessName: v })}
                  placeholder="例：賈村民宿"
                />

                <div>
                  <Label>
                    類型 <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={form.businessType}
                    onValueChange={(v) => setForm({ ...form, businessType: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="選擇商業類型" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="聯絡人姓名"
                  required
                  value={form.contactName}
                  onChange={(v) => setForm({ ...form, contactName: v })}
                  placeholder="請填真實姓名"
                />
                <Field
                  label="聯絡 Email"
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(v) => setForm({ ...form, contactEmail: v })}
                  placeholder="you@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="聯絡電話"
                  value={form.contactPhone}
                  onChange={(v) => setForm({ ...form, contactPhone: v })}
                  placeholder="選填"
                />
                <Field
                  label="希望的場域代碼"
                  value={form.preferredFieldCode}
                  onChange={(v) =>
                    setForm({ ...form, preferredFieldCode: v.toUpperCase() })
                  }
                  placeholder="例：JIACHUN（3-20 字母數字）"
                  helper="管理員登入時使用。英數 3-20 字，會自動轉大寫"
                />
              </div>

              <Field
                label="地址"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                placeholder="選填"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="預估每月玩家數"
                  type="number"
                  value={form.expectedPlayersPerMonth}
                  onChange={(v) =>
                    setForm({ ...form, expectedPlayersPerMonth: v })
                  }
                  placeholder="選填"
                />

                <div>
                  <Label>期望方案</Label>
                  <Select
                    value={form.preferredPlan}
                    onValueChange={(v) => setForm({ ...form, preferredPlan: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="選填" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREFERRED_PLANS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>備註（選填）</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  placeholder="告訴我們您的使用場景、預期功能等"
                  className="mt-1.5"
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {isSubmitting ? "送出中..." : "送出申請"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                送出後，我們會在 3 個工作天內透過 Email 與您聯絡
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link href="/">
            <Button variant="link" size="sm">
              ← 返回首頁
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// 簡化輸入欄位元件
function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  helper?: string;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5"
      />
      {helper && (
        <p className="text-[11px] text-muted-foreground mt-1">{helper}</p>
      )}
    </div>
  );
}
