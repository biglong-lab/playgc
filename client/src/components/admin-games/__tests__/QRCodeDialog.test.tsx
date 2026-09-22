// 🔁 遊戲 QR 對話框「重新產生」— 會讓已印出的 QR 失效 → 必須先確認
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import QRCodeDialog from "../QRCodeDialog";

const GAME = { id: "g1", title: "賈村尋寶", publicSlug: "abc123", qrCodeUrl: "data:image/png;base64,xx" };

function renderDialog(onGenerate = vi.fn()) {
  render(<QRCodeDialog open onOpenChange={vi.fn()} game={GAME} onGenerate={onGenerate} isPending={false} />);
  return onGenerate;
}

describe("QRCodeDialog — 重新產生 QR 需確認", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("按重新產生 → 先跳確認、寫明已印出的 QR 會失效，尚未產生", async () => {
    const onGenerate = renderDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    expect(await screen.findByText(/已印出的 QR 會失效/)).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("確認後才以 regenerateSlug=true 重新產生", async () => {
    const onGenerate = renderDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    fireEvent.click(await screen.findByTestId("button-confirm-regenerate"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith("g1", true);
  });

  it("取消 → 不重新產生、確認框關閉", async () => {
    const onGenerate = renderDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    fireEvent.click(await screen.findByTestId("button-cancel-regenerate"));
    await waitFor(() => {
      expect(screen.queryByTestId("button-confirm-regenerate")).not.toBeInTheDocument();
    });
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
