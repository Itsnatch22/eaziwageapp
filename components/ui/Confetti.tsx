'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactConfetti from 'react-confetti';

/**
 * Standardized keys for one-time confetti celebrations.
 * Using a function that takes a userId ensures that if multiple users
 * use the same browser, they each get their own celebration.
 */
export const ConfettiKeys = {
  ONBOARDING: (id: string) => `confetti-onboarding-${id}`,
  FIRST_TRANSACTION: (id: string) => `confetti-first-tx-${id}`,
  KYC_APPROVAL: (id: string) => `confetti-kyc-appr-${id}`,
  FIRST_EMPLOYEE: (id: string) => `confetti-first-emp-${id}`,
};

interface ConfettiOptions {
  intensity?: 'low' | 'medium' | 'high';
  duration?: number;
}

/**
 * Hook to handle milestone celebrations.
 * Ensures the celebration only triggers once per key using localStorage.
 */
export function useMilestoneConfetti(key: string, options: ConfettiOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { intensity = 'medium', duration = 5000 } = options;

  // Handle window resize for full-screen confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerConfetti = useCallback(() => {
    // Safety check: don't trigger if already active or if it's been triggered before
    if (isActive) return;
    
    const hasTriggered = localStorage.getItem(key);
    if (hasTriggered) return;

    setIsActive(true);
    localStorage.setItem(key, 'true');

    // Stop confetti after the specified duration
    setTimeout(() => {
      setIsActive(false);
    }, duration);
  }, [key, isActive, duration]);

  const pieces = {
    low: 150,
    medium: 300,
    high: 600
  }[intensity];

  const ConfettiComponent = isActive ? (
    <ReactConfetti
      width={windowSize.width}
      height={windowSize.height}
      numberOfPieces={pieces}
      recycle={false}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    />
  ) : null;

  return { triggerConfetti, ConfettiComponent };
}
