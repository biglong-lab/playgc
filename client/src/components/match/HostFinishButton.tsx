// 🏁 房主「提前結束賽事」（大廳進行中畫面 / 遊戲頁等待畫面共用），先確認再結算，2026-09-23 P1
import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function HostFinishButton({ onFinish }: { onFinish: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full gap-2" onClick={() => setConfirming(true)} data-testid="button-finish-match">
        <Flag className="h-4 w-4" />
        提前結束賽事
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>現在就結束賽事？</AlertDialogTitle>
            <AlertDialogDescription>
              會以目前的成績排名，還在玩的人也會直接結束，這個動作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>繼續比賽</AlertDialogCancel>
            <AlertDialogAction onClick={onFinish} data-testid="button-confirm-finish-match">結束並公布結果</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
