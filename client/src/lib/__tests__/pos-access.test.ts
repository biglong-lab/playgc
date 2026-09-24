// 🔐 POS / 現場模式可進入頁面規則（看不到就打不到：路由守門與按鈕顯示同源）
import { describe, it, expect } from "vitest";
import { isFieldStaffAllowedPath, canOpenPage, POS_ADMIN_PAGE_PERMISSIONS } from "../pos-access";

const allow = () => true;
const deny = () => false;
const only = (...keys: string[]) => (p: string) => keys.includes(p);

describe("isFieldStaffAllowedPath — 現場人員可停留的頁面", () => {
  it("/pos 底下全部允許", () => {
    expect(isFieldStaffAllowedPath("/pos")).toBe(true);
    expect(isFieldStaffAllowedPath("/pos/cash")).toBe(true);
  });

  it("排解中心與 QR 列印允許", () => {
    expect(isFieldStaffAllowedPath("/admin/troubleshoot")).toBe(true);
    expect(isFieldStaffAllowedPath("/admin/troubleshoot/reset")).toBe(true);
    expect(isFieldStaffAllowedPath("/admin/scenario-qr-print")).toBe(true);
  });

  it("後台管理頁（品項 / 報表 / 垃圾桶）不允許", () => {
    expect(isFieldStaffAllowedPath("/admin/pos-products")).toBe(false);
    expect(isFieldStaffAllowedPath("/admin/pos-reports")).toBe(false);
    expect(isFieldStaffAllowedPath("/admin/pos-trash")).toBe(false);
    expect(isFieldStaffAllowedPath("/admin")).toBe(false);
  });
});

describe("canOpenPage — 依角色 + 頁面實際要求權限判斷", () => {
  it("現場人員即使有權限鍵，也進不了非現場頁", () => {
    const access = { systemRole: "field_executor", hasPermission: allow };
    expect(canOpenPage("/admin/pos-products", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-products"])).toBe(false);
    expect(canOpenPage("/admin/troubleshoot", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/troubleshoot"])).toBe(true);
  });

  it("一般管理員缺少該頁權限 → 不能開", () => {
    const access = { systemRole: "custom", hasPermission: only("game:view") };
    expect(canOpenPage("/admin/pos-reports", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-reports"])).toBe(false);
    expect(canOpenPage("/admin/pos-products", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-products"])).toBe(false);
    expect(canOpenPage("/admin/troubleshoot", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/troubleshoot"])).toBe(true);
  });

  it("具備權限的管理員 → 能開", () => {
    const access = { systemRole: "field_director", hasPermission: only("pos:manage", "pos_cash_admin") };
    expect(canOpenPage("/admin/pos-reports", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-reports"])).toBe(true);
    expect(canOpenPage("/admin/pos-trash", access, POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-trash"])).toBe(true);
  });

  it("不需權限的頁面只看角色白名單", () => {
    expect(canOpenPage("/pos/scan", { systemRole: "field_executor", hasPermission: deny })).toBe(true);
  });

  it("權限對照與後端一致：報表 = pos_cash_admin、品項 / 垃圾桶 = pos:manage", () => {
    expect(POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-reports"]).toBe("pos_cash_admin");
    expect(POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-products"]).toBe("pos:manage");
    expect(POS_ADMIN_PAGE_PERMISSIONS["/admin/pos-trash"]).toBe("pos:manage");
  });
});
