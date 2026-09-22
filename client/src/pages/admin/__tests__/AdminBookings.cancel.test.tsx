// 🚫 預約管理頁「取消預約」— 改用對話框（原因必填 + 確認），不再用原生 prompt
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();

vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/UnifiedAdminLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/admin/PublicBookingLinkCard", () => ({ default: () => null }));
vi.mock("@/providers/FieldThemeProvider", () => ({ useCurrentField: () => ({ code: "JIACHUN" }) }));
vi.mock("../booking/ScheduleEditor", () => ({ default: () => null }));

import AdminBookings from "../AdminBookings";

const BOOKING = {
  id: 1, bookingCode: "BK001", fieldId: "JIACHUN", lineUserId: "U1", displayName: "王小明",
  slotStart: "2026-09-24T06:00:00.000Z", slotEnd: "2026-09-24T07:00:00.000Z", partySize: 2,
  status: "confirmed", paymentStatus: "unpaid", amountCents: 0, createdAt: "",
};

function mockApi() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/cancel")) return { booking: { ...BOOKING, status: "cancelled" } };
    if (url.includes("/list")) return { bookings: [BOOKING] };
    return { activities: [] };
  });
}

const cancelCalls = () => mockFetch.mock.calls.filter(([url]) => String(url).includes("/cancel"));

describe("AdminBookings — 取消預約", () => {
  let promptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch.mockReset();
    mockApi();
    promptSpy = vi.spyOn(window, "prompt").mockReturnValue("x");
  });

  afterEach(() => {
    promptSpy.mockRestore();
  });

  it("按取消 → 開對話框、不用原生 prompt、尚未送出", async () => {
    render(<AdminBookings />);
    fireEvent.click(await screen.findByTestId("button-cancel-BK001"));
    expect(await screen.findByTestId("input-cancel-reason")).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(cancelCalls()).toHaveLength(0);
  });

  it("填原因 → 確認 → 以原因呼叫取消 API", async () => {
    render(<AdminBookings />);
    fireEvent.click(await screen.findByTestId("button-cancel-BK001"));
    fireEvent.change(await screen.findByTestId("input-cancel-reason"), { target: { value: "場地臨時維修" } });
    fireEvent.click(screen.getByTestId("button-cancel-next"));
    fireEvent.click(screen.getByTestId("button-cancel-confirm"));
    await waitFor(() => expect(cancelCalls()).toHaveLength(1));
    const [url, init] = cancelCalls()[0] as [string, { body: string }];
    expect(url).toBe("/api/admin/bookings/BK001/cancel");
    expect(JSON.parse(init.body)).toEqual({ reason: "場地臨時維修" });
  });
});
