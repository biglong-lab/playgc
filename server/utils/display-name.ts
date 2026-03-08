/** 組合使用者顯示名稱（姓 + 名，無則用 ID 前 6 碼） */
export function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  odId: string,
): string {
  if (firstName || lastName) return [lastName, firstName].filter(Boolean).join("");
  return `玩家${odId.slice(0, 6)}`;
}
