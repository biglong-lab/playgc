// 觸發 WelcomeSquadsDialog 的 wrapper —
// 監聽 currentField + user 變化，自動決定何時顯示
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §14
//
import { useAuth } from "@/hooks/useAuth";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import WelcomeSquadsDialog from "./WelcomeSquadsDialog";

export default function WelcomeSquadsTrigger() {
  const { user, isSignedIn } = useAuth();
  const field = useCurrentField();

  // 沒登入 / 沒場域 → 不顯示
  if (!isSignedIn || !user?.id || !field?.fieldId) return null;

  return (
    <WelcomeSquadsDialog
      fieldId={field.fieldId}
      fieldName={field.name ?? "新場域"}
      userId={user.id}
      enabled
    />
  );
}
