// 🌐 GPS 定位工具集中入口
//
// 用法：
//   import { useStableGeolocation, distanceMeters, classifyAccuracy } from "@/lib/geolocation";

export {
  distanceMeters,
  bearingDegrees,
  bearingToCompass,
  formatDistance,
  classifyAccuracy,
  describeQuality,
  median,
  type GpsQuality,
} from "./geo-utils";

export {
  useStableGeolocation,
  type StablePosition,
  type UseStableGeolocationOptions,
  type UseStableGeolocationResult,
} from "./useStableGeolocation";

export {
  useTeamGpsFusion,
  type UseTeamGpsFusionOptions,
  type UseTeamGpsFusionResult,
} from "./useTeamGpsFusion";

export {
  fuseTeamGps,
  type FusionSample,
  type FusionResult,
  GPS_BROADCAST_INTERVAL_MS,
} from "./fusion-utils";
