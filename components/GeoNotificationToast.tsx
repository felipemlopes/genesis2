import React, { useEffect, useRef } from 'react';
import { Globe, MapPin, X } from 'lucide-react';
import { useGeoEngine } from '../contexts/GeoEngineContext';
import { GeoEvent } from '../services/geopoliticalEngine';

interface ToastItemProps {
  event: GeoEvent;
  onDismiss: (id: string) => void;
  onNavigate: () => void;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10',
  HIGH: 'text-orange-400 bg-orange-500/10',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10',
  LOW: 'text-blue-400 bg-blue-500/10',
};

const ToastItem: React.FC<ToastItemProps> = ({ event, onDismiss, onNavigate }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(event.id);
    }, 10000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event.id, onDismiss]);

  const colorClass = severityColors[event.severity] || severityColors.LOW;

  return (
    <div
      onClick={onNavigate}
      className="bg-genesis-card border border-white/10 rounded-lg p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer hover:border-white/20 transition-all animate-in slide-in-from-right fade-in duration-300 max-w-sm w-full"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-genesis-positive/10 flex items-center justify-center flex-shrink-0">
          <Globe className="w-4 h-4 text-genesis-positive" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colorClass}`}>
              {event.severity}
            </span>
          </div>

          <h4 className="text-xs font-semibold text-white truncate mb-1">
            {event.title}
          </h4>

          {event.location && (
            <div className="flex items-center gap-1 text-[10px] text-genesis-text-secondary">
              <MapPin size={10} />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(event.id); }}
          className="text-genesis-text-secondary hover:text-white transition-colors flex-shrink-0"
          aria-label="Fechar notificação"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

interface GeoNotificationToastProps {
  onNavigateToRadar: () => void;
}

const GeoNotificationToast: React.FC<GeoNotificationToastProps> = ({ onNavigateToRadar }) => {
  const { pendingToastEvents, dismissToast, isOnRadarPage } = useGeoEngine();

  if (isOnRadarPage || pendingToastEvents.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[1900] flex flex-col gap-2">
      {pendingToastEvents.slice(0, 3).map(event => (
        <ToastItem
          key={event.id}
          event={event}
          onDismiss={dismissToast}
          onNavigate={onNavigateToRadar}
        />
      ))}
    </div>
  );
};

export default GeoNotificationToast;
