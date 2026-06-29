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
      const res = await fetch("/api/ping", {
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

  const handleOnline = useCallback(() => {
    verifyConnectivity();
  }, [verifyConnectivity]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(verifyConnectivity, 0);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [verifyConnectivity, handleOnline, handleOffline]);

  return { isOnline, isChecking };
}