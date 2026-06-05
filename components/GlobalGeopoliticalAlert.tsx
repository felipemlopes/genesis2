import React, { useEffect, useState, useRef } from 'react';
import { Globe, AlertTriangle, X, ArrowRight, MapPin, ExternalLink } from 'lucide-react';
import { GeoEvent } from '../services/geopoliticalEngine';
import { useGeoEngine } from '../contexts/GeoEngineContext';

interface Props {
  onNavigateToRadar: () => void;
}

const GlobalGeopoliticalAlert: React.FC<Props> = ({ onNavigateToRadar }) => {
  const { events } = useGeoEngine();
  const [alert, setAlert] = useState<GeoEvent | null>(null);
  const prevEventsLengthRef = useRef(events.length);

  useEffect(() => {
    // Detect new critical events by comparing with previous events count
    if (events.length > prevEventsLengthRef.current) {
      const newEvents = events.slice(prevEventsLengthRef.current);
      const criticalEvent = newEvents.find(e => e.relevance >= 8);
      if (criticalEvent) {
        setAlert(criticalEvent);

        // Auto-hide after 10 seconds
        setTimeout(() => {
          setAlert(null);
        }, 10000);
      }
    }
    prevEventsLengthRef.current = events.length;
  }, [events]);

  if (!alert) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[2000] animate-in slide-in- fade-in duration-500">
      <div className="bg-genesis-card border-genesis-negative rounded-[10px] p-[16px] shadow-[0_0_30px_rgba(239,68,68,0.2)] max-w-sm w-full relative overflow-hidden group">
        
        {/* Pulsing background effect */}
        <div className="absolute inset-0 bg-genesis-negative/5 animate-pulse"></div>
        
        {/* Top accent line */}
        <div className="absolute top-0 left-0 w-full h-1  danger "></div>

        <button 
          onClick={() => setAlert(null)}
          className="absolute top-3 right-3 text-genesis-muted hover:text-genesis-text transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-[16px] relative z-10">
          <div className="w-10 h-10 rounded-full bg-genesis-negative/20 flex items-center justify-center flex-shrink-0 relative">
            <div className="absolute inset-0 rounded-full border-genesis-negative animate-ping opacity-75"></div>
            <Globe className="w-5 h-5 text-genesis-negative animate-pulse" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-genesis-negative uppercase tracking-wider bg-genesis-negative/10 px-2 py-0.5 rounded">
                Alerta Global
              </span>
              <span className="text-xs text-genesis-muted">
                Pontuação: {alert.relevance}/10
              </span>
            </div>
            
            <h4 className="text-sm font-bold text-genesis-text mb-1 leading-tight">
              {alert.title}
            </h4>
            
            {alert.location && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-blue-400 bg-blue-500/10 w-fit px-2 py-0.5 rounded border-blue-500/20">
                <MapPin size={10} />
                <span className="font-mono tracking-wide">{alert.location}</span>
                {alert.sourceUrl && (
                  <a 
                    href={alert.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="ml-2 flex items-center gap-1 text-[10px] text-blue-300 hover:text-white transition-colors border-blue-500/30 pl-2"
                  >
                    <span className="font-bold">VER FONTE</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
            
            <p className="text-xs text-genesis-muted mb-3 line-clamp-2">
              {alert.summary}
            </p>

            <button 
              onClick={() => {
                setAlert(null);
                onNavigateToRadar();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-genesis-negative/10 hover:bg-genesis-negative/20 text-genesis-negative text-xs font-medium rounded-lg transition-colors border-genesis-negative/30"
            >
              Abrir Radar News
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalGeopoliticalAlert;
