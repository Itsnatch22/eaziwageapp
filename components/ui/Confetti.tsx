'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import Confetti from 'react-confetti';

export type ConfettiIntensity = 'light' | 'medium' | 'high';

interface ConfettiProps {
  intensity?: ConfettiIntensity;
  duration?: number;
  onComplete?: () => void;
}

// Brand colors for EaziWage - blues, greens, warm accents
const BRAND_COLORS = [
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

const INTENSITY_CONFIG = {
  light: { pieces: 150, duration: 3000 },
  medium: { pieces: 200, duration: 4000 },
  high: { pieces: 250, duration: 5000 },
};

const subscribeToWindowResize = (callback: () => void) => {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
};

const getWindowSizeSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;
const getServerWindowSizeSnapshot = () => '0x0';

export function MilestoneConfetti({
  intensity = 'medium',
  duration,
  onComplete,
}: ConfettiProps) {
  const config = INTENSITY_CONFIG[intensity];
  const actualDuration = duration || config.duration;
  
  const windowSizeSnapshot = useSyncExternalStore(
    subscribeToWindowResize,
    getWindowSizeSnapshot,
    getServerWindowSizeSnapshot
  );
  const [width, height] = windowSizeSnapshot.split('x').map(Number);

  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, actualDuration);
      return () => clearTimeout(timer);
    }
  }, [actualDuration, onComplete]);

  if (!width || !height) return null;

  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={config.pieces}
      recycle={false}
      gravity={0.15}
      colors={BRAND_COLORS}
      run={true}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

// Hook for triggering confetti with localStorage tracking
interface UseConfettiOptions {
  key: string; // unique key for tracking (e.g., 'confetti_first_advance_user123')
  intensity?: ConfettiIntensity;
  duration?: number;
}

export function useMilestoneConfetti({ key, intensity = 'medium', duration }: UseConfettiOptions) {
  const [showConfetti, setShowConfetti] = React.useState(false);

  const triggerConfetti = useCallback(() => {
    // Check if this milestone has already been celebrated
    const hasSeenConfetti = localStorage.getItem(key);
    
    if (!hasSeenConfetti) {
      setShowConfetti(true);
      localStorage.setItem(key, 'true');
    }
  }, [key]);

  const handleComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return {
    showConfetti,
    triggerConfetti,
    ConfettiComponent: showConfetti ? (
      <MilestoneConfetti 
        intensity={intensity} 
        duration={duration}
        onComplete={handleComplete} 
      />
    ) : null,
  };
}

// Utility functions for generating milestone keys
export const ConfettiKeys = {
  firstAdvance: (userId: string) => `confetti_first_advance_${userId}`,
  onboarding: (userId: string) => `confetti_onboarding_${userId}`,
  kycApproved: (userId: string) => `confetti_kyc_approved_${userId}`,
  firstEmployee: (orgId: string) => `confetti_first_employee_${orgId}`,
};

export default MilestoneConfetti;
