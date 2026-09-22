// 🏷️ 訪客暱稱小標籤（2026-09-22）
// 訪客進場自動取名（例如「探險家4271」）；組隊時隊友看得到名字，
// 讓訪客在組隊大廳就地改名（從 QR 直達組隊大廳的人不會經過大廳 header）。
// 非訪客（Google / LINE / Email 帳號）不顯示。
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AnonymousNameDialog } from "@/components/shared/AnonymousNameDialog";
import { GUEST_NAME_KEY, ensureGuestName } from "@/lib/guest-identity";

export default function GuestNameChip({ className = "" }: { className?: string }) {
  const { firebaseUser } = useAuth();
  // 只有訪客才產生暱稱（正式帳號不寫 localStorage，避免之後被當成暱稱送出）
  const [name, setName] = useState(() => (firebaseUser?.isAnonymous ? ensureGuestName() : ""));
  const [open, setOpen] = useState(false);

  if (!firebaseUser?.isAnonymous) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${className}`}
        data-testid="button-guest-name-chip"
      >
        你的暱稱：<span className="font-medium text-foreground">{name}</span>
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <AnonymousNameDialog
        open={open}
        initialName={name}
        onClose={() => setOpen(false)}
        onConfirm={(next) => {
          try { localStorage.setItem(GUEST_NAME_KEY, next); } catch { /* ignore */ }
          setName(next);
          setOpen(false);
        }}
      />
    </>
  );
}
