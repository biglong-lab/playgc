import { type ReactNode, useEffect } from "react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { reportClientEvent } from "@/lib/event-report";
import UseOnMobileScreen, { hasForceEnterFlag } from "./UseOnMobileScreen";

interface Props {
  children: ReactNode;
  requireMobile?: boolean;
  onBlocked?: (reason: "tablet" | "desktop") => void;
}

export default function DeviceGate({ children, requireMobile = true, onBlocked }: Props) {
  const device = useDeviceType();
  const forced = hasForceEnterFlag();

  useEffect(() => {
    if (!requireMobile) return;
    if (device.isMobile || forced) return;
    const reason = device.isTablet ? "tablet" : "desktop";
    onBlocked?.(reason);
    reportClientEvent({
      event: "device_gate_blocked",
      message: `non-mobile device blocked from gameplay (${reason})`,
      context: {
        deviceType: device.type,
        width: device.width,
        height: device.height,
        isPwa: device.isPwa,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      },
    });
  }, [requireMobile, device.isMobile, device.isTablet, device.type, device.width, device.height, device.isPwa, forced, onBlocked]);

  if (!requireMobile) return <>{children}</>;
  if (device.isMobile) return <>{children}</>;
  if (forced) return <>{children}</>;

  return <UseOnMobileScreen />;
}
