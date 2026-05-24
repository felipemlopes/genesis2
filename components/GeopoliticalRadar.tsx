import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Globe, Crosshair, X, MapPin, ExternalLink, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { Power, PowerOff } from 'lucide-react';
import { geoEngine, GeoEvent, Category } from '../services/geopoliticalEngine';
import { Timeline, translateBias } from './Timeline';
import { FilterBar } from './FilterBar';

// --- COMPONENTES AUXILIARES ---
const RadarTicker = ({ isScanning }: { isScanning: boolean }) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[600px] pointer-events-none">
      <div className="bg-black/60 shadow-xl  rounded-full px-6 py-2 flex items-center gap-[16px] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Status</span>
        </div>
        <div className="h-4 w-px bg-white/10 shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-8 animate-marquee whitespace-nowrap">
            <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">
              Monitoramento Ativo: Mar da China Meridional • Estreito de Ormuz • Fronteira Leste Europeia • Sahel Africano
            </span>
            <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">
              Monitoramento Ativo: Mar da China Meridional • Estreito de Ormuz • Fronteira Leste Europeia • Sahel Africano
            </span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

const MapCenterer = ({ center, event }: { center: [number, number] | null, event: GeoEvent | null }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 6, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, map]);

  // Limitar zoom e pan
  useEffect(() => {
    map.setMinZoom(2);
    map.setMaxZoom(10);
    
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);
    map.setMaxBounds(bounds);
    map.on('drag', () => {
      map.panInsideBounds(bounds, { animate: false });
    });
  }, [map]);

  return null;
};

