import { type ReactNode, useEffect } from "react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { reportClientEvent } from "@/lib/event-report";
import UseOnMobileScreen, { hasForceEnterFlag } from "./UseOnMobileScreen";

interface Props {
  children: ReactNode;
  /** 是否需要行動裝置（手機 / 平板）才能進入；true = 桌機會被擋 */
  requireMobile?: boolean;
  onBlocked?: (reason: "desktop") => void;
}

// 🆕 2026-05-20 業主回報：平板也應該可玩、只擋桌機
// 原本 requireMobile=true 只放行 mobile、現在改為「mobile + tablet 都放行、只擋 desktop」
export default function DeviceGate({ children, requireMobile = true, onBlocked }: Props) {
  const device = useDeviceType();
  const forced = hasForceEnterFlag();

  const allowed = device.isMobile || device.isTablet;

  useEffect(() => {
    if (!requireMobile) return;
    if (allowed || forced) return;
    onBlocked?.("desktop");
    reportClientEvent({
      event: "device_gate_blocked",
      message: "desktop device blocked from gameplay",
      context: {
        deviceType: device.type,
        width: device.width,
        height: device.height,
        isPwa: device.isPwa,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      },
    });
  }, [requireMobile, allowed, device.type, device.width, device.height, device.isPwa, forced, onBlocked]);

  if (!requireMobile) return <>{children}</>;
  if (allowed) return <>{children}</>;
  if (forced) return <>{children}</>;

  return <UseOnMobileScreen />;
}
