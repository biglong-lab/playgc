// 💳 統一結帳頁 — /checkout/:productId
// 解析 productId 格式並路由到對應的購買流程
// 格式：game:{gameId} | battle-slot:{slotId} | chapter:{chapterId}
import { useEffect } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";

export default function Checkout() {
  const params = useParams<{ productId: string }>();
  const [, setLocation] = useLocation();
  const productId = decodeURIComponent(params.productId ?? "");

  useEffect(() => {
    if (!productId) return;
    const [type, id] = productId.split(":");

    switch (type) {
      case "game":
        setLocation(`/purchase/gate/${id}`);
        break;
      case "chapter":
        // 章節購買：走 PurchaseGate 並帶 chapter 參數
        setLocation(`/purchase/gate/${id}?scope=chapter`);
        break;
      case "battle-slot":
        // 對戰報名：直接到時段詳情頁
        setLocation(`/battle/slot/${id}`);
        break;
      default:
        // 未知類型：回首頁
        setLocation("/home");
    }
  }, [productId, setLocation]);

  // 如果 productId 無效，立即 redirect
  if (!productId) {
    return <Redirect to="/home" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">導向結帳流程...</p>
      </div>
    </div>
  );
}