const EventPopup = ({ event, onClose, onHover, onLeave }: { event: GeoEvent, onClose: () => void, onHover: () => void, onLeave: () => void, key?: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!event) return null;

  return (
    <Popup 
      position={event.coordinates} 
      offset={[0, -20]} 
      closeButton={false} 
      className="custom-geopopup"
      autoPan={false}
    >
      <div 
        className={`bg-black/95 shadow-2xl  rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] transition-all duration-500 pointer-events-auto overflow-hidden ${
          isExpanded ? 'w-[380px]' : 'w-[260px]'
        }`}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
      >
        {/* Top Accent Line */}
        <div className={`h-1 w-full ${
          event.severity === 'CRITICAL' ? 'bg-red-500' :
          event.severity === 'HIGH' ? 'bg-orange-500' :
          'bg-yellow-500'
        }`} />

        <div className="p-[16px]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
                event.severity === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                event.severity === 'HIGH' ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' :
                'bg-yellow-500 shadow-[0_0_8px_#eab308]'
              }`} />
              <h2 className={`font-bold text-white uppercase tracking-tighter truncate ${isExpanded ? 'text-sm' : 'text-[10px]'}`}>
                {event.title}
              </h2>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} 
              className="text-gray-500 hover:text-white transition-colors shrink-0 p-1"
            >
              <X size={16} />
            </button>
          </div>

          {!isExpanded ? (
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono uppercase tracking-widest">
                <MapPin size={10} className="text-blue-400" />
                {event.location}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className="flex items-center gap-1 text-[9px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded border-blue-500/20"
              >
                Expandir <Maximize2 size={10} />
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in- duration-500 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5  rounded-lg p-2">
                  <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Localização</div>
                  <div className="text-xs text-white font-medium truncate">{event.location}</div>
                </div>
                <div className="bg-white/5  rounded-lg p-2">
                  <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Severidade</div>
                  <div className={`text-xs font-bold ${
                    event.severity === 'CRITICAL' ? 'text-red-500' :
                    event.severity === 'HIGH' ? 'text-orange-500' :
                    'text-yellow-500'
                  }`}>{event.severity}</div>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed font-light">{event.summary}</p>
              
              <div className="space-y-3">
                <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Impacto Projetado</div>
                <div className="flex flex-wrap gap-2">
                  {event.market_impact.impacted_assets.map(asset => (
                    <span key={asset} className="px-2 py-1 bg-white/5  rounded text-[10px] text-gray-300 font-mono">
                      {asset}
                    </span>
                  ))}
                </div>
                
                <div className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase tracking-widest text-sm ${
                  ['BULLISH', 'RISK_ON'].includes(event.market_impact.signal) ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                  ['BEARISH', 'RISK_OFF', 'SUPPLY_SHOCK'].includes(event.market_impact.signal) ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}>
                  {translateBias(event.market_impact.signal)}
                </div>

                {event.market_impact.us_market_impact && (
                  <div className="bg-white/5  rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Mercado Americano</div>
                    <div className="text-xs text-gray-300 leading-relaxed">{event.market_impact.us_market_impact}</div>
                  </div>
                )}
                
                {event.market_impact.crypto_impact && (
                  <div className="bg-white/5  rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Criptomoedas</div>
                    <div className="text-xs text-gray-300 leading-relaxed">{event.market_impact.crypto_impact}</div>
                  </div>
                )}

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  className="w-full py-2 text-[9px] text-gray-500 uppercase font-bold tracking-widest hover:text-gray-300 transition-colors  mt-2"
                >
                  Recolher Detalhes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
};

const ChaosGauge = ({ score, explanation }: { score: number, explanation?: string }) => {
  const radius = 40;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  let color = "#10b981"; // Green
  let glowColor = "rgba(16, 185, 129, 0.5)";
  if (score > 40) {
    color = "#eab308"; // Yellow
    glowColor = "rgba(234, 179, 8, 0.5)";
  }
  if (score > 70) {
    color = "#ef4444"; // Red
    glowColor = "rgba(239, 68, 68, 0.5)";
  }

  // Calculate needle angle (0 to 180 degrees)
  const angle = (score / 100) * 180;

  return (
    <div className="flex flex-col items-center justify-center bg-black/60  rounded-[10px] p-[16px] w-64 relative overflow-hidden  shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-3">Nível de Ameaça Global</div>
      
      <div className="relative w-32 h-16 flex items-end justify-center overflow-hidden">
        {/* SVG Defs for Neon Glow & Gradient */}
        <svg width="0" height="0">
          <defs>
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        </svg>

        {/* Background Arc */}
        <svg className="absolute top-0 left-0 w-full h-32" viewBox="0 0 100 50">
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#222" strokeWidth="8" strokeLinecap="round" />
          {/* Foreground Arc (Neon) */}
          <path 
            d="M 10 50 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke="url(#neonGradient)" 
            strokeWidth="8" 
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            filter="url(#glow)"
          />
        </svg>
        
        {/* Needle */}
        <div 
          className="absolute bottom-0 w-1 h-16 origin-bottom transition-transform duration-1000 ease-out z-10"
          style={{ transform: `rotate(${angle - 90}deg)` }}
        >
          <div className="w-1 h-10 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]"></div>
        </div>
        
        {/* Center Dot */}
        <div className="absolute bottom-[-5px] w-4 h-4 bg-white rounded-full z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
      </div>
      
      <div className="mt-3 text-3xl font-mono font-bold" style={{ color, textShadow: `0 0 10px ${glowColor}` }}>
        {score}
      </div>

      {explanation && (
        <div className="mt-3 pt-3  w-full text-center">
          <p className="text-[10px] text-gray-300 leading-tight italic">
            "{explanation}"
          </p>
        </div>
      )}
    </div>
  );
};

const GeopoliticalRadar = () => {
  const [events, setEvents] = useState<GeoEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<GeoEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<GeoEvent | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'15m' | '1h' | '6h' | '24h'>('24h');
  const [isScanning, setIsScanning] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [tourFinished, setTourFinished] = useState(false);
  
  const mapRef = useRef<any>(null);

  // Auto-tour logic: Cycles through events every 3 seconds when scanning
  // Stops at the last point and waits for new information
  useEffect(() => {
    if (!isScanning || filteredEvents.length === 0 || tourFinished || isHovering) {
      return;
    }

    const timer = setTimeout(() => {
      setSelectedEvent(current => {
        if (!current) return filteredEvents[0];
        const currentIndex = filteredEvents.findIndex(e => e.id === current.id);
        
        // Se não encontrar (ex: foi filtrado), começa do primeiro
        if (currentIndex === -1) return filteredEvents[0];
        
        const nextIndex = currentIndex + 1;
        
        // Se chegou ao fim da lista atual, trava no último ponto
        if (nextIndex >= filteredEvents.length) {
          setTourFinished(true);
          return current; 
        }
        
        return filteredEvents[nextIndex];
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [isScanning, selectedEvent?.id, filteredEvents.length, tourFinished, isHovering]);

  const toggleRadar = () => {
    // DESATIVADO COMPLETAMENTE
  };

  useEffect(() => {
    const unsubscribe = geoEngine.subscribe((newEvents, delta) => {
      setEvents(newEvents);
      
      if (delta && delta.isNew) {
        setSelectedEvent(delta);
        setTourFinished(false); // Reset tour when new info arrives
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const now = Date.now();
    const timeLimits = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };

    const filtered = events.filter(ev => {
      const matchesCategory = categoryFilter === 'ALL' || ev.category === categoryFilter;
      const matchesTime = (now - ev.timestamp) <= timeLimits[timeFilter];
      return matchesCategory && matchesTime;
    });

    setFilteredEvents(filtered);
  }, [events, categoryFilter, timeFilter]);

  const handleEventClick = (event: GeoEvent) => {
    setSelectedEvent(event);
  };

  return (
    <div className="h-full min-h-[800px] w-full flex flex-col relative bg-[#050505] text-white overflow-hidden font-sans rounded-3xl">
      
      {/* Header - Reposicionado e mais leve */}
      <div className="absolute top-6 left-6 z-[1000] flex items-center gap-[16px]">
        <div className="bg-black/40   p-3 rounded-lg flex items-center gap-3 shadow-xl">
          <div className={`w-8 h-8 rounded-full ${isScanning ? 'bg-red-500/10 border-red-500/20' : 'bg-gray-500/10 border-gray-500/20'} flex items-center justify-center border`}>
            <Globe className={isScanning ? "text-red-500/80" : "text-gray-500/80"} size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tighter uppercase text-white/90">Radar Geopolítico</h1>
            <p className="text-[8px] text-gray-500 font-mono tracking-[0.2em]">MONITORAMENTO GLOBAL</p>
          </div>
        </div>

        <button 
          onClick={() => {
            if (isScanning) {
              geoEngine.stop();
              setIsScanning(false);
            } else {
              geoEngine.start();
              setIsScanning(true);
            }
          }}
          className={`group flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
            isScanning 
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
              : 'bg-black/40 border-gray-500/20 text-gray-400 hover:text-white hover:bg-black/60'
          }`}
        >
          {isScanning ? (
            <>
              <Power className="animate-pulse" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Desativar Radar
              </span>
            </>
          ) : (
            <>
              <PowerOff size={14} className="group-hover:text-red-400 transition-colors" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Ativar Radar
              </span>
            </>
          )}
        </button>
      </div>

      {/* Timeline - Canto Inferior Direito */}
      <div className="absolute bottom-8 right-6 z-[1000] pointer-events-auto">
        <Timeline events={filteredEvents} onEventClick={handleEventClick} />
      </div>

      {/* Filtros - Canto Inferior Esquerdo */}
      <div className="absolute bottom-20 left-6 z-[1000] pointer-events-auto">
        <FilterBar onCategoryChange={setCategoryFilter} onTimeChange={setTimeFilter} />
      </div>

      {/* Map Container */}
      <div className="flex-1 relative z-0">
        {/* Efeito de Varredura (Scanning) */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden">
            <div className="geopolitical-radar-sweep" />
          </div>
        )}
        <MapContainer 
          center={[20, 0]} 
          zoom={2} 
          className="w-full h-full bg-[#050505]"
          style={{ height: "100%", width: "100%", position: "absolute", inset: 0 }}
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={false}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="" 
          />

          <MapCenterer center={selectedEvent?.coordinates || null} event={selectedEvent} />

          {selectedEvent && (
            <EventPopup 
              key={selectedEvent.id} 
              event={selectedEvent} 
              onClose={() => {
                setSelectedEvent(null);
                setTourFinished(true); // Stop tour if manually closed
              }} 
              onHover={() => setIsHovering(true)}
              onLeave={() => setIsHovering(false)}
            />
          )}

          {filteredEvents.map(ev => {
            const severityColor = 
              ev.severity === 'CRITICAL' ? '#ef4444' :
              ev.severity === 'HIGH' ? '#f97316' :
              ev.severity === 'MEDIUM' ? '#eab308' : '#10b981';

            return (
              <Marker
                key={ev.id}
                position={ev.coordinates}
                icon={L.divIcon({
                  html: `
                    <div class="relative flex items-center justify-center">
                      <div class="absolute w-12 h-12 rounded-full animate-ping opacity-20" style="background-color: ${severityColor}"></div>
                      <div class="absolute w-8 h-8 rounded-full animate-pulse opacity-40" style="background-color: ${severityColor}; filter: blur(4px);"></div>
                      <div class="w-3 h-3 rounded-full  shadow-[0_0_10px_rgba(255,255,255,0.5)]" style="background-color: ${severityColor}"></div>
                    </div>
                  `,
                  className: 'custom-marker',
                  iconSize: [48, 48],
                  iconAnchor: [24, 24]
                })}
                eventHandlers={{ click: () => handleEventClick(ev) }}
              />
            );
          })}
        </MapContainer>
      </div>

      <RadarTicker isScanning={isScanning} />

      {/* Global Styles & Animations */}
      <style>{`
        .leaflet-container { background: #050505 !important; cursor: crosshair !important; }
        .leaflet-control-container { display: none !important; }
        .custom-marker { pointer-events: auto !important; }
        
        /* Custom Leaflet Popup Styling */
        .custom-geopopup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
        .custom-geopopup .leaflet-popup-tip-container {
          display: none !important;
        }
        .custom-geopopup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .geopolitical-radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(239, 68, 68, 0.05) 10%, transparent 20%);
          transform: translate(-50%, -50%);
          animation: geopolitical-sweep 8s linear infinite;
          pointer-events: none;
        }

        @keyframes geopolitical-sweep {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        .radar-popup-container {
          z-index: 2000;
        }

        /* Esconder scrollbars */
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default GeopoliticalRadar;
