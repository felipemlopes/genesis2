import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { geoEngine, GeoEvent } from '../services/geopoliticalEngine';

const STORAGE_KEY = 'genesis_geo_radar_active';

interface GeoEngineContextType {
  events: GeoEvent[];
  isScanning: boolean;
  chaosScore: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

const GeoEngineContext = createContext<GeoEngineContextType | undefined>(undefined);

export const useGeoEngine = () => {
  const ctx = useContext(GeoEngineContext);
  if (!ctx) throw new Error('useGeoEngine must be used within GeoEngineProvider');
  return ctx;
};

export const GeoEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<GeoEvent[]>(() => geoEngine.getEvents());
  const [isScanning, setIsScanning] = useState(() => geoEngine.isActive());
  const [chaosScore, setChaosScore] = useState(0);
  const initialized = useRef(false);

  // Subscribe to engine events
  useEffect(() => {
    const unsubscribe = geoEngine.subscribe((newEvents) => {
      setEvents(newEvents);
    });
    return () => { unsubscribe(); };
  }, []);

  // Compute chaos score from events
  useEffect(() => {
    if (events.length === 0) {
      setChaosScore(0);
      return;
    }
    const avg = events.reduce((sum, e) => sum + e.marketWeight, 0) / events.length;
    setChaosScore(Math.round(avg));
  }, [events]);

  // Auto-start from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true' && !geoEngine.isActive()) {
        geoEngine.start();
        setIsScanning(true);
      }
    } catch {
      // localStorage unavailable (private mode) — start inactive
    }
  }, []);

  const start = useCallback(() => {
    geoEngine.start();
    setIsScanning(true);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
  }, []);

  const stop = useCallback(() => {
    geoEngine.stop();
    setIsScanning(false);
    try { localStorage.setItem(STORAGE_KEY, 'false'); } catch {}
  }, []);

  const toggle = useCallback(() => {
    if (geoEngine.isActive()) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  return (
    <GeoEngineContext.Provider value={{ events, isScanning, chaosScore, start, stop, toggle }}>
      {children}
    </GeoEngineContext.Provider>
  );
};
