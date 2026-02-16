// 地圖定位追蹤 Hook
import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { calculateDistance, calculateNavigation } from "@/lib/map-utils";
import type { Location } from "@shared/schema";
import type { NavigationInfo } from "@/lib/map-utils";

interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface UseMapGeolocationOptions {
  sessionId?: string;
  locations: Location[];
  visitedLocationIds: Set<number>;
  selectedLocation: Location | null;
  onUserMarkerUpdate: (lat: number, lng: number) => void;
}

export function useMapGeolocation({
  sessionId,
  locations,
  visitedLocationIds,
  selectedLocation,
  onUserMarkerUpdate,
}: UseMapGeolocationOptions) {
  const { toast } = useToast();

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [navigationInfo, setNavigationInfo] = useState<NavigationInfo | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // 為了避免 callback 中取到過期的 ref，用 ref 保存最新值
  const selectedLocationRef = useRef(selectedLocation);
  selectedLocationRef.current = selectedLocation;

  const updateLocationMutation = useMutation({
    mutationFn: async (location: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
    }) => {
      if (!sessionId) return;
      return apiRequest('POST', `/api/sessions/${sessionId}/player-location`, location);
    },
  });

  const checkProximityToLocations = useCallback((lat: number, lng: number) => {
    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;
      const locLat = parseFloat(location.latitude);
      const locLng = parseFloat(location.longitude);
      const distance = calculateDistance(lat, lng, locLat, locLng);
      const radius = location.radius || 50;

      if (distance <= radius && !visitedLocationIds.has(location.id)) {
        toast({
          title: "接近任務點!",
          description: `你已進入 ${location.name} 的範圍`,
        });
      }
    });
  }, [locations, visitedLocationIds, toast]);

  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setUserLocation({ lat: latitude, lng: longitude, accuracy });
    onUserMarkerUpdate(latitude, longitude);

    if (sessionId) {
      updateLocationMutation.mutate({
        latitude,
        longitude,
        accuracy: accuracy || undefined,
        speed: speed || undefined,
        heading: heading || undefined,
      });
    }

    checkProximityToLocations(latitude, longitude);

    // 更新導航資訊
    const sel = selectedLocationRef.current;
    if (sel?.latitude && sel?.longitude) {
      const locLat = parseFloat(sel.latitude);
      const locLng = parseFloat(sel.longitude);
      setNavigationInfo(calculateNavigation(latitude, longitude, locLat, locLng));
    }
  }, [sessionId, updateLocationMutation, onUserMarkerUpdate, checkProximityToLocations]);

  // 當選取的地點改變時，重新計算導航
  useEffect(() => {
    if (userLocation && selectedLocation?.latitude && selectedLocation?.longitude) {
      const locLat = parseFloat(selectedLocation.latitude);
      const locLng = parseFloat(selectedLocation.longitude);
      setNavigationInfo(calculateNavigation(userLocation.lat, userLocation.lng, locLat, locLng));
    } else {
      setNavigationInfo(null);
    }
  }, [selectedLocation, userLocation]);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("你的瀏覽器不支援定位功能");
      toast({
        title: "定位失敗",
        description: "你的瀏覽器不支援定位功能",
        variant: "destructive",
      });
      return null;
    }

    setIsLocating(true);
    setLocationError(null);

    return new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationUpdate(position);
          setIsLocating(false);
          resolve(position);
        },
        (error) => {
          setIsLocating(false);
          let message = "無法取得你的位置";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "請允許位置存取權限";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "無法取得位置資訊";
              break;
            case error.TIMEOUT:
              message = "定位請求超時";
              break;
          }
          setLocationError(message);
          toast({
            title: "定位失敗",
            description: message,
            variant: "destructive",
          });
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [handleLocationUpdate, toast]);

  const startContinuousTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    const id = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      () => { /* 定位錯誤由 UI 處理 */ },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    setWatchId(id);
    toast({
      title: "持續追蹤已開啟",
      description: "你的位置會自動更新",
    });
  }, [watchId, handleLocationUpdate, toast]);

  const stopContinuousTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      toast({ title: "持續追蹤已關閉" });
    }
  }, [watchId, toast]);

  // 清理 watchPosition
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    userLocation,
    isLocating,
    locationError,
    navigationInfo,
    isTracking: watchId !== null,
    locateUser,
    startContinuousTracking,
    stopContinuousTracking,
  };
}
