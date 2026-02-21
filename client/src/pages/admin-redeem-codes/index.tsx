// 兌換碼管理主頁 — Tab: 兌換碼 / 購買記錄 / 現金收款
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Ticket, ShoppingCart, Banknote } from "lucide-react";
import type { Game, GameChapter } from "@shared/schema";
import { useRedeemCodes } from "./useRedeemCodes";
import { CodeTable } from "./CodeTable";
import { CreateCodeDialog } from "./CreateCodeDialog";
import { GrantAccessDialog } from "./GrantAccessDialog";
import { PurchaseHistory } from "./PurchaseHistory";

export default function AdminRedeemCodes() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location, setLocation] = useLocation();
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";

  const { data: game } = useQuery<Game>({
    queryKey: [`/api/admin/games/${gameId}`],
    enabled: !!gameId,
  });

  const { data: chapters = [] } = useQuery<GameChapter[]>({
    queryKey: [`/api/admin/games/${gameId}/chapters`],
    enabled: !!gameId,
  });

  const {
    codes,
    purchases,
    isLoading,
    createCode,
    batchCreateCodes,
    updateCode,
    deleteCode,
    grantAccess,
    revokePurchase,
  } = useRedeemCodes(gameId ?? "", isAdminStaff);

  const [tab, setTab] = useState("codes");

  if (!gameId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`${basePath}/${gameId}`)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">票券管理</h1>
              <p className="text-sm text-muted-foreground">{game?.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <GrantAccessDialog
              chapters={chapters}
              onGrantAccess={(data) => grantAccess.mutate(data)}
              isGranting={grantAccess.isPending}
            />
            <CreateCodeDialog
              chapters={chapters}
              onCreateSingle={(data) => createCode.mutate(data)}
              onCreateBatch={(data) => batchCreateCodes.mutate(data)}
              isCreating={createCode.isPending || batchCreateCodes.isPending}
            />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="codes" className="gap-2">
                <Ticket className="w-4 h-4" />
                兌換碼 ({codes.length})
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-2">
                <ShoppingCart className="w-4 h-4" />
                購買記錄 ({purchases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="codes" className="mt-4">
              <CodeTable
                codes={codes}
                onDisable={(id) => updateCode.mutate({ id, status: "disabled" })}
                onDelete={(id) => deleteCode.mutate(id)}
              />
            </TabsContent>

            <TabsContent value="purchases" className="mt-4">
              <PurchaseHistory
                purchases={purchases}
                onRevoke={(id) => revokePurchase.mutate(id)}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
