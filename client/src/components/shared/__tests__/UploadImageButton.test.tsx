// 🐛 2026-09-24：活動封面上傳明明成功卻顯示「上傳失敗」
//   根因：後端各端點回傳的欄位名不同（場域 url / 遊戲 coverImageUrl / 活動 coverUrl），
//   元件只認前兩種 → 活動封面永遠失敗；使用者接著按儲存，空封面又把剛存好的圖蓋掉。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockFetch, mockToast } = vi.hoisted(() => ({ mockFetch: vi.fn(), mockToast: vi.fn() }));
vi.mock("@/pages/admin-staff/types", () => ({ fetchWithAdminAuth: mockFetch }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/lib/image-compress", () => ({
  compressImageToDataUrl: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
}));
vi.mock("@/components/shared/OptimizedImage", () => ({ default: () => null }));

import { UploadImageButton } from "../UploadImageButton";

/** CDN 同步檢查：測試環境讓 Image 立刻 onload，不然要等 20 秒 */
class InstantImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

async function uploadFile() {
  const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
  const input = screen.getByTestId("cover-file") as HTMLInputElement;
  await userEvent.upload(input, file);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Image", InstantImage);
});

describe("UploadImageButton — 各端點回傳欄位", () => {
  it.each([
    ["場域端點 url", { url: "https://cdn/a.jpg" }],
    ["遊戲端點 coverImageUrl", { coverImageUrl: "https://cdn/a.jpg" }],
    ["活動端點 coverUrl", { coverUrl: "https://cdn/a.jpg" }],
    ["cloudinary secure_url", { secure_url: "https://cdn/a.jpg" }],
  ])("%s → 視為成功並回傳網址", async (_label, response) => {
    mockFetch.mockResolvedValue(response);
    const onUploaded = vi.fn();
    render(<UploadImageButton endpoint="/api/admin/activities/a1/cover" onUploaded={onUploaded} testId="cover" />);
    await uploadFile();
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("https://cdn/a.jpg"));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "上傳失敗" }));
  });

  it("真的沒有網址 → 才顯示上傳失敗，且不通知上層（避免寫入空值）", async () => {
    mockFetch.mockResolvedValue({ message: "ok" });
    const onUploaded = vi.fn();
    render(<UploadImageButton endpoint="/api/admin/activities/a1/cover" onUploaded={onUploaded} testId="cover" />);
    await uploadFile();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "上傳失敗" })),
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
