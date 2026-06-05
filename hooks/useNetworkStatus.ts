"use client";

import { useEffect, useState, useCallback } from "react";

interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const verifyConnectivity = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/admin/check-api-health", {
        method: "HEAD",
        cache: "no-store",
      });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    verifyConnectivity();

    const handleOnline = () => verifyConnectivity();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [verifyConnectivity]);

  return { isOnline, isChecking };
}