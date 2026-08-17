import { useState, useEffect } from 'react';

export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  useEffect(() => {
    // Functions to handle online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineModal(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineModal(true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOfflineModal(true);
    }

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    showOfflineModal,
    closeOfflineModal: () => setShowOfflineModal(false)
  };
}