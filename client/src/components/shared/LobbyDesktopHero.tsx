import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Gamepad2, Camera, MapPin, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrentField } from "@/providers/FieldThemeProvider";

interface Props {
  fieldName?: string;
  tagline?: string | null;
  welcomeMessage?: string | null;
}

const FEATURES = [
  { icon: Gamepad2, label: "互動關卡", desc: "QR / GPS / 拍照" },
  { icon: Camera, label: "現場拍照", desc: "團體合照、紀念照" },
  { icon: MapPin, label: "場域探索", desc: "地圖導引任務" },
  { icon: Trophy, label: "排行榜", desc: "競技與分數" },
];

/**
 * LobbyDesktopHero — 桌機 / 平板大廳的商品展示 Hero 區
 *
 * 只在 desktop / tablet 顯示（class="desktop-only md:block"）；手機自動隱藏。
 * 顯示：場域簡介 + 功能亮點 + 用手機掃 QR 開始玩 CTA。
 */
export default function LobbyDesktopHero({ fieldName, tagline, welcomeMessage }: Props) {
  const field = useCurrentField();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const name = fieldName ?? field?.name ?? "賈村數位遊戲";
  const subtitle = tagline ?? field?.tagline ?? welcomeMessage ?? field?.welcomeMessage ?? "用手機開啟一場真實世界的遊戲";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#111827", light: "#ffffff" } })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hidden md:block">
      <Card className="overflow-hidden mb-8 border-slate-200 dark:border-slate-700">
        <div className="grid md:grid-cols-3 gap-6 p-8">
          {/* 左：介紹 */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {name}
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-300">{subtitle}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.label}
                    className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {f.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右：手機 QR */}
          <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                掃描以手機玩
              </p>
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="掃描以手機開啟此場域"
                className="w-40 h-40 rounded-md border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-40 h-40 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
              手機相機掃描即可進入
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
