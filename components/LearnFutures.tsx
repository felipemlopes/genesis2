
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, CheckCircle2, Lock, Trophy, Star, ChevronRight, Zap, AlertTriangle, ShieldCheck, PlayCircle, Eye, MousePointerClick, TrendingUp, XCircle, AlertOctagon, Target, Layers, Ban, Activity, Timer, Coins, GraduationCap, X, RefreshCw, HelpCircle } from 'lucide-react';

// --- TYPES ---
interface QuizOption {
  id: number;
  text: string;
}

interface Quiz {
  question: string;
  visualId?: string; // ID for the TechSVG
  options: string[]; // Legacy for lessons
  correct: number;
  explanation: string;
}

interface AssessmentQuestion {
  id: number;
  visualId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string; // Shown in feedback
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
}

interface Lesson {
  id: string;
  title: string;
  content: React.ReactNode;
  quiz?: Quiz;
}

interface Module {
  id: number;
  title: string;
  description: string;
  icon: any;
  lessons: Lesson[];
  xpReward: number;
  locked?: boolean;
}

// --- TECHNICAL SVG ENGINE (PERFECT GEOMETRY) ---
const TechSVG: React.FC<{ id: string; className?: string }> = ({ id, className }) => {
  const strokeMain = "#e5e7eb"; // White/Gray for price structure
  const strokeSupport = "#39FF14"; // Green Neon (Bullish)
  const strokeResist = "#FF073A"; // Red Neon (Bearish)
  const strokeWidth = 2.5;

  const renderPath = () => {
    switch (id) {
      // --- CONTINUATION PATTERNS ---
      case 'bull-flag': return (<><line x1="25" y1="85" x2="25" y2="15" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="25" y1="15" x2="65" y2="35" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="25" y1="40" x2="65" y2="60" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="65" y1="35" x2="65" y2="60" stroke={strokeMain} strokeWidth={1} strokeDasharray="2 2" /><path d="M50 30 L50 10 M45 15 L50 10 L55 15" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'bear-flag': return (<><line x1="25" y1="15" x2="25" y2="85" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="25" y1="85" x2="65" y2="65" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="25" y1="60" x2="65" y2="40" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="65" y1="65" x2="65" y2="40" stroke={strokeMain} strokeWidth={1} strokeDasharray="2 2" /><path d="M50 70 L50 90 M45 85 L50 90 L55 85" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'asc-triangle': return (<><line x1="20" y1="25" x2="80" y2="25" stroke={strokeResist} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="20" y1="75" x2="80" y2="25" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="20" y1="25" x2="20" y2="75" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M70 25 L70 10 M65 15 L70 10 L75 15" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'desc-triangle': return (<><line x1="20" y1="75" x2="80" y2="75" stroke={strokeSupport} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="20" y1="25" x2="80" y2="75" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="20" y1="25" x2="20" y2="75" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M70 75 L70 90 M65 85 L70 90 L75 85" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'rising-wedge-cont': return (<><line x1="15" y1="85" x2="85" y2="35" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="55" x2="85" y2="20" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="15" x2="15" y2="55" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M70 45 L70 75 M65 70 L70 75 L75 70" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'falling-wedge-cont': return (<><line x1="15" y1="15" x2="85" y2="65" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="45" x2="85" y2="80" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="85" x2="15" y2="45" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M70 55 L70 25 M65 30 L70 25 L75 30" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'asc-channel': return (<><line x1="15" y1="75" x2="85" y2="35" stroke={strokeSupport} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="55" x2="85" y2="15" stroke={strokeResist} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M25 65 L35 30 L55 50 L65 25" stroke={strokeMain} strokeWidth={1} fill="none" strokeDasharray="2 2" /><path d="M50 55 L50 35 M45 40 L50 35 L55 40" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'desc-channel': return (<><line x1="15" y1="25" x2="85" y2="65" stroke={strokeResist} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="15" y1="45" x2="85" y2="85" stroke={strokeSupport} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M25 35 L35 70 L55 50 L65 75" stroke={strokeMain} strokeWidth={1} fill="none" strokeDasharray="2 2" /><path d="M50 45 L50 65 M45 60 L50 65 L55 60" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'bull-rect': return (<><rect x="20" y="35" width="60" height="30" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" rx="2" /><line x1="20" y1="90" x2="20" y2="65" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M60 35 L60 15 M55 20 L60 15 L65 20" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'bear-rect': return (<><rect x="20" y="35" width="60" height="30" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" rx="2" /><line x1="20" y1="10" x2="20" y2="35" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M60 65 L60 85 M55 80 L60 85 L65 80" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);

      // --- REVERSAL PATTERNS ---
      case 'head-shoulders': return (<><path d="M10 70 L25 45 L40 70 L50 20 L60 70 L75 45 L90 70" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="10" y1="70" x2="90" y2="70" stroke={strokeSupport} strokeWidth={2} strokeDasharray="4 2" /><path d="M70 70 L70 90 M65 85 L70 90 L75 85" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'inverse-head-shoulders': return (<><path d="M10 30 L25 55 L40 30 L50 80 L60 30 L75 55 L90 30" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="10" y1="30" x2="90" y2="30" stroke={strokeResist} strokeWidth={2} strokeDasharray="4 2" /><path d="M70 30 L70 10 M65 15 L70 10 L75 15" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'double-top': return (<><path d="M15 80 L30 20 L50 70 L70 20 L85 80" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="15" y1="80" x2="85" y2="80" stroke={strokeSupport} strokeWidth={2} strokeDasharray="4 2" /><path d="M75 80 L75 95 M70 90 L75 95 L80 90" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'double-bottom': return (<><path d="M15 20 L30 80 L50 30 L70 80 L85 20" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="15" y1="30" x2="85" y2="30" stroke={strokeResist} strokeWidth={2} strokeDasharray="4 2" /><path d="M75 30 L75 15 M70 20 L75 15 L80 20" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'cup-handle': return (<><path d="M15 35 Q 40 90 70 35" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><path d="M70 35 L78 45 L85 35" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="15" y1="35" x2="85" y2="35" stroke={strokeResist} strokeWidth={1} strokeDasharray="3 3" /><path d="M78 35 L78 15 M73 20 L78 15 L83 20" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'cup-invert': return (<><path d="M15 65 Q 40 10 70 65" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><path d="M70 65 L78 55 L85 65" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="15" y1="65" x2="85" y2="65" stroke={strokeSupport} strokeWidth={1} strokeDasharray="3 3" /><path d="M78 65 L78 85 M73 80 L78 85 L83 80" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'triple-top': return (<><path d="M10 80 L25 20 L40 70 L50 20 L65 70 L75 20 L90 80" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="10" y1="80" x2="90" y2="80" stroke={strokeSupport} strokeWidth={2} strokeDasharray="4 2" /><path d="M80 80 L80 95 M75 90 L80 95 L85 90" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'triple-bottom': return (<><path d="M10 20 L25 80 L40 30 L50 80 L65 30 L75 80 L90 20" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><line x1="10" y1="30" x2="90" y2="30" stroke={strokeResist} strokeWidth={2} strokeDasharray="4 2" /><path d="M80 30 L80 15 M75 20 L80 15 L85 20" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'exhaustion-top': return (<><path d="M20 90 Q 50 85 50 10 L 80 90" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><path d="M65 50 L65 80 M60 75 L65 80 L70 75" stroke={strokeResist} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
      case 'exhaustion-bottom': return (<><path d="M20 10 Q 50 15 50 90 L 80 10" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" /><path d="M65 50 L65 20 M60 25 L65 20 L70 25" stroke={strokeSupport} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);

      // --- MODULE 2 VISUALS ---
      // Bull Trap (Fakeout Up)
      case 'fakeout-up': return (
        <>
          <line x1="5" y1="40" x2="95" y2="40" stroke={strokeResist} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="38" fill={strokeResist} fontSize="4" fontWeight="bold" textAnchor="end">RESISTÊNCIA (0.800)</text>
          <line x1="20" y1="45" x2="20" y2="55" stroke={strokeMain} strokeWidth="1" />
          <rect x="18" y="48" width="4" height="4" fill={strokeMain} /> 
          <line x1="30" y1="42" x2="30" y2="52" stroke={strokeMain} strokeWidth="1" />
          <rect x="28" y="45" width="4" height="4" stroke={strokeMain} fill="none" />
          <line x1="45" y1="10" x2="45" y2="64" stroke={strokeSupport} strokeWidth="1" />
          <rect x="42" y="20" width="6" height="40" fill={strokeSupport} /> 
          <line x1="60" y1="16" x2="60" y2="80" stroke={strokeResist} strokeWidth="1" />
          <rect x="57" y="20" width="6" height="50" fill={strokeResist} /> 
          <text x="45" y="7" fill={strokeSupport} fontSize="4" textAnchor="middle" fontWeight="bold">ROMPIMENTO (0.815)</text>
          <text x="60" y="88" fill={strokeResist} fontSize="4" textAnchor="middle" fontWeight="bold">REJEIÇÃO (0.785)</text>
        </>
      );
      
      // Bear Trap (Fakeout Down)
      case 'fakeout-down': return (
        <>
          <line x1="5" y1="60" x2="95" y2="60" stroke={strokeSupport} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="65" fill={strokeSupport} fontSize="4" fontWeight="bold" textAnchor="end">SUPORTE (0.760)</text>
          <line x1="20" y1="55" x2="20" y2="62" stroke={strokeMain} strokeWidth="1" />
          <rect x="18" y="58" width="4" height="2" stroke={strokeMain} fill="none" /> 
          <line x1="30" y1="52" x2="30" y2="60" stroke={strokeMain} strokeWidth="1" />
          <rect x="28" y="55" width="4" height="5" stroke={strokeMain} fill="none" />
          <line x1="45" y1="52" x2="45" y2="72" stroke={strokeResist} strokeWidth="1" />
          <rect x="42" y="55" width="6" height="10" fill={strokeResist} /> 
          <line x1="60" y1="42" x2="60" y2="70" stroke={strokeSupport} strokeWidth="1" />
          <rect x="57" y="45" width="6" height="20" fill={strokeSupport} /> 
          <text x="45" y="80" fill={strokeResist} fontSize="4" textAnchor="middle" fontWeight="bold">ARMADILHA (0.748)</text>
          <text x="60" y="38" fill={strokeSupport} fontSize="4" textAnchor="middle" fontWeight="bold">RECUPERAÇÃO (0.775)</text>
        </>
      );

      // RETEST LONG
      case 'retest-long': return (
        <>
          <line x1="5" y1="50" x2="95" y2="50" stroke={strokeMain} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="48" fill={strokeMain} fontSize="4" fontWeight="bold" textAnchor="end">SUPORTE (0.800)</text>
          <line x1="15" y1="55" x2="15" y2="65" stroke={strokeMain} strokeWidth="1" />
          <rect x="13" y="58" width="4" height="5" fill={strokeMain} />
          <line x1="35" y1="20" x2="35" y2="70" stroke={strokeSupport} strokeWidth="1" />
          <rect x="32" y="20" width="6" height="45" fill={strokeSupport} />
          <text x="35" y="15" fill={strokeSupport} fontSize="4" textAnchor="middle" fontWeight="bold">ROMPIMENTO</text>
          <line x1="55" y1="15" x2="55" y2="52" stroke={strokeResist} strokeWidth="1" />
          <rect x="52" y="20" width="6" height="28" fill={strokeResist} />
          <line x1="75" y1="35" x2="75" y2="50" stroke={strokeSupport} strokeWidth="1" />
          <rect x="72" y="38" width="6" height="7" fill={strokeSupport} />
          <text x="75" y="60" fill={strokeSupport} fontSize="4" textAnchor="middle" fontWeight="bold">RETESTE</text>
        </>
      );

      // RETEST SHORT
      case 'retest-short': return (
        <>
          <line x1="5" y1="50" x2="95" y2="50" stroke={strokeMain} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="48" fill={strokeMain} fontSize="4" fontWeight="bold" textAnchor="end">RESISTÊNCIA (0.780)</text>
          <line x1="15" y1="35" x2="15" y2="45" stroke={strokeMain} strokeWidth="1" />
          <rect x="13" y="38" width="4" height="5" fill={strokeMain} />
          <line x1="35" y1="35" x2="35" y2="70" stroke={strokeResist} strokeWidth="1" />
          <rect x="32" y="35" width="6" height="35" fill={strokeResist} />
          <text x="35" y="80" fill={strokeResist} fontSize="4" textAnchor="middle" fontWeight="bold">ROMPIMENTO</text>
          <line x1="55" y1="50" x2="55" y2="65" stroke={strokeSupport} strokeWidth="1" />
          <rect x="52" y="52" width="6" height="10" fill={strokeSupport} />
          <line x1="75" y1="50" x2="75" y2="85" stroke={strokeResist} strokeWidth="1" />
          <rect x="72" y="50" width="6" height="30" fill={strokeResist} />
          <text x="75" y="25" fill={strokeResist} fontSize="4" textAnchor="middle" fontWeight="bold">RETESTE</text>
        </>
      );

      // MIDDLE ENTRY - CONSOLIDAÇÃO (RANGE)
      case 'middle-entry': return (
        <>
          <line x1="5" y1="25" x2="95" y2="25" stroke={strokeMain} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="22" fill={strokeMain} fontSize="4" fontWeight="bold" textAnchor="end">RESISTÊNCIA (0.800)</text>
          <line x1="5" y1="75" x2="95" y2="75" stroke={strokeMain} strokeWidth="1" strokeDasharray="4 2" />
          <text x="95" y="88" fill={strokeMain} fontSize="4" fontWeight="bold" textAnchor="end">SUPORTE (0.760)</text>
          <line x1="15" y1="25" x2="15" y2="55" stroke={strokeMain} strokeWidth="1" />
          <rect x="13" y="30" width="4" height="20" fill={strokeResist} />
          <line x1="30" y1="45" x2="30" y2="75" stroke={strokeMain} strokeWidth="1" />
          <rect x="28" y="50" width="4" height="20" fill={strokeResist} />
          <line x1="45" y1="40" x2="45" y2="60" stroke={strokeMain} strokeWidth="1" />
          <rect x="43" y="45" width="4" height="10" fill={strokeSupport} />
          <line x1="60" y1="42" x2="60" y2="58" stroke={strokeMain} strokeWidth="1" />
          <rect x="58" y="48" width="4" height="5" fill={strokeResist} />
          <line x1="75" y1="70" x2="75" y2="95" stroke={strokeResist} strokeWidth="1" />
          <rect x="72" y="74" width="6" height="15" fill={strokeResist} />
          <text x="75" y="68" fill={strokeResist} fontSize="4" textAnchor="middle" fontWeight="bold">ROMPIMENTO</text>
          <text x="52" y="50" fill={strokeMain} fontSize="3" textAnchor="middle" opacity="0.3" fontWeight="bold">NÃO OPERAR</text>
        </>
      );

      // LIQUIDITY GRAB (Supply Zone Rejection) - ATUALIZADO PARA REFLETIR ZONA DE OFERTA E REJEIÇÃO
      case 'liquidity-grab': return (
        <>
          <rect x="5" y="15" width="90" height="20" fill={strokeResist} opacity="0.15" />
          <text x="95" y="12" fill={strokeResist} fontSize="3" fontWeight="bold" textAnchor="end" opacity="0.8">ZONA DE OFERTA / STOP HUNT</text>
          <line x1="5" y1="35" x2="95" y2="35" stroke={strokeMain} strokeWidth="1" />
          <line x1="25" y1="38" x2="25" y2="65" stroke={strokeMain} strokeWidth="1" />
          <rect x="23" y="40" width="4" height="20" fill={strokeSupport} stroke="none" />
          <line x1="45" y1="25" x2="45" y2="48" stroke={strokeMain} strokeWidth="1" />
          <rect x="43" y="40" width="4" height="5" fill={strokeResist} stroke="none" />
          <line x1="65" y1="40" x2="65" y2="68" stroke={strokeResist} strokeWidth="1" />
          <rect x="63" y="45" width="4" height="20" fill={strokeResist} stroke="none" />
          <line x1="85" y1="65" x2="85" y2="92" stroke={strokeResist} strokeWidth="1" />
          <rect x="83" y="65" width="4" height="25" fill={strokeResist} stroke="none" />
          <text x="45" y="20" fill={strokeResist} fontSize="3" fontWeight="bold" textAnchor="middle">WICK</text>
        </>
      );

      // CONFLUENCE SETUP (Visual da Aula 5 Módulo 2)
      case 'confluence-setup': return (
        <>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Trend Line (LTA) */}
          <line x1="10" y1="90" x2="90" y2="30" stroke="rgba(57, 255, 20, 0.5)" strokeWidth="1" strokeDasharray="2,2" />
          {/* Horizontal Support */}
          <rect x="40" y="55" width="50" height="10" fill="rgba(139, 92, 246, 0.1)" />
          <line x1="40" y1="60" x2="95" y2="60" stroke="#8b5cf6" strokeWidth="0.5" />
          {/* Price Action */}
          <path d="M 10 85 L 30 70 L 40 80 L 55 60 L 65 60 L 75 40 L 90 50" 
                stroke="#39FF14" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Confluence Point Circle */}
          <circle cx="55" cy="60" r="3" stroke="white" strokeWidth="1" fill="none" className="animate-ping" />
          <circle cx="55" cy="60" r="1.5" fill="white" />
          <text x="60" y="55" fill="white" fontSize="4" fontFamily="monospace" fontWeight="bold">CONFLUÊNCIA</text>
        </>
      );

      // PATIENCE WAIT (Aula 6 Módulo 2 - Esquerda)
      case 'patience-wait': return (<><line x1="10" y1="20" x2="90" y2="20" stroke={strokeResist} strokeWidth={strokeWidth} strokeLinecap="round" /><line x1="10" y1="80" x2="90" y2="80" stroke={strokeSupport} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M10 50 L30 40 L50 60 L70 45 L90 55" stroke={strokeMain} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /><text x="50" y="50" fill={strokeMain} fontSize="8" textAnchor="middle" fontWeight="bold" opacity="0.5">NENHUMA ENTRADA</text></>);
      // PATIENCE ENTRY (Aula 6 Módulo 2 - Direita)
      case 'patience-entry': return (<><line x1="10" y1="80" x2="90" y2="80" stroke={strokeSupport} strokeWidth={strokeWidth} strokeLinecap="round" /><path d="M10 30 L40 50 L70 80 L90 40" stroke={strokeMain} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /><circle cx="70" cy="80" r="3" fill={strokeSupport} /><text x="50" y="95" fill={strokeSupport} fontSize="7" textAnchor="middle" fontWeight="bold">ENTRADA APÓS ESPERA</text></>);

      // ... keep other visuals
      case 'indicator-lag': return (<><path d="M10 20 L30 20 L50 70 L90 70" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" /><path d="M10 80 L40 80 L60 90 L90 90" stroke="orange" strokeWidth="2" fill="none" /><line x1="50" y1="70" x2="60" y2="90" stroke="white" strokeWidth="1" strokeDasharray="2 2" /><text x="50" y="50" fill="white" fontSize="6" textAnchor="middle">PREÇO CAI</text><text x="75" y="95" fill="orange" fontSize="6" textAnchor="middle">INDICADOR ATRASA</text></>);
      // --- INDICATOR CONTEXT (AULA 2 MÓDULO 3 SVG) ---
      case 'indicator-context': return (
        <>
          <line x1="50" y1="5" x2="50" y2="95" stroke="#333" strokeWidth="0.5" strokeDasharray="2 2" />
          <text x="25" y="10" fill="#6b7280" fontSize="4" fontWeight="bold" textAnchor="middle">SEM CONTEXTO</text>
          <path d="M10 50 Q 20 30 30 50 T 45 40" stroke="white" strokeWidth="1" fill="none" />
          <circle cx="30" cy="40" r="2" fill="#ef4444" />
          <text x="75" y="10" fill="#39FF14" fontSize="4" fontWeight="bold" textAnchor="middle">COM CONTEXTO</text>
          <line x1="55" y1="60" x2="95" y2="60" stroke="#39FF14" strokeWidth="1" />
          <path d="M60 40 Q 75 60 75 60 L 90 35" stroke="white" strokeWidth="1" fill="none" strokeLinejoin="round" />
          <circle cx="75" cy="60" r="2" fill="#39FF14" />
        </>
      );
      case 'rsi-strength': return (<><path d="M10 10 L30 40 L50 50 L70 80 L90 90" stroke={strokeMain} strokeWidth={strokeWidth} fill="none" /><rect x="10" y="85" width="80" height="10" fill="red" opacity="0.3" /><text x="50" y="92" fill="white" fontSize="6" textAnchor="middle" fontWeight="bold">SOBREVENDIDO ≠ COMPRA</text></>);
      
      // --- AULA 4 MÓDULO 3 REFINED ---
      case 'div-context': return (
      <>
        {/* Background & Frame */}
        <rect x="0" y="0" width="100" height="100" fill="#0F0F0F" rx="2" />
        
        {/* Vertical Separator */}
        <line x1="50" y1="5" x2="50" y2="95" stroke="gray" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />

        {/* --- LEFT PANEL: Price Up / Vol Down --- */}
        {/* Title */}
        <text x="25" y="8" fill="#e5e7eb" fontSize="3" fontWeight="bold" textAnchor="middle" opacity="0.8">PREÇO SOBE | VOLUME CAI</text>
        
        {/* Price Line (Top 10-50) */}
        <polyline points="5,26 15,34 25,22 35,30 45,14" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Volume Bars (Bottom 60-90) - RED */}
        <rect x="3" y="63" width="4" height="27" fill="#FF3D00" rx="1" opacity="0.8" />
        <rect x="13" y="69" width="4" height="21" fill="#FF3D00" rx="1" opacity="0.8" />
        <rect x="23" y="75" width="4" height="15" fill="#FF3D00" rx="1" opacity="0.8" />
        <rect x="33" y="78" width="4" height="12" fill="#FF3D00" rx="1" opacity="0.8" />
        <rect x="43" y="81" width="4" height="9" fill="#FF3D00" rx="1" opacity="0.8" />

        {/* Label */}
        <text x="25" y="96" fill="#FF3D00" fontSize="3.5" fontWeight="bold" textAnchor="middle" style={{ textShadow: '0 0 5px rgba(255, 61, 0, 0.3)' }}>ENFRAQUECIMENTO</text>


        {/* --- RIGHT PANEL: Price Down / Vol Down --- */}
        {/* Title */}
        <text x="75" y="8" fill="#e5e7eb" fontSize="3" fontWeight="bold" textAnchor="middle" opacity="0.8">PREÇO CAI | VOLUME CAI</text>
        
        {/* Price Line (Top 10-50) */}
        <polyline points="55,34 65,26 75,38 85,30 95,46" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Volume Bars (Bottom 60-90) - GREEN */}
        <rect x="53" y="63" width="4" height="27" fill="#00C853" rx="1" opacity="0.8" />
        <rect x="63" y="68" width="4" height="22" fill="#00C853" rx="1" opacity="0.8" />
        <rect x="73" y="72" width="4" height="18" fill="#00C853" rx="1" opacity="0.8" />
        <rect x="83" y="76.5" width="4" height="13.5" fill="#00C853" rx="1" opacity="0.8" />
        <rect x="93" y="81" width="4" height="9" fill="#00C853" rx="1" opacity="0.8" />

        {/* Label */}
        <text x="75" y="96" fill="#00C853" fontSize="3.5" fontWeight="bold" textAnchor="middle" style={{ textShadow: '0 0 5px rgba(0, 200, 83, 0.3)' }}>PERDA DE PRESSÃO</text>
      </>
    );

      case 'cvd-absorption': return (
        <>
          {/* Background */}
          <rect x="0" y="0" width="100" height="100" fill="#0F0F0F" rx="2" />
          
          {/* Separator */}
          <line x1="5" y1="50" x2="95" y2="50" stroke="gray" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />

          {/* --- PRICE CHART (Top) --- */}
          <text x="5" y="8" fill="#e5e7eb" fontSize="3" fontWeight="bold" opacity="0.8">PREÇO</text>
          {/* Path: Start(5,40) -> P1(30,15) -> Retrace(50,30) -> P2(80,5) -> End(95,20) */}
          <polyline points="5,40 30,15 50,30 80,5 95,20" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Peak Line Price */}
          <line x1="30" y1="15" x2="80" y2="5" stroke="white" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
          <text x="80" y="15" fill="white" fontSize="3" textAnchor="middle">TOPO MAIS ALTO</text>

          {/* --- CVD CHART (Bottom) --- */}
          <text x="5" y="58" fill="cyan" fontSize="3" fontWeight="bold" opacity="0.8">CVD (AGRESSÃO)</text>
          {/* Path: Start(5,90) -> P1(30,65) -> Retrace(50,80) -> P2(80,72) -> End(95,85) */}
          {/* Note: P2(72) is lower (visually) than P1(65) because Y is larger */}
          <polyline points="5,90 30,65 50,80 80,72 95,85" stroke="cyan" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Peak Line CVD */}
          <line x1="30" y1="65" x2="80" y2="72" stroke="cyan" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
          <text x="80" y="65" fill="cyan" fontSize="3" textAnchor="middle">TOPO MAIS BAIXO</text>

          {/* ABSORPTION LABEL */}
          <rect x="35" y="45" width="30" height="10" fill="#000" opacity="0.8" />
          <text x="50" y="52" fill="cyan" fontSize="4" fontWeight="bold" textAnchor="middle" style={{ textShadow: '0 0 5px cyan' }}>ABSORÇÃO</text>
        </>
      );
      case 'price-hierarchy': return (
        <>
          <rect x="0" y="0" width="100" height="100" fill="#0F0F0F" rx="2" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#333" strokeWidth="0.5" strokeDasharray="2 2" />
          
          {/* Top: Price */}
          <text x="5" y="12" fill="#e5e7eb" fontSize="3" fontWeight="bold">1. PREÇO (LÍDER)</text>
          <polyline points="10,40 30,25 50,35 80,10" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="50" cy="35" r="2" fill="white" />
          <text x="50" y="42" fill="gray" fontSize="3" textAnchor="middle">PIVÔ</text>

          {/* Bottom: Indicator */}
          <text x="5" y="62" fill="#39FF14" fontSize="3" fontWeight="bold">2. INDICADOR (SEGUIDOR)</text>
          <polyline points="10,90 30,80 50,85 80,70" stroke="#39FF14" strokeWidth="1.5" fill="none" />
          <circle cx="50" cy="85" r="2" fill="#39FF14" />
          
          {/* Connection */}
          <line x1="50" y1="35" x2="50" y2="85" stroke="gray" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
        </>
      );
      case 'bollinger-squeeze': return (<><path d="M0 20 Q 50 42 100 15" stroke={strokeMain} strokeWidth="1.5" fill="none" /><path d="M0 80 Q 50 58 100 85" stroke={strokeMain} strokeWidth="1.5" fill="none" /><path d="M0 50 Q 50 50 100 50" stroke={strokeMain} strokeWidth="0.5" strokeDasharray="2 2" fill="none" /><rect x="45" y="42" width="10" height="16" rx="2" stroke={strokeSupport} strokeWidth="1" fill="none" /><text x="50" y="30" fill={strokeMain} fontSize="5" textAnchor="middle">CONTRAÇÃO</text></>);
      case 'uptrend-struct': return (<><polyline points="10,80 30,50 40,65 60,35 70,50 90,20" stroke={strokeSupport} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="30" cy="50" r="2" fill={strokeMain} /><circle cx="60" cy="35" r="2" fill={strokeMain} /><circle cx="90" cy="20" r="2" fill={strokeMain} /><text x="50" y="90" fill={strokeSupport} fontSize="6" textAnchor="middle">TOPOS E FUNDOS ASCENDENTES</text></>);
      case 'bos-structure': return (<><polyline points="10,80 30,50 40,65 60,30 70,50 80,40 80,90" stroke={strokeMain} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><line x1="70" y1="50" x2="95" y2="50" stroke={strokeResist} strokeWidth={1} strokeDasharray="2 2" /><text x="85" y="45" fill={strokeResist} fontSize="5">BOS</text></>);
      case 'sym-triangle': return (<><line x1="10" y1="10" x2="80" y2="50" stroke={strokeMain} strokeWidth={2.5} strokeLinecap="round" /><line x1="10" y1="90" x2="80" y2="50" stroke={strokeMain} strokeWidth={2.5} strokeLinecap="round" /><circle cx="80" cy="50" r="2" fill={strokeMain} /></>);

      // --- ZONA DE ACUMULAÇÃO (UPDATED: RSI OVERSOLD TRAP) ---
      case 'accumulation-zone': return (
        <>
          {/* --- PRICE CHART (Top 65%) --- */}
          <line x1="5" y1="15" x2="95" y2="15" stroke={strokeMain} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.2" />
          <line x1="5" y1="45" x2="95" y2="45" stroke={strokeMain} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.2" />

          {/* Candle 1 (Red) */}
          <line x1="15" y1="5" x2="15" y2="25" stroke={strokeResist} strokeWidth="1" />
          <rect x="12" y="10" width="6" height="10" fill={strokeResist} />

          {/* Candle 2 (Big Red - Momentum) */}
          <line x1="30" y1="20" x2="30" y2="50" stroke={strokeResist} strokeWidth="1" />
          <rect x="27" y="25" width="6" height="20" fill={strokeResist} />

          {/* Candle 3 (Small Pause - Bearish Flag-ish) */}
          <line x1="45" y1="45" x2="45" y2="55" stroke={strokeSupport} strokeWidth="1" />
          <rect x="42" y="48" width="6" height="4" fill={strokeSupport} stroke={strokeSupport} />

          {/* Candle 4 (Continuation Drop) */}
          <line x1="60" y1="48" x2="60" y2="65" stroke={strokeResist} strokeWidth="1" />
          <rect x="57" y="52" width="6" height="10" fill={strokeResist} />

          {/* Candle 5 (Lower Low) */}
          <line x1="75" y1="60" x2="75" y2="68" stroke={strokeResist} strokeWidth="1" />
          <rect x="72" y="62" width="6" height="4" fill={strokeResist} />

          {/* Trend Arrow */}
          <path d="M10 5 L 80 65" stroke={strokeResist} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" markerEnd="url(#arrowhead)" />

          {/* --- SEPARATOR --- */}
          <line x1="0" y1="70" x2="100" y2="70" stroke={strokeMain} strokeWidth="0.5" opacity="0.5" />

          {/* --- RSI PANE (Bottom 30%) --- */}
          <text x="5" y="78" fill="#a855f7" fontSize="4" fontWeight="bold">RSI (14)</text>
          
          {/* RSI 30 Level (Oversold Threshold) */}
          <line x1="0" y1="85" x2="100" y2="85" stroke="gray" strokeWidth="0.5" strokeDasharray="2 2" />
          <text x="95" y="84" fill="gray" fontSize="3" textAnchor="end">30</text>

          {/* RSI Line (Stuck at bottom) */}
          <path d="M10 82 Q 25 95 40 92 T 70 96 T 90 94" stroke="#a855f7" strokeWidth="1.5" fill="none" />
          
          {/* Visual Cues */}
          <text x="50" y="35" fill={strokeResist} fontSize="5" fontWeight="bold" opacity="0.8" transform="rotate(-30 50 35)">FORTE QUEDA</text>
          <text x="50" y="98" fill="#a855f7" fontSize="3" fontWeight="bold" textAnchor="middle">SOBREVENDIDO (SEM REAÇÃO)</text>
        </>
      );

      default: return <rect x="10" y="10" width="80" height="80" stroke="gray" fill="none" />;
    }
  };

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg">
      {renderPath()}
    </svg>
  );
};

const MODULES_DATA: Module[] = [
  {
    id: 1,
    title: "Fundamentos de Futuros",
    description: "Mecânica real do contrato: Mark Price, Funding, Liquidação e a verdade sobre Alavancagem.",
    icon: BookOpen,
    xpReward: 150,
    lessons: [
      {
        id: "1-1",
        title: "Spot vs. Futures: A Diferença Real",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Muitos iniciantes tratam Futuros como se fosse Spot, e é aí que perdem tudo. No <strong>Spot</strong>, você compra o ativo real. Se o preço cair 90%, você ainda tem as moedas.</p>
            <p>Em <strong>Futuros</strong>, você negocia um <em>contrato</em> de intenção sobre o preço. Você não tem a moeda. Você tem uma aposta alavancada contra a contraparte. Esse contrato é precificado continuamente pelo Mark Price, e não pelo último preço negociado no gráfico. Essa diferença impacta diretamente risco, liquidação e PnL.</p>
            <div className="p-[16px] bg-white/5  rounded-lg mt-4">
                <h4 className="text-genesis-accent font-bold uppercase text-[10px] tracking-widest mb-2">Conceito Crítico</h4>
                <p>Se sua margem acabar, a corretora encerra o contrato e toma seu dinheiro. Isso é a <strong>Liquidação</strong>. No Spot, liquidação não existe. Em Futuros, ela é a contraparte do seu lucro potencial. Em Futures, não é necessário o mercado inverter contra você para que exista perda total. Um erro de dimensionamento de risco é suficiente.</p>
            </div>
          </div>
        ),
        quiz: {
          question: "Qual é a principal diferença de risco entre Spot e Futures?",
          options: ["No Spot há mais taxas operacionais.", "Em Futures existe risco de liquidação da margem.", "No Spot não é possível vender.", "Em Futures há pagamento de dividendos."],
          correct: 1,
          explanation: "A Liquidação é exclusiva de derivativos/margem. É o mecanismo que zera sua posição forçadamente quando o colateral é insuficiente."
        }
      },
      {
        id: "1-2",
        title: "Mark Price vs. Last Price",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Você já viu o preço bater no seu Stop mas a posição não fechar? Ou ser liquidado sem o gráfico chegar lá? Isso acontece por confundir os preços.</p>
            <ul className="list-disc pl-5 space-y-2"><li><strong>Last Price (Último Preço):</strong> É o preço da última negociação real na exchange. É o que desenha o gráfico.</li><li><strong>Mark Price (Preço de Marcação):</strong> É um preço calculado (média global) usado para <strong>LIQUIDAÇÃO</strong> e cálculo de P&L não realizado. Ele evita manipulações de preço na exchange local.</li></ul>
            <p>Em cenários de alta volatilidade, o Mark Price e o Last Price podem divergir significativamente. Essa divergência é a principal causa de liquidações que não aparecem visualmente no gráfico.</p>
            <div className="p-[16px] bg-red-900/10 border-red-500/20 rounded-lg mt-4 flex gap-3">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <div>
                    <h4 className="text-red-500 font-bold uppercase text-[10px] tracking-widest mb-1">Onde está o Perigo?</h4>
                    <p>Sua liquidação é baseada no <strong>Mark Price</strong>. O gráfico mostra o <strong>Last Price</strong>. Em alta volatilidade, eles podem divergir, liquidando você "invisivelmente" no gráfico. Stops baseados apenas no gráfico não protegem contra liquidação em contratos Futures.</p>
                </div>
            </div>
          </div>
        ),
        quiz: {
          question: "Qual preço a exchange utiliza para calcular a liquidação?",
          options: ["Last Price, o preço do gráfico.", "Preço de entrada da posição.", "Mark Price, preço de marcação global.", "Preço médio diário."],
          correct: 2,
          explanation: "O Mark Price é usado para liquidações para evitar que uma 'baleia' manipule o preço momentaneamente em uma única exchange apenas para liquidar traders."
        }
      },
      {
        id: "1-3",
        title: "Funding Rate e Open Interest",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O <strong>Funding Rate</strong> é um pagamento periódico entre Longs e Shorts para manter o preço do contrato próximo ao preço Spot.</p>
            <ul className="list-disc pl-5 space-y-2"><li><strong>Funding Positivo:</strong> Longs pagam Shorts. Indica viés de alta (muita gente comprando).</li><li><strong>Funding Negativo:</strong> Shorts pagam Longs. Indica viés de baixa (muita gente vendendo).</li></ul>
            <p>O <strong>Open Interest (OI)</strong> é a quantidade de contratos abertos. OI subindo indica dinheiro novo entrando (tendência forte). OI caindo indica saída de capital (tendência enfraquecendo).</p>
            <p>O Funding Rate reflete o desequilíbrio emocional do mercado. O Open Interest reflete o comprometimento financeiro. Quando ambos crescem juntos, o risco de movimentos forçados aumenta.</p>
          </div>
        ),
        quiz: {
          question: "O que significa Open Interest subindo junto com o preço?",
          options: ["Que a tendência está perdendo força.", "Que há manipulação de mercado.", "Entrada de dinheiro novo sustentando o movimento.", "Que o Funding Rate ficará negativo."],
          correct: 2,
          explanation: "Preço subindo + OI subindo é o cenário ideal de tendência saudável. Indica agressão real de compra abrindo novas posições."
        }
      },
      {
        id: "1-4",
        title: "Por que Stop Loss não evita liquidação",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O Stop Loss atua sobre o Last Price. A liquidação atua sobre o Mark Price. Em movimentos rápidos ou de baixa liquidez, o Stop pode não ser executado antes da liquidação.</p>
            <div className="p-[16px] bg-yellow-900/10 border-yellow-500/20 rounded-lg mt-4 flex gap-3">
                <AlertOctagon className="text-yellow-500 shrink-0" size={20} />
                <div>
                    <h4 className="text-yellow-500 font-bold uppercase text-[10px] tracking-widest mb-1">Alerta Crítico</h4>
                    <p>O Stop é uma ferramenta de saída. A liquidação é um evento de risco.</p>
                </div>
            </div>
          </div>
        ),
        quiz: {
          question: "Por que um Stop Loss pode não impedir uma liquidação em Futures?",
          options: ["Porque o Stop depende do preço de entrada.", "Porque o Stop atua no Last Price e a liquidação no Mark Price.", "Porque o Funding Rate interfere diretamente.", "Porque a alavancagem é fixa."],
          correct: 1,
          explanation: "A divergência entre os preços de execução (Last) e de referência (Mark) pode liquidar a posição antes que o Stop seja acionado."
        }
      },
      {
        id: "1-5",
        title: "Alavancagem não aumenta lucro, reduz margem de erro",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>A alavancagem não altera o movimento do preço. Ela apenas reduz a distância entre o preço atual e o ponto de liquidação.</p>
            <div className="p-[16px] bg-red-900/10 border-red-500/20 rounded-lg mt-4">
                <h4 className="text-red-500 font-bold uppercase text-[10px] tracking-widest mb-2">Fator Crítico</h4>
                <p>Quanto maior a alavancagem, menor a tolerância a variações normais do mercado.</p>
            </div>
          </div>
        ),
        quiz: {
          question: "O que a alavancagem realmente altera em uma operação de Futures?",
          options: ["O movimento do preço.", "A taxa de funding.", "A margem de erro até a liquidação.", "A direção do mercado."],
          correct: 2,
          explanation: "Alavancagem comprime o espaço disponível para o preço oscilar contra você antes da liquidação total."
        }
      },
      {
        id: "1-6",
        title: "Como traders perdem dinheiro em Futures mesmo certos na direção",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Direção correta não garante sobrevivência. Risco mal dimensionado elimina o trader antes do movimento se completar.</p>
            <ul className="list-disc pl-5 space-y-2">
                <li>Margem curta</li>
                <li>Volatilidade momentânea</li>
                <li>Divergência de Mark Price</li>
            </ul>
            <div className="p-[16px] bg-white/5  rounded-lg mt-8 text-center">
                <p className="font-bold text-white mb-2">Este módulo não ensina como ganhar dinheiro. Ele ensina como não ser eliminado antes de aprender.</p>
                <p className="text-xs text-gray-400">O avanço para os próximos módulos pressupõe domínio total desses conceitos.</p>
            </div>
          </div>
        ),
        quiz: {
          question: "É possível estar certo na direção e ainda assim perder tudo em Futures?",
          options: ["Não, se o Stop estiver bem posicionado.", "Sim, quando o risco estrutural está mal calculado.", "Apenas em alavancagens acima de 50x.", "Apenas quando o Funding é negativo."],
          correct: 1,
          explanation: "Se a posição for liquidada por volatilidade antes do movimento a favor acontecer, o trader perde tudo mesmo tendo acertado a direção final."
        }
      }
    ]
  },
  {
    id: 2,
    title: "Leitura Gráfica Realista",
    description: "Identificando a verdade no gráfico: Rompimentos, Retestes e Zonas de Risco.",
    icon: Zap,
    xpReward: 200,
    lessons: [
      {
        id: "2-1",
        title: "A Ilusão do Rompimento",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O erro número 1 de traders de rompimento é comprar assim que a linha é cruzada. O rompimento raramente é continuação imediata. Na maioria das vezes, ele funciona como um evento de liquidez para capturar entradas atrasadas. <strong>70% dos rompimentos falham</strong> ou são armadilhas de liquidez (Fakeouts).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] my-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-between group h-48"><div className="w-full h-32 p-2"><TechSVG id="fakeout-up" /></div><span className="text-[10px] font-bold text-red-400 uppercase tracking-widest text-center mb-1">Falso Rompimento - Alta<br/>(Bull Trap)</span></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-between group h-48"><div className="w-full h-32 p-2"><TechSVG id="fakeout-down" /></div><span className="text-[10px] font-bold text-green-400 uppercase tracking-widest text-center mb-1">Falso Rompimento - Baixa<br/>(Bear Trap)</span></div></div>
            <p>Um rompimento válido exige:</p><ol className="list-decimal pl-5 space-y-2"><li><strong>Volume Explosivo:</strong> A barra de rompimento deve ter volume muito acima da média.</li><li><strong>Fechamento do Candle:</strong> O candle deve fechar <em>longe</em> da zona rompida, sem deixar pavio grande de rejeição.</li><li><strong>Continuidade:</strong> O candle seguinte deve superar a máxima do candle de rompimento.</li></ol><p>A ausência de qualquer um desses fatores aumenta drasticamente a probabilidade de falso rompimento.</p><div className="p-[16px] bg-genesis-card  rounded-lg text-center mt-2"><span className="text-genesis-accent font-bold uppercase text-xs tracking-widest block mb-2">Dica Gênesis</span><p className="text-white font-medium italic">"Não opere a violação da linha. Opere o fechamento do candle."</p></div>
          </div>
        ),
        quiz: {
          question: "O que caracteriza um falso rompimento?",
          visualId: "fakeout-up",
          options: ["Preço rompe com volume alto e continua.", "Preço viola o nível e fecha de volta deixando pavio.", "Preço entra em consolidação lateral.", "Preço respeita o nível."],
          correct: 1,
          explanation: "Um fakeout ocorre quando o preço 'fura' o nível para capturar liquidez (stops) e volta rapidamente para dentro da estrutura anterior."
        }
      },
      {
        id: "2-2",
        title: "O Poder do Reteste",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O <strong>Reteste</strong> é a confirmação de que uma antiga resistência virou suporte (ou vice-versa). É o ponto de entrada mais seguro. O reteste confirma aceitação do rompimento e reduz risco operacional.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] my-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-between group h-48"><div className="w-full h-32 p-2"><TechSVG id="retest-long" /></div><span className="text-[10px] font-bold text-genesis-positive uppercase tracking-widest text-center mb-1">Rompimento de Alta<br/>(Resistência vira Suporte)</span></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-between group h-48"><div className="w-full h-32 p-2"><TechSVG id="retest-short" /></div><span className="text-[10px] font-bold text-red-400 uppercase tracking-widest text-center mb-1">Rompimento de Baixa<br/>(Suporte vira Resistência)</span></div></div>
            <p>Entrar no reteste oferece duas vantagens matemáticas:</p><ul className="list-disc pl-5 space-y-2"><li><strong>Stop Curto:</strong> Seu stop fica logo abaixo da zona retestada.</li><li><strong>Confirmação:</strong> Você evita entrar no momento da euforia e entra na validação técnica.</li></ul><p>O trader profissional entra no reteste. O trader emocional entra no rompimento.</p><p className="mt-2 text-genesis-negative font-bold text-xs uppercase tracking-wide">MEDO DE PERDER A OPORTUNIDADE (FOMO) É O INIMIGO DO RETESTE.</p>
          </div>
        ),
        quiz: {
          question: "Por que aguardar o reteste é profissional?",
          visualId: "retest-long",
          options: ["Porque garante lucro.", "Porque reduz risco e melhora risco retorno.", "Porque elimina o stop.", "Porque é mais rápido."],
          correct: 1,
          explanation: "O reteste permite um stop loss técnico curto e confirma que o rompimento foi legítimo, filtrando a maioria das armadilhas."
        }
      },
      {
        id: "2-3",
        title: "Preço Atual não é Entrada",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O Gênesis mostra o preço atual, mas isso não é um convite de compra. O mercado se move entre <strong>Zonas de Decisão</strong> (Suportes e Resistências).</p>
            <p>Se o preço está no meio do caminho entre um suporte e uma resistência, é a "Terra de Ninguém". Entradas no meio do caminho oferecem stops longos e baixa previsibilidade.</p>
            <div className="w-full h-64 bg-black  rounded-[10px] p-[16px] flex items-center justify-center mb-10 mt-6"><TechSVG id="middle-entry" /></div>
            <div className="flex items-center gap-[16px] bg-white/5 p-[16px] rounded-lg "><XCircle className="text-red-500" size={24} /><div><h4 className="text-white font-bold text-xs uppercase">Erro Comum</h4><p className="text-gray-400 text-xs">Entrar "a mercado" só porque viu uma vela verde, estando longe de qualquer suporte relevante. O preço atual só ganha relevância quando atinge uma zona de decisão.</p></div></div>
          </div>
        ),
        quiz: {
          question: "Onde devemos procurar entradas?",
          visualId: "middle-entry",
          options: ["Em qualquer candle verde.", "No meio do canal.", "Em suporte, resistência ou reteste com confluência.", "Quando o RSI estiver alto."],
          correct: 2,
          explanation: "Entradas técnicas ocorrem em zonas de interesse onde o risco é controlável. Entrar no meio do caminho é jogo de azar."
        }
      },
      {
        id: "2-4",
        title: "Liquidez vem antes do movimento",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>O mercado se move para onde existe liquidez, não para onde parece lógico.</p>
            <div className="w-full h-64 bg-black  rounded-[10px] p-[16px] flex items-center justify-center mb-10 mt-6"><TechSVG id="liquidity-grab" /></div>
          </div>
        ),
        quiz: {
          question: "O que geralmente precede um movimento forte?",
          visualId: "liquidity-grab",
          options: ["Cruzamento de médias.", "Indicadores extremos.", "Captura de liquidez em níveis relevantes.", "Consolidação sem volume."],
          correct: 2,
          explanation: "O mercado busca liquidez (ordens de stop e entrada) para ganhar força para o próximo movimento."
        }
      },
      {
        id: "2-5",
        title: "Confluência é o que valida a entrada",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p><strong>Confluência</strong> é a regra de ouro da sobrevivência institucional: nunca confiar em uma única testemunha. No trading, um sinal isolado é apenas um ruído; vários sinais concordando são uma evidência.</p>
            
            <div className="bg-white/5 p-[16px] rounded-lg  my-4">
                <h4 className="text-genesis-accent font-bold text-xs uppercase mb-2 flex items-center gap-2"><Eye size={12} /> Interpretando o Gráfico Abaixo</h4>
                <p className="text-xs leading-5">
                  Observe a geometria do setup. O preço não parou de cair por acaso. Ele encontrou uma barreira dupla:
                </p>
                <ul className="list-decimal pl-5 mt-2 space-y-2 text-xs text-gray-400">
                    <li>Uma <strong>Linha de Tendência</strong> (LTA) guiando a alta.</li>
                    <li>Um <strong>Suporte Horizontal</strong> (zona de preço histórico).</li>
                </ul>
                <p className="mt-3 text-xs font-medium text-white  pt-2">
                  Onde essas duas linhas se cruzam, a probabilidade de defesa aumenta exponencialmente. Isso é confluência.
                </p>
            </div>

            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4 shadow-lg">
                <TechSVG id="confluence-setup" />
            </div>

            <div className="p-[16px] border-red-500 bg-red-900/5 rounded-r-lg">
                <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-2 flex items-center gap-2"><Ban size={12} /> O que NÃO é Confluência</span>
                <p className="text-xs text-gray-400">
                  Ver o RSI sobrevendido e comprar imediatamente <strong>NÃO</strong> é operar confluência. É operar aposta. Se o indicador diz "compra" mas o preço está abaixo de uma resistência (conflito), a entrada é inválida. Busque consenso, não esperança.
                </p>
            </div>
          </div>
        ),
        quiz: {
          question: "Qual é a definição prática de uma entrada validada por confluência?",
          visualId: "confluence-setup",
          options: [
            "Um indicador isolado (ex: RSI) dando sinal forte.",
            "Um movimento rápido de vela (Momento).",
            "A sobreposição de múltiplos fatores técnicos (Ex: Suporte + LTA + Fibonacci) na mesma zona.",
            "Uma notícia positiva no Twitter."
          ],
          correct: 2,
          explanation: "Confluência é estatística: a probabilidade de um suporte falhar é X. A probabilidade de um suporte, uma LTA e um indicador falharem juntos, ao mesmo tempo, é drasticamente menor."
        }
      },
      // --- PACIÊNCIA (AULA 6 MÓDULO 2) ---
      {
        id: "2-6",
        title: "Paciência é uma vantagem competitiva",
        content: (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <p>A maioria das perdas no trading não acontece porque o trader não sabe ler gráfico. Ela acontece porque o trader não sabe esperar.</p>
            
            <p>Paciência, no mercado, não é virtude moral. <strong>É vantagem operacional.</strong></p>
            
            <div className="bg-white/5 p-[16px] rounded-lg ">
              <p className="mb-2">O trader impaciente entra quando o preço ainda está longe de qualquer zona relevante. Ele entra no meio do caminho, sem suporte, sem resistência, sem contexto técnico.</p>
              <p>Já o trader paciente entende que o mercado passa boa parte do tempo fora de regiões de decisão. Ele sabe que nem todo movimento é oportunidade.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] my-6">
              {/* Left Graph Explanation */}
              <div className="flex flex-col gap-3">
                  <div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center group h-48">
                      <div className="w-full h-full p-2"><TechSVG id="patience-wait" /></div>
                  </div>
                  <div className="text-xs text-gray-400 space-y-2">
                      <h4 className="text-red-400 font-bold uppercase">Gráfico da Esquerda (Espera)</h4>
                      <ul className="list-disc pl-4 space-y-1">
                          <li>Resistência em <span className="text-red-400">vermelho</span> acima.</li>
                          <li>Suporte em <span className="text-genesis-positive">verde</span> abaixo.</li>
                          <li>O preço oscila no <strong>meio</strong>, sem testar nada.</li>
                      </ul>
                      <p className="italic  pl-2">
                          O texto "NENHUMA ENTRADA" deixa claro: não há vantagem estatística aqui. Operar aqui é erro de ansiedade.
                      </p>
                  </div>
              </div>

              {/* Right Graph Explanation */}
              <div className="flex flex-col gap-3">
                  <div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center group h-48">
                      <div className="w-full h-full p-2"><TechSVG id="patience-entry" /></div>
                  </div>
                  <div className="text-xs text-gray-400 space-y-2">
                      <h4 className="text-genesis-positive font-bold uppercase">Gráfico da Direita (Ação)</h4>
                      <ul className="list-disc pl-4 space-y-1">
                          <li>O preço finalmente retorna ao <span className="text-genesis-positive">suporte</span>.</li>
                          <li>Há uma reação clara de defesa.</li>
                          <li>A oportunidade surge apenas <strong>após</strong> a chegada na zona.</li>
                      </ul>
                      <p className="italic  pl-2">
                          O mercado é o mesmo. O ativo é o mesmo. O que muda é o <strong>momento</strong>.
                      </p>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[16px]">
                <div className="p-3 bg-genesis-positive/5 border-genesis-positive/20 rounded-lg">
                    <h5 className="text-genesis-positive font-bold text-xs uppercase mb-2">Trader Profissional</h5>
                    <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
                        <li>Opera menos</li>
                        <li>Escolhe melhor</li>
                        <li>Evita entradas ruins</li>
                    </ul>
                </div>
                <div className="p-3 bg-red-900/5 border-red-500/20 rounded-lg">
                    <h5 className="text-red-400 font-bold text-xs uppercase mb-2">Trader Impaciente</h5>
                    <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
                        <li>Opera mais</li>
                        <li>Força operações</li>
                        <li>Gera prejuízo</li>
                    </ul>
                </div>
            </div>

            <div className="p-[16px] border-red-500 bg-red-900/5 rounded-r-lg mt-4">
                <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-2 flex items-center gap-2"><Ban size={12} /> O que NÃO fazer</span>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li>Entrar no meio do gráfico, longe de suporte ou resistência.</li>
                    <li>Entrar apenas para "não ficar de fora" (FOMO).</li>
                    <li>Confundir "preço se mexendo" com "oportunidade real".</li>
                    <li>Acreditar que operar mais vezes aumenta o lucro.</li>
                </ul>
                <p className="mt-2 text-xs font-bold text-white">Sem vantagem, não existe trade.</p>
            </div>

            <div className="text-center pt-4 ">
                <p className="text-genesis-accent font-medium italic">"Trader iniciante reage ao mercado. Trader profissional espera o mercado chegar até ele."</p>
            </div>
          </div>
        ),
        quiz: {
          question: "Por que a paciência é uma vantagem no trading?",
          visualId: "patience-entry",
          options: ["Porque elimina perdas.", "Porque reduz entradas de baixa qualidade.", "Porque aumenta trades.", "Porque dispensa stop."],
          correct: 1,
          explanation: "Esperar pelo setup perfeito evita overtrading e entradas em zonas de baixo retorno/risco."
        }
      }
    ]
  },
  {
    id: 3,
    title: "Indicadores e Gênesis",
    description: "Como interpretar os dados sem criar dependência cega.",
    icon: PlayCircle,
    xpReward: 200,
    lessons: [
      {
        id: "3-1",
        title: "Indicador não é Oráculo",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>RSI sobrevendido não significa "compra". Significa apenas que o movimento de baixa foi forte. Em tendências fortes de queda, o RSI pode ficar sobrevendido por dias.</p>
            <p><strong>O Gênesis é um painel de instrumentos, não um piloto automático.</strong></p>
            <div className="bg-white/5 p-[16px] rounded-lg  mt-4">
               <p>O que estamos vendo no gráfico é simples:</p>
               <ul className="list-disc pl-5 mt-2 space-y-1">
                   <li>o preço se move primeiro.</li>
                   <li>o indicador reage depois.</li>
               </ul>
               <p className="mt-4">Indicadores são cálculos matemáticos baseados em dados passados de preço e volume. Eles não antecipam decisões do mercado. Eles ajudam a interpretar o que já aconteceu.</p>
               <p className="mt-2 text-genesis-negative font-bold">Quando o trader trata indicador como oráculo, ele delega a decisão a uma fórmula e ignora o contexto do mercado.</p>
            </div>
            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4"><TechSVG id="indicator-lag" /></div>
          </div>
        ),
        quiz: {
          question: "O que significa dizer que um indicador não é um oráculo?",
          visualId: "indicator-lag",
          options: ["Que indicadores não funcionam em criptomoedas.", "Que indicadores antecipam movimentos futuros.", "Que indicadores mostram dados derivados do preço e não decisões prontas.", "Que indicadores devem ser ignorados."],
          correct: 2,
          explanation: "Indicadores são ferramentas de confirmação atrasadas (lagging). Eles processam o que o preço JÁ FEZ. A decisão deve ser baseada na estrutura de preço, não na linha do indicador."
        }
      },
      // --- INDICADOR SEM CONTEXTO (AULA 2 MÓDULO 3) ---
      {
        id: "3-2",
        title: "Indicador sem contexto gera erro",
        content: (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <p>Observe o gráfico acima com atenção.</p>
            <p>O que ele está mostrando é algo simples, mas que a maioria dos traders ignora.</p>
            <p>O mesmo sinal de indicador pode aparecer em qualquer lugar do gráfico. Isso não significa que ele tem o mesmo valor operacional.</p>
            <p><strong>Indicadores não funcionam sozinhos. Eles dependem diretamente de onde o preço está.</strong></p>

            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4"><TechSVG id="indicator-context" /></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                <div className="p-3 bg-white/5  rounded-lg">
                    <h5 className="text-red-400 font-bold text-xs uppercase mb-2">Sem Contexto (Esquerda)</h5>
                    <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
                        <li>Sinal aparece no meio do gráfico.</li>
                        <li>Longe de zonas relevantes.</li>
                        <li>Não há suporte ou resistência.</li>
                        <li><strong>Resultado:</strong> Sinal sem utilidade prática.</li>
                    </ul>
                </div>
                <div className="p-3 bg-genesis-positive/5 border-genesis-positive/20 rounded-lg">
                    <h5 className="text-genesis-positive font-bold text-xs uppercase mb-2">Com Contexto (Direita)</h5>
                    <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
                        <li>Sinal aparece sobre zona de decisão.</li>
                        <li>Local onde o mercado reage.</li>
                        <li>Indicador confirma a estrutura.</li>
                        <li><strong>Resultado:</strong> Oportunidade válida.</li>
                    </ul>
                </div>
            </div>

            <div className="p-[16px] border-red-500 bg-red-900/5 rounded-r-lg mt-4">
                <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-2 flex items-center gap-2"><Ban size={12} /> O que NÃO fazer</span>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li>Operar todo sinal que aparece.</li>
                    <li>Usar indicador longe de zonas de decisão.</li>
                    <li>Acreditar que vários indicadores juntos substituem contexto.</li>
                    <li>Ignorar a posição do preço no gráfico.</li>
                </ul>
                <p className="mt-2 text-xs font-bold text-white">Sinal sem contexto não é setup.</p>
            </div>

            <div className="text-center pt-4 ">
                <p className="text-genesis-accent font-medium italic">"Indicador aponta. Contexto valida. Preço decide. Sem contexto, o sinal confunde. Com contexto, ele confirma."</p>
            </div>
          </div>
        ),
        quiz: {
          question: "Quando um sinal de indicador passa a ter valor operacional?",
          visualId: "indicator-context",
          options: ["Sempre que aparece.", "Quando ocorre em uma zona de decisão relevante.", "Quando vários indicadores piscam juntos.", "Quando o mercado está lateral."],
          correct: 1,
          explanation: "O contexto (Suporte/Resistência) é o filtro principal. Um sinal de compra só é válido se ocorrer sobre um suporte ou estrutura de alta."
        }
      },
      // --- AULA 3 MÓDULO 3 ---
      {
        id: "3-3",
        title: "RSI mede força, não ponto de entrada",
        content: (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <p>Observe o gráfico com atenção.</p>
            <p>O que vemos é um preço em forte tendência de queda, com movimentos contínuos para baixo. Durante todo esse movimento, o RSI permanece em região de sobrevenda por vários candles.</p>
            <p>Esse comportamento costuma confundir traders iniciantes. Muitos acreditam que RSI sobrevendido significa oportunidade de compra. O gráfico mostra o oposto: <strong>mesmo com o RSI extremo, o preço continua caindo.</strong></p>
            
            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4">
              <TechSVG id="accumulation-zone" />
            </div>

            <div className="bg-white/5 p-[16px] rounded-lg ">
              <h4 className="text-white font-bold uppercase text-xs mb-2">Leitura do Gráfico</h4>
              <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
                <li>A linha branca descendente representa o preço em queda consistente.</li>
                <li>A marcação em vermelho “SOBREVENDIDO ≠ COMPRA” reforça que o indicador atingiu um extremo, mas isso não interrompeu o movimento.</li>
              </ul>
              <p className="mt-2 text-xs font-medium text-white  pt-2">
                O RSI está informando que o movimento vendedor é forte e a pressão de venda é dominante. Ele descreve o estado do mercado, não uma ordem de entrada.
              </p>
            </div>

            <div className="p-[16px] border-red-500 bg-red-900/5 rounded-r-lg mt-4">
              <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-2 flex items-center gap-2">
                <Ban size={12} /> O que NÃO fazer
              </span>
              <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                <li>Comprar apenas porque o RSI está sobrevendido.</li>
                <li>Vender apenas porque o RSI está sobrecomprado.</li>
                <li>Entrar contra uma tendência forte baseado em indicador.</li>
                <li>Tratar média ou RSI como ponto exato de entrada.</li>
              </ul>
              <p className="mt-2 text-xs font-bold text-white">Indicador extremo não é setup.</p>
            </div>

            <div className="text-center pt-4 ">
              <p className="text-genesis-accent font-medium italic">
                "Quem usa força como entrada, opera contra o mercado. Quem entende força, espera contexto para decidir."
              </p>
            </div>
          </div>
        ),
        quiz: {
          question: "O que o RSI realmente indica ao trader?",
          visualId: "accumulation-zone",
          options: ["Pontos exatos de entrada.", "Reversões garantidas.", "Força e velocidade do movimento.", "Direção futura do mercado."],
          correct: 2,
          explanation: "RSI (Índice de Força Relativa) mede a velocidade e a mudança dos movimentos de preço. Sobrevendido em tendência forte significa apenas 'muita força de venda', não reversão automática."
        }
      },
      // --- AULA 4 MÓDULO 3 (UPDATED) ---
      {
        id: "3-4",
        title: "DIVERGÊNCIAS DE PREÇO E VOLUME",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p><strong>O QUE ELAS REALMENTE DIZEM</strong></p>
            <p>Observe o gráfico acima com atenção.</p>
            <p>Ele mostra dois cenários diferentes, mas com a mesma lógica central: preço e volume não estão confirmando um ao outro.</p>
            
            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4">
                <TechSVG id="div-context" />
            </div>

            <p><strong>CENÁRIO 1: PREÇO SOBE, VOLUME CAI (Divergência de Baixa)</strong></p>
            <p>Aqui, o preço continua avançando e formando novos topos. Visualmente, tudo parece positivo.</p>
            <p>Porém, o volume diminui.</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Menos participantes estão sustentando a alta.</li>
                <li>O movimento continua, mas perde convicção.</li>
                <li>O risco de falha aumenta.</li>
            </ul>
            <p className="text-genesis-negative font-bold mt-2">️ Isso NÃO é sinal de venda. É um alerta.</p>

            <p className="mt-4"><strong>CENÁRIO 2: PREÇO CAI, VOLUME DIMINUI (Divergência de Alta)</strong></p>
            <p>Aqui, o preço segue em queda. Mas o volume também diminui.</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>A pressão vendedora enfraquece.</li>
                <li>Menos participantes estão empurrando o preço para baixo.</li>
                <li>O movimento de baixa começa a perder força.</li>
            </ul>
            <p className="text-genesis-positive font-bold mt-2">️ Isso NÃO é sinal de compra. É um alerta.</p>

            <div className="bg-white/5 p-[16px] rounded-lg  mt-4">
                <h4 className="text-white font-bold text-xs uppercase mb-2">Conceito Central da Aula</h4>
                <p>Divergência entre preço e volume não manda entrar. Ela serve para:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-400 text-xs">
                    <li>Alertar sobre perda de força.</li>
                    <li>Evitar entradas tardias.</li>
                    <li>Preparar o trader para observar confirmação.</li>
                </ul>
                <p className="mt-3 text-xs font-medium text-white  pt-2">
                  Sem contexto, divergência confunde. Com contexto, divergência protege.
                </p>
            </div>

            <div className="p-[16px] border-red-500 bg-red-900/5 rounded-r-lg mt-4">
                <span className="text-red-400 font-bold text-[10px] uppercase tracking-widest block mb-2 flex items-center gap-2"><Ban size={12} /> O que o aluno NÃO deve fazer</span>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li>Comprar apenas porque existe divergência de alta.</li>
                    <li>Vender apenas porque existe divergência de baixa.</li>
                    <li>Operar contra a tendência sem confirmação de preço.</li>
                    <li>Tratar volume como gatilho isolado.</li>
                </ul>
                <p className="mt-2 text-xs font-bold text-white">Volume alerta. Preço confirma.</p>
            </div>

            <div className="text-center pt-4 ">
                <p className="text-genesis-accent font-medium italic">"Preço mostra direção. Volume mostra convicção. Quando ambos caminham juntos, o movimento é saudável. Quando se separam, o trader deve reduzir pressa e aumentar atenção."</p>
            </div>
          </div>
        ),
        quiz: {
          question: "Quando ocorre divergência entre preço e volume, o que isso significa?",
          visualId: "div-context",
          options: ["Um sinal obrigatório de entrada imediata", "Confirmação automática do movimento", "Um alerta de possível enfraquecimento que exige análise de contexto", "Um erro estatístico irrelevante"],
          correct: 2,
          explanation: "Divergência mostra que a convicção (volume) não acompanha o preço. É um alerta amarelo para buscar confirmação, não um gatilho de execução."
        }
      },
      {
        id: "3-5",
        title: "CVD mostra absorção, não previsão",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Nesta aula do Aprenda Futuros, Módulo 3, Aula 5, o objetivo é ensinar como interpretar corretamente o CVD utilizando os gráficos que já estão sendo apresentados na tela.</p>
            
            <p><strong>Observe o gráfico.</strong></p>
            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4"><TechSVG id="cvd-absorption" /></div>
            
            <p>Na parte superior, o preço forma um topo mais alto em relação ao topo anterior. Visualmente, isso pode gerar a percepção de força compradora.</p>
            
            <p>Na parte inferior, o CVD não acompanha esse movimento e forma um topo mais baixo. Esse comportamento indica que o avanço do preço não está sendo sustentado por agressão compradora líquida.</p>
            
            <div className="bg-white/5 p-[16px] rounded-lg  mt-4">
                <p>O CVD representa o saldo acumulado entre agressões de compra e agressões de venda. Quando o preço sobe, mas o CVD perde força, isso sugere absorção, distribuição ou enfraquecimento do fluxo comprador.</p>
            </div>

            <p className="mt-2 text-xs font-bold text-gray-400  pt-2">
                É fundamental entender que essa leitura não prevê queda e não obriga o preço a reverter. O CVD não é um gatilho operacional. Ele é uma ferramenta de contexto, usada para entender o que está acontecendo por trás do movimento do preço.
            </p>
          </div>
        ),
        quiz: {
          question: "O que uma divergência entre preço e CVD, como a apresentada no gráfico, pode indicar?",
          visualId: "cvd-absorption",
          options: ["Reversão obrigatória do preço", "Erro de cálculo do indicador", "Absorção ou enfraquecimento do fluxo comprador", "Continuação garantida da tendência"],
          correct: 2,
          explanation: "Se o preço sobe mas o CVD (Delta de Volume Cumulativo) não acompanha, significa que a agressão de compra está diminuindo ou sendo absorvida por ordens passivas de venda."
        }
      },
      {
        id: "3-6",
        title: "Preço decide, indicador confirma",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Nesta aula do Aprenda Futuros, Módulo 3, Aula 6, o foco é deixar clara a hierarquia correta na tomada de decisão.</p>
            <p>O processo sempre começa pelo preço.</p>
            <p>É o preço que constrói estrutura, define contexto, mostra rompimentos, rejeições, continuação ou consolidação. Nenhum indicador possui autoridade para contrariar essa leitura.</p>
            <p>Os indicadores entram depois, com a função exclusiva de confirmar ou alertar sobre aquilo que o preço já revelou.</p>
            
            <div className="w-full h-48 bg-black  rounded-[10px] p-[16px] flex items-center justify-center my-4"><TechSVG id="price-hierarchy" /></div>
            
            <p>Quando essa hierarquia é invertida e o trader passa a obedecer o indicador antes do preço, ele deixa de ler o mercado e passa a reagir a sinais isolados, frequentemente atrasados e fora de contexto.</p>
            
            <div className="p-[16px] bg-white/5  rounded-lg mt-8 text-center">
                <p className="font-bold text-white mb-2">No gráfico redesenhado desta aula, essa lógica deve ser visualmente evidente.</p>
                <p className="text-xs text-gray-400">Primeiro, o preço constrói o movimento e define a estrutura. Depois, o indicador aparece como confirmação, reforçando a leitura feita no preço.</p>
                <p className="text-xs text-gray-400 mt-2">O indicador não gera a decisão. Ele confirma ou alerta a decisão que já nasceu no preço.</p>
            </div>
            
            <p className="mt-4 text-xs font-bold text-gray-400  pt-2">
                Indicadores não tomam decisões. Eles ajudam a tomar decisões melhores quando usados no contexto correto.
            </p>
          </div>
        ),
        quiz: {
          question: "Qual é a hierarquia correta na tomada de decisão no trading?",
          visualId: "price-hierarchy",
          options: ["Indicador primeiro, preço depois", "Preço primeiro, indicador como confirmação", "Apenas indicador", "Apenas sentimento"],
          correct: 1,
          explanation: "Price Action é rei. O preço reage ao mercado em tempo real. O indicador apenas processa o que o preço já fez. Use o indicador para validar o que o preço está mostrando."
        }
      }
    ]
  },
  // ... rest of modules ...
  {
    id: 4,
    title: "Psicologia e Risco",
    description: "Blindagem mental: Onde 90% dos traders falham.",
    icon: ShieldCheck,
    xpReward: 300,
    lessons: [
      {
        id: "4-1",
        title: "FOMO e a Ansiedade",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p><strong>FOMO (Fear Of Missing Out)</strong> é o medo de ficar de fora. É o que te faz comprar no topo de uma vela verde gigante.</p>
            <p>O mercado sempre dará outra oportunidade. Perder um trade é melhor do que perder dinheiro.</p>
            <div className="p-[16px] bg-white/5  rounded-lg mt-4"><h4 className="text-genesis-accent font-bold uppercase text-[10px] tracking-widest mb-2">Mantra do Gênesis</h4><p>"Eu sou um caçador, não a presa. Eu espero a configuração perfeita. Se ela não aparecer, eu preservo meu capital."</p></div>
          </div>
        ),
        quiz: {
          question: "Qual a melhor atitude ao ver o preço explodir sem você?",
          options: ["Comprar imediatamente a mercado para não perder mais.", "Aguardar um pullback ou reteste técnico para entrar com segurança.", "Entrar com alavancagem máxima para recuperar o tempo perdido.", "Ficar com raiva e fechar o gráfico."],
          correct: 1,
          explanation: "Entrar atrasado (chasing) é a receita para comprar no topo. Aguarde o mercado respirar (pullback) para entrar em uma estrutura válida."
        }
      },
      {
        id: "4-2",
        title: "Overtrading e Vingança",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>Tomou um Stop Loss? A reação natural é querer recuperar imediatamente ("Trading de Vingança").</p>
            <p>Isso leva ao <strong>Overtrading</strong> (operar demais). Você começa a ver entradas onde não existem.</p>
            <p><strong>Regra de Ouro:</strong> Após 2 stops consecutivos, pare. Saia da tela. Seu estado emocional está comprometido e sua análise técnica vale zero nesse momento.</p>
          </div>
        ),
        quiz: {
          question: "O que fazer após tomar um Stop Loss doloroso?",
          options: ["Dobrar a mão na próxima operação (Martingale).", "Abrir uma operação inversa imediatamente.", "Aceitar a perda como custo, analisar o erro friamente e se afastar se necessário.", "Culpar o mercado."],
          correct: 2,
          explanation: "O Stop Loss é o custo do negócio. Aceitá-lo preserva seu capital mental e financeiro. Tentar recuperar na raiva gera perdas maiores."
        }
      }
    ]
  },
  {
    id: 5,
    title: "Padrões Técnicos",
    description: "Biblioteca visual definitiva de geometria de mercado: Continuação e Reversão.",
    icon: Layers,
    xpReward: 350,
    lessons: [
       {
        id: "p-cont-1",
        title: "Continuação: Bandeiras",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Padrões de continuação representam pausas na tendência. O mercado consolida antes de retomar o movimento principal.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="bull-flag" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Bandeira de Alta</h4><p className="text-[10px] text-gray-500 text-center">Mastro forte + Correção descendente curta. Rompimento para cima.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="bear-flag" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Bandeira de Baixa</h4><p className="text-[10px] text-gray-500 text-center">Queda forte + Correção ascendente curta. Rompimento para baixo.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Operar bandeira sem mastro ou consolidação muito longa.</p></div>
          </div>
        ),
        quiz: {
            question: "Qual o gatilho de entrada em uma Bandeira de Alta?",
            visualId: "bull-flag",
            options: ["Na base do canal", "No rompimento da resistência do canal (Topo)", "No meio da consolidação", "Quando o preço cai"],
            correct: 1,
            explanation: "A entrada técnica ocorre no rompimento da linha superior do canal de correção, confirmando a retomada da tendência."
        }
       },
       {
        id: "p-cont-2",
        title: "Continuação: Triângulos",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Compressão de preço contra um nível horizontal. Indica pressão direcional clara.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="asc-triangle" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Triângulo Ascendente</h4><p className="text-[10px] text-gray-500 text-center">Resistência Plana + Fundos Ascendentes. Pressão de compra.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="desc-triangle" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Triângulo Descendente</h4><p className="text-[10px] text-gray-500 text-center">Suporte Plano + Topos Descendentes. Pressão de venda.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Antecipar o rompimento antes do fechamento do candle.</p></div>
          </div>
        ),
        quiz: {
            question: "O que indica um Triângulo Descendente?",
            visualId: "desc-triangle",
            options: ["Força compradora", "Indecisão", "Pressão vendedora constante contra um suporte", "Reversão para alta"],
            correct: 2,
            explanation: "Topos cada vez mais baixos mostram que os vendedores estão agressivos, empurrando o preço contra um suporte fixo até quebrar."
        }
       },
       {
        id: "p-cont-3",
        title: "Continuação: Cunhas",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Cunhas a favor da tendência principal. Cunhas corretivas geralmente rompem a favor do movimento anterior.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="falling-wedge-cont" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Cunha Descendente</h4><p className="text-[10px] text-gray-500 text-center">Em tendência de alta: Correção convergente para baixo. Bullish.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="rising-wedge-cont" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Cunha Ascendente</h4><p className="text-[10px] text-gray-500 text-center">Em tendência de baixa: Correção convergente para cima. Bearish.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Confundir cunha de continuação com cunha de reversão de topo/fundo.</p></div>
          </div>
        ),
        quiz: {
            question: "Uma Cunha Descendente aparecendo durante uma tendência de alta sugere:",
            visualId: "falling-wedge-cont",
            options: ["Reversão para baixa", "Continuação da alta (Rompimento para cima)", "Lateralização infinita", "Crash de mercado"],
            correct: 1,
            explanation: "Cunhas descendentes em uptrend são pausas saudáveis onde a volatilidade diminui antes de nova expansão para cima."
        }
       },
       {
        id: "p-cont-4",
        title: "Continuação: Canais",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Canais definem a estrutura da tendência. Operar a favor da inclinação do canal é seguir o fluxo.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="asc-channel" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Canal de Alta</h4><p className="text-[10px] text-gray-500 text-center">Topos e fundos ascendentes paralelos. Trade: Compra no suporte.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="desc-channel" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Canal de Baixa</h4><p className="text-[10px] text-gray-500 text-center">Topos e fundos descendentes paralelos. Trade: Venda na resistência.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Tentar operar contra a tendência dentro do canal (contra-fluxo).</p></div>
          </div>
        ),
        quiz: {
            question: "Qual a estratégia básica em um Canal de Alta?",
            visualId: "asc-channel",
            options: ["Vender no suporte", "Comprar na resistência", "Comprar no toque da linha inferior (suporte) a favor da tendência", "Vender no meio"],
            correct: 2,
            explanation: "Em canais de alta, a probabilidade está na compra. O ponto ideal é o toque na LTA inferior (suporte do canal)."
        }
       },
       {
        id: "p-cont-5",
        title: "Continuação: Retângulos",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Zonas de acumulação ou redistribuição lateral. O mercado 'respira' antes de continuar.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="bull-rect" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Retângulo de Alta</h4><p className="text-[10px] text-gray-500 text-center">Lateralização após alta. Rompimento da resistência confirma continuação.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="bear-rect" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Retângulo de Baixa</h4><p className="text-[10px] text-gray-500 text-center">Lateralização após queda. Perda do suporte confirma continuação.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Operar rompimento de retângulo sem volume de confirmação.</p></div>
          </div>
        ),
        quiz: {
            question: "O que valida um Retângulo de Continuação de Alta?",
            visualId: "bull-rect",
            options: ["O preço ficar lateral para sempre", "Rompimento do teto (resistência) com volume", "Perda do fundo", "Toque na média móvel"],
            correct: 1,
            explanation: "O padrão é confirmado quando o preço supera a zona de resistência lateral onde estava 'preso', retomando a alta."
        }
       },
       // --- REVERSÃO ---
       {
        id: "p-rev-1",
        title: "Reversão: Ombro Cabeça Ombro",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Padrão clássico de reversão de tendência. Sinaliza exaustão final.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="head-shoulders" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">OCO (Topo)</h4><p className="text-[10px] text-gray-500 text-center">3 picos, central maior. Perda da Neckline = Venda.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="inverse-head-shoulders" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">OCO Invertido (Fundo)</h4><p className="text-[10px] text-gray-500 text-center">3 vales, central menor. Rompimento da Neckline = Compra.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Antecipar a entrada no ombro direito antes da confirmação da Neckline.</p></div>
          </div>
        ),
        quiz: {
            question: "Qual linha define o gatilho de entrada no OCO?",
            visualId: "head-shoulders",
            options: ["Linha de Tendência", "Linha de Pescoço (Neckline)", "Média Móvel", "Topo da Cabeça"],
            correct: 1,
            explanation: "A Neckline conecta os fundos do padrão. Sua quebra confirma a reversão de tendência."
        }
       },
       {
        id: "p-rev-2",
        title: "Reversão: Topo/Fundo Duplo",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Tentativa falha de renovar máxima ou mínima. O preço bate duas vezes na mesma zona e rejeita.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="double-top" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Topo Duplo (M)</h4><p className="text-[10px] text-gray-500 text-center">Rejeição dupla de resistência. Bearish.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="double-bottom" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Fundo Duplo (W)</h4><p className="text-[10px] text-gray-500 text-center">Rejeição dupla de suporte. Bullish.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Não aguardar o rompimento do 'vale' central para confirmar.</p></div>
          </div>
        ),
        quiz: {
            question: "O que valida um Topo Duplo?",
            visualId: "double-top",
            options: ["O segundo topo ser mais alto", "Perda do fundo entre os dois topos (Suporte)", "Toque na resistência", "Volume baixo"],
            correct: 1,
            explanation: "O padrão 'M' só é ativado quando o preço perde o suporte do fundo intermediário."
        }
       },
       {
        id: "p-rev-3",
        title: "Reversão: Xícaras (Cup & Handle)",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Padrões de reversão lentos e arredondados. Indicam acumulação ou distribuição gradual.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="cup-handle" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Xícara (Cup & Handle)</h4><p className="text-[10px] text-gray-500 text-center">Fundo arredondado + Alça corretiva. Alta.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="cup-invert" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Xícara Invertida</h4><p className="text-[10px] text-gray-500 text-center">Topo arredondado + Alça corretiva. Baixa.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Comprar no fundo da xícara em vez de esperar o rompimento da alça.</p></div>
          </div>
        ),
        quiz: {
            question: "Qual a função da 'Alça' (Handle) na Xícara?",
            visualId: "cup-handle",
            options: ["Nenhuma", "Limpar vendedores ansiosos (Shakeout) antes do rompimento", "Indicar queda infinita", "Formar um triângulo"],
            correct: 1,
            explanation: "A alça é um pullback saudável que elimina mãos fracas antes da explosão de preço."
        }
       },
       {
        id: "p-rev-4",
        title: "Reversão: Topo/Fundo Triplo",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Variação mais forte e rara do padrão duplo. Três testes de nível antes da reversão.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="triple-top" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Topo Triplo</h4><p className="text-[10px] text-gray-500 text-center">3 toques na resistência. Exaustão de compra.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="triple-bottom" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Fundo Triplo</h4><p className="text-[10px] text-gray-500 text-center">3 toques no suporte. Exaustão de venda.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Confundir com retângulo de continuação. Aguarde o rompimento.</p></div>
          </div>
        ),
        quiz: {
            question: "O que diferencia um Topo Triplo de um Retângulo?",
            visualId: "triple-top",
            options: ["O volume", "Apenas o rompimento final define (Para baixo = Topo Triplo)", "O tempo", "Nada"],
            correct: 1,
            explanation: "Visualmente são parecidos. Se romper para cima é retângulo de alta. Se romper para baixo, confirma-se o Topo Triplo de reversão."
        }
       },
       {
        id: "p-rev-5",
        title: "Reversão: Exaustão (V-Shape)",
        content: (
          <div className="space-y-8">
            <p className="text-gray-400 text-sm font-medium border-genesis-accent pl-4">Reversões agudas causadas por eventos de liquidez ou notícias. Alta volatilidade.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="exhaustion-top" /></div><h4 className="text-genesis-negative font-bold uppercase text-xs tracking-widest mb-1">Exaustão de Alta (V-Top)</h4><p className="text-[10px] text-gray-500 text-center">Alta parabólica seguida de crash imediato.</p></div><div className="bg-black  rounded-[10px] p-[16px] flex flex-col items-center justify-center"><div className="w-full h-32 mb-4 bg-white/5 rounded-lg p-[16px] flex items-center justify-center"><TechSVG id="exhaustion-bottom" /></div><h4 className="text-genesis-positive font-bold uppercase text-xs tracking-widest mb-1">Exaustão de Baixa (V-Bottom)</h4><p className="text-[10px] text-gray-500 text-center">Queda de pânico seguida de recuperação em V.</p></div></div>
            <div className="p-3 bg-red-900/10 border-red-500/20 rounded"><p className="text-xs text-red-300 font-bold uppercase">Erro Comum: Tentar pegar a faca caindo. Aguarde o pivô de retorno.</p></div>
          </div>
        ),
        quiz: {
            question: "O que causa um padrão de Exaustão (V-Shape)?",
            visualId: "exhaustion-bottom",
            options: ["Mercado lento", "Lateralização", "Liquidação em massa ou evento de cisne negro (pânico/euforia)", "Acumulação"],
            correct: 2,
            explanation: "Movimentos em V ocorrem quando há um clímax de euforia ou pânico, revertendo o preço violentamente."
        }
       }
    ]
  },
  {
    id: 6,
    title: "Falsos Rompimentos (Fakeouts)",
    description: "A armadilha de liquidez mais comum. Entenda para não ser a vítima.",
    icon: AlertOctagon,
    xpReward: 400,
    lessons: [
      {
        id: "fake-1",
        title: "Anatomia da Armadilha",
        content: (
          <div className="space-y-6">
            <div className="bg-red-900/10 border-red-500/20 p-[16px] rounded-xl"><h4 className="text-red-500 font-bold uppercase text-xs mb-2">Definição Técnica</h4><p className="text-gray-300 text-sm">Um falso rompimento ocorre quando o preço supera um nível chave (suporte/resistência), atrai traders de rompimento, captura seus stops e reverte agressivamente para a direção oposta.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-black  p-[16px] rounded-xl flex flex-col items-center"><div className="w-full h-32 mb-2 bg-white/5 rounded p-2 flex items-center justify-between"><TechSVG id="fakeout-up" /></div><span className="text-xs font-bold text-red-400 uppercase block text-center">Bull Trap (Armadilha de Touros)</span><p className="text-[10px] text-gray-500 text-center mt-1">Rompe resistência -&gt; Volume baixo ou pavio -&gt; Reverte forte.</p></div><div className="bg-black  p-[16px] rounded-xl flex flex-col items-center"><div className="w-full h-32 mb-2 bg-white/5 rounded p-2 flex items-center justify-between"><TechSVG id="fakeout-down" /></div><span className="text-xs font-bold text-green-400 uppercase block text-center">Bear Trap (Armadilha de Ursos)</span><p className="text-[10px] text-gray-500 text-center mt-1">Perde suporte -&gt; Pavio de rejeição -&gt; Dispara para cima.</p></div></div>
            <ul className="space-y-2 text-sm text-gray-400 bg-white/5 p-[16px] rounded-xl "><li className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Rompimento sem volume é suspeito.</li><li className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Rompimento esticado (longe das médias) tende a falhar.</li><li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-genesis-positive" /> Sempre aguarde o fechamento do candle.</li></ul>
          </div>
        ),
        quiz: {
          question: "Qual o sinal mais claro de um falso rompimento?",
          visualId: "fakeout-up",
          options: ["O preço rompe com uma vela gigante.", "O preço rompe, deixa um longo pavio contrário e fecha dentro da zona anterior.", "O RSI está baixo.", "O volume é muito alto na direção do rompimento."],
          correct: 1,
          explanation: "O pavio (sombra) indica rejeição. Se o preço foi e voltou no mesmo candle, a força do rompimento foi anulada pela contraparte."
        }
      }
    ]
  },
  {
    id: 7,
    title: "Onde NÃO Entrar",
    description: "Preservação de capital: Zonas de morte e entradas proibidas.",
    icon: Ban,
    xpReward: 350,
    lessons: [
      {
        id: "no-entry-1",
        title: "A Terra de Ninguém",
        content: (
          <div className="space-y-6">
            <p className="text-gray-300 text-sm">Operar no meio do canal, longe de suportes e resistências, é a maneira mais rápida de perder dinheiro. O Risco/Retorno é péssimo (1:1 ou pior).</p>
            <div className="w-full max-w-md mx-auto h-48 bg-black  rounded-[10px] p-[16px] relative flex items-center justify-center"><TechSVG id="middle-entry" /></div>
            <div className="grid grid-cols-2 gap-[16px]"><div className="p-3 border-red-500/30 bg-red-900/10 rounded-lg"><h5 className="text-red-400 font-bold text-xs uppercase mb-1">Erro Crítico</h5><p className="text-[10px] text-gray-400">Entrar "a mercado" porque viu uma vela verde no meio do gráfico.</p></div><div className="p-3 border-genesis-positive/30 bg-green-900/10 rounded-lg"><h5 className="text-genesis-positive font-bold text-xs uppercase mb-1">Ação Correta</h5><p className="text-[10px] text-gray-400">Aguardar o preço chegar na borda (Suporte ou Resistência) para decidir.</p></div></div>
          </div>
        ),
        quiz: {
          question: "Por que não devemos operar no meio de um canal lateral?",
          visualId: "middle-entry",
          options: ["Porque é chato.", "Porque o Risco/Retorno é desfavorável e o stop fica técnico fica longe.", "Porque a corretora cobra mais taxa.", "Porque o volume é sempre baixo."],
          correct: 1,
          explanation: "No meio do caminho, seu alvo está perto e seu stop técnico (atrás do suporte/resistência) está longe. A matemática joga contra você."
        }
      }
    ]
  },
  {
    id: 8,
    title: "Prova de Trader (Desafio Visual)",
    description: "Teste seu olho. Identifique padrões sem dicas textuais.",
    icon: Target,
    xpReward: 1000,
    lessons: [
      {
        id: "exam-1",
        title: "Desafio 1: Identificação",
        content: (
          <div className="text-center">
             <p className="text-gray-400 text-sm mb-6">Analise a geometria abaixo. Não há legendas. Confie no seu olho.</p>
             <div className="w-64 h-48 mx-auto bg-black  rounded-[10px] p-[16px] mb-6 flex items-center justify-center">
                <TechSVG id="desc-triangle" />
             </div>
          </div>
        ),
        quiz: {
          question: "Qual é esta figura e qual sua implicação estatística mais provável?",
          visualId: "desc-triangle",
          options: [
            "Triângulo Ascendente (Alta)",
            "Triângulo Descendente (Continuação de Baixa)",
            "Cunha de Alta (Reversão)",
            "Bandeira de Alta (Continuação)"
          ],
          correct: 1,
          explanation: "Fundo plano (suporte fixo) e topos descendentes (pressão vendedora). É um Triângulo Descendente, padrão clássico de continuação de baixa."
        }
      },
      {
        id: "exam-2",
        title: "Desafio 2: Gatilho",
        content: (
          <div className="text-center">
             <p className="text-gray-400 text-sm mb-6">Onde está o erro nesta operação?</p>
             <div className="w-64 h-48 mx-auto bg-black  rounded-[10px] p-[16px] mb-6 flex items-center justify-center">
                <TechSVG id="fakeout-up" />
             </div>
          </div>
        ),
        quiz: {
          question: "O gráfico mostra um rompimento de resistência. O que aconteceu?",
          visualId: "fakeout-up",
          options: [
            "Rompimento confirmado com sucesso.",
            "Bull Trap (Armadilha): O preço rompeu mas foi rejeitado e voltou para baixo da resistência.",
            "Pullback saudável.",
            "Bandeira de alta."
          ],
          correct: 1,
          explanation: "Clássica Bull Trap. O preço supera a resistência atraindo compradores, mas fecha abaixo dela, deixando os comprados 'presos' no topo."
        }
      }
    ]
  },
  {
    id: 9,
    title: "Matemática do Risco",
    description: "Sobrevivência estatística: Risco/Retorno, Position Sizing e a regra dos 2%.",
    icon: Activity,
    xpReward: 450,
    lessons: [
      {
        id: "risk-1",
        title: "A Regra dos 2% (Position Sizing)",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              O segredo dos traders profissionais não é acertar sempre, é <strong>perder pouco</strong> quando erram.
            </p>
            <p>
              A Regra de Ouro: Nunca arrisque mais de 1% a 2% do seu capital total em uma única operação.
            </p>
            <div className="p-[16px] bg-white/5  rounded-lg mt-4">
              <h4 className="text-genesis-accent font-bold uppercase text-[10px] tracking-widest mb-2">Exemplo Prático</h4>
              <p>
                Banca: $1.000. Risco Máximo: $20 (2%).<br/>
                Se seu Stop Loss técnico custa $50, você <strong>não pode</strong> entrar com 1 lote inteiro. Você deve reduzir a mão para que o stop custe apenas $20.
              </p>
            </div>
          </div>
        ),
        quiz: {
          question: "Se sua banca é de $1.000 e você aceita perder 2% por trade, qual é o valor máximo do seu Stop Loss financeiro?",
          options: [
            "$200",
            "$50",
            "$20",
            "$2"
          ],
          correct: 2,
          explanation: "2% de $1.000 é $20. Este é o 'custo do ingresso'. Se o stop técnico for maior que isso, diminua o tamanho da posição."
        }
      },
      {
        id: "risk-2",
        title: "Risco/Retorno (R:R)",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              Não entre em operações onde o lucro potencial é igual ao risco (1:1). Isso exige uma taxa de acerto altíssima para empatar as taxas.
            </p>
            <p>
              Busque setups com R:R mínimo de <strong>1:2</strong> ou <strong>1:3</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>1:3</strong> significa: Arrisco $1 para ganhar $3.</li>
              <li>Com R:R de 1:3, você pode errar 70% das vezes e ainda ficar no zero a zero.</li>
            </ul>
          </div>
        ),
        quiz: {
          question: "Você identificou um trade com Stop de $50 e Alvo de $150. Qual é o Risco/Retorno?",
          options: [
            "1:1 (Neutro)",
            "1:3 (Excelente)",
            "3:1 (Péssimo)",
            "1:1.5 (Regular)"
          ],
          correct: 1,
          explanation: "Você está arriscando 1 unidade ($50) para buscar 3 unidades de lucro ($150). Risco/Retorno de 1:3."
        }
      },
      {
        id: "risk-3",
        title: "Isolada vs. Cruzada",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              A margem define o que está em jogo na liquidação.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Cruzada (Cross):</strong> Usa todo o saldo da conta como garantia. Menor chance de liquidação imediata, mas risco de perder TUDO se o mercado crashar.</li>
              <li><strong>Isolada (Isolated):</strong> Restringe a perda ao valor alocado na posição. Se liquidar, o resto da banca está salvo.</li>
            </ul>
            <p className="text-genesis-positive font-bold text-xs uppercase tracking-wide mt-2">
              INICIANTES DEVEM USAR SEMPRE MARGEM ISOLADA.
            </p>
          </div>
        ),
        quiz: {
          question: "Qual o perigo da Margem Cruzada (Cross) para iniciantes?",
          options: [
            "Ela cobra taxas maiores.",
            "Ela pode liquidar o saldo total da carteira em um movimento brusco.",
            "Ela não permite alavancagem alta.",
            "Ela fecha o trade automaticamente."
          ],
          correct: 1,
          explanation: "Na margem cruzada, seu saldo livre atua como colateral. Se a posição for muito contra, ela drena todo o saldo disponível até zerar a conta."
        }
      }
    ]
  },
  {
    id: 10,
    title: "Estrutura de Mercado",
    description: "Price Action Puro: Pivôs, Topos, Fundos e Quebra de Estrutura (BOS).",
    icon: TrendingUp,
    xpReward: 500,
    lessons: [
      {
        id: "struct-1",
        title: "Topos e Fundos (A Escada)",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              O preço nunca sobe em linha reta. Ele se move em ondas.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Tendência de Alta:</strong> Topos Mais Altos (HH) e Fundos Mais Altos (HL). Uma escada subindo.</li>
              <li><strong>Tendência de Baixa:</strong> Topos Mais Baixos (LH) e Fundos Mais Baixos (LL). Uma escada descendo.</li>
            </ul>
            <div className="p-[16px] bg-white/5  rounded-lg mt-4">
              <h4 className="text-white font-bold uppercase text-[10px] tracking-widest mb-2">Regra de Operação</h4>
              <p>
                Em tendência de alta, compre nos Fundos Mais Altos (HL). Em baixa, venda nos Topos Mais Baixos (LH). Nunca opere contra a escada.
              </p>
            </div>
          </div>
        ),
        quiz: {
          question: "O que define tecnicamente uma tendência de alta?",
          visualId: "uptrend-struct",
          options: [
            "Velas verdes grandes.",
            "Sequência de Topos e Fundos Ascendentes.",
            "Notícias boas.",
            "RSI acima de 70."
          ],
          correct: 1,
          explanation: "A estrutura de topos e fundos ascendentes é a definição primária de tendência de alta (Dow Theory)."
        }
      },
      {
        id: "struct-2",
        title: "Quebra de Estrutura (BOS)",
        content: (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              A tendência muda quando a estrutura quebra. Isso é chamado de <strong>Break of Structure (BOS)</strong> ou Pivô de Reversão.
            </p>
            <p>
              Exemplo em Alta: O preço faz fundos ascendentes. De repente, ele cai forte e rompe o <strong>último fundo ascendente</strong>.
            </p>
            <p>
              Isso sinaliza que os compradores perderam o controle. A probabilidade agora virou para baixa.
            </p>
          </div>
        ),
        quiz: {
          question: "O preço vinha subindo, mas rompeu o último fundo válido para baixo. O que fazer?",
          visualId: "bos-structure",
          options: [
            "Comprar mais (preço médio), pois está barato.",
            "Considerar uma reversão de tendência e procurar vendas (Short) no repique.",
            "Ignorar.",
            "Entrar em pânico."
          ],
          correct: 1,
          explanation: "A perda do último fundo válido (ChoCH/BOS) é o primeiro sinal técnico de reversão de tendência. Busque vender o próximo topo (que deve ser mais baixo)."
        }
      }
    ]
  }
];

// ... rest of file components (unchanged)
const ASSESSMENT_POOL: AssessmentQuestion[] = [
  { id: 1, visualId: 'desc-triangle', difficulty: 'Basic', question: "O gráfico mostra um Triângulo Descendente (topo descendente e fundo plano). Qual a estatística de rompimento?", options: ["Alta probabilidade de rompimento para cima (Reversão)", "Alta probabilidade de rompimento para baixo (Continuação)", "Indecisão total, 50/50", "Sinal de compra imediata no suporte"], correctIndex: 1, explanation: "Triângulos Descendentes indicam pressão vendedora constante contra um suporte fixo. A probabilidade estatística é o rompimento do suporte." },
  { id: 2, visualId: 'fakeout-up', difficulty: 'Intermediate', question: "O preço rompeu a resistência mas deixou um longo pavio superior e fechou abaixo da linha. Qual a leitura?", options: ["Rompimento Confirmado (Pullback)", "Bull Trap (Armadilha de Touros)", "Bandeira de Alta", "Sinal de força compradora"], correctIndex: 1, explanation: "Rompimento seguido de rejeição imediata (pavio longo) e fechamento abaixo da zona rompida configura uma Bull Trap (Falso Rompimento)." },
  { id: 3, visualId: 'retest-long', difficulty: 'Intermediate', question: "Após romper uma resistência, o preço voltou para testá-la como suporte. Onde é a entrada técnica mais segura?", options: ["No rompimento inicial (Agressivo)", "No toque do reteste com candle de rejeição (Confirmação)", "Abaixo do suporte para pegar liquidez", "No topo anterior"], correctIndex: 1, explanation: "A entrada no reteste oferece a melhor relação Risco/Retorno e confirma que a antiga resistência virou suporte." },
  { id: 4, visualId: 'middle-entry', difficulty: 'Basic', question: "O preço está exatamente no meio de um canal lateral. Qual a ação recomendada?", options: ["Comprar buscando o topo", "Vender buscando o fundo", "Não operar (Terra de Ninguém)", "Aumentar a alavancagem para compensar o range"], correctIndex: 2, explanation: "Operar no meio do range é matematicamente desfavorável. O stop técnico fica longe e o alvo curto (R:R < 1:1)." },
  { id: 5, visualId: 'bear-flag', difficulty: 'Basic', question: "Identifique a estrutura: Mastro de baixa seguido de canal de alta lento.", options: ["Bandeira de Baixa (Continuação)", "Reversão em V", "Cunha de Alta", "Fundo Duplo"], correctIndex: 0, explanation: "Queda forte (mastro) seguida de correção lenta ascendente caracteriza uma Bandeira de Baixa." },
  { id: 6, visualId: 'head-shoulders', difficulty: 'Intermediate', question: "Em um OCO (Ombro-Cabeça-Ombro), quando o padrão é confirmado?", options: ["Na formação do segundo ombro", "No topo da cabeça", "Apenas no rompimento da Neckline (Linha de Pescoço)", "Quando o RSI fica sobrevendido"], correctIndex: 2, explanation: "O padrão OCO só é validado quando o preço perde a linha de pescoço. Antecipar a entrada no ombro direito é um erro comum." },
  { id: 7, visualId: 'rising-wedge-cont', difficulty: 'Advanced', question: "Cunha Ascendente (Rising Wedge) em tendência de alta. O que esperar?", options: ["Aceleração da alta", "Padrão de Reversão Bearish (Queda)", "Lateralização infinita", "Padrão de Continuação Bullish"], correctIndex: 1, explanation: "A Cunha Ascendente mostra perda de momentum comprador (topos e fundos convergindo para cima). É um padrão clássico de reversão para baixa." },
  { id: 8, visualId: 'double-bottom', difficulty: 'Basic', question: "Fundo Duplo (W). Onde posicionar o Stop Loss técnico?", options: ["Logo abaixo da entrada", "Abaixo dos dois fundos formados", "No meio do W", "Não usar stop em reversão"], correctIndex: 1, explanation: "O stop deve estar protegido pela estrutura. Se o preço perder os fundos do W, a tese de reversão é invalidada." },
  { id: 9, visualId: 'asc-triangle', difficulty: 'Intermediate', question: "Triângulo Ascendente rompendo a resistência com volume baixo. Qual o risco?", options: ["Nenhum, volume não importa", "Alto risco de Fakeout (Falso Rompimento)", "Garantia de lucro", "Sinal de acumulação institucional"], correctIndex: 1, explanation: "Rompimentos de resistência exigem volume para confirmar a absorção das ordens de venda. Sem volume, a chance de ser uma armadilha é alta." },
  { id: 10, visualId: 'fakeout-down', difficulty: 'Advanced', question: "Bear Trap: Preço perde suporte, captura liquidez e volta forte. Qual a psicologia por trás?", options: ["Vendedores desistiram", "Stop hunting dos Longs para impulsionar a alta", "Erro da corretora", "Tendência de baixa confirmada"], correctIndex: 1, explanation: "Bear Traps são criadas para estopar posições compradas (gerando venda a mercado) e capturar essa liquidez para montar posições grandes de compra." },
  { id: 11, visualId: 'sym-triangle', difficulty: 'Basic', question: "Triângulo Simétrico (Topo caindo, Fundo subindo). O que fazer?", options: ["Comprar agora", "Vender agora", "Aguardar rompimento e confirmação de lado", "Operar dentro do triângulo"], correctIndex: 2, explanation: "Triângulos simétricos representam indecisão (bilateral). A direção só é definida pelo rompimento." },
  { id: 12, visualId: 'double-top', difficulty: 'Basic', question: "Topo Duplo (M) testando a mesma resistência. O que invalida esse padrão de baixa?", options: ["Rompimento da resistência para cima", "Perda do fundo central", "Diminuição de volume", "RSI alto"], correctIndex: 0, explanation: "Se o preço superar os topos anteriores, a resistência falhou e a tendência de alta continua, invalidando o Topo Duplo." },
  { id: 13, visualId: 'cup-handle', difficulty: 'Advanced', question: "Xícara e Alça (Cup & Handle). Qual a função da 'Alça'?", options: ["Dar chance de saída", "Limpar mãos fracas antes do rompimento (Shakeout)", "Mostrar fraqueza", "Inverter a tendência"], correctIndex: 1, explanation: "A alça é um pullback saudável que elimina mãos fracas antes da explosão de preço." },
  { id: 14, visualId: 'middle-entry', difficulty: 'Intermediate', question: "Entrar 'a mercado' no meio de uma vela gigante de 15m. Qual o erro?", options: ["FOMO (Medo de perder oportunidade) e Stop caro", "Nenhum erro, é momentum", "Spread alto", "Taxa de funding"], correctIndex: 0, explanation: "Entrar em velas esticadas é puramente emocional (FOMO). O preço tende a corrigir, te deixando negativo imediatamente com um stop técnico inviável." },
  { id: 15, visualId: 'desc-triangle', difficulty: 'Advanced', question: "Você está Short em um Triângulo Descendente. O preço rompe a LTB para cima. O que fazer?", options: ["Segurar, vai voltar", "Aumentar a posição (Preço Médio)", "Stopar imediatamente (Invalidação)", "Esperar o próximo suporte"], correctIndex: 2, explanation: "Se o preço rompe a linha de tendência de baixa (LTB) para cima, a estrutura de compressão vendedora foi quebrada. O trade foi invalidado." },
  { id: 16, visualId: 'bull-flag', difficulty: 'Basic', question: "Bandeira de Alta. Qual o alvo técnico projetado?", options: ["10%", "A altura do mastro projetada a partir do rompimento", "O topo anterior", "Aleatório"], correctIndex: 1, explanation: "A projeção técnica clássica de bandeiras é replicar a altura do mastro (movimento anterior) a partir do ponto de rompimento." },
  { id: 17, visualId: 'retest-long', difficulty: 'Intermediate', question: "O reteste no suporte falhou e o preço voltou para baixo da linha. O que isso significa?", options: ["Foi apenas um ruído", "Fakeout confirmado (Bull Trap)", "Oportunidade de compra mais barata", "Tendência de alta forte"], correctIndex: 1, explanation: "Se o suporte não segura o reteste e o preço afunda novamente, o rompimento anterior era falso. O cenário vira baixista." },
  { id: 18, visualId: 'middle-entry', difficulty: 'Advanced', question: "Por que 'Preço Atual' não é setup de entrada?", options: ["Porque o Gênesis não sabe o preço", "Porque entrada exige Contexto, Risco/Retorno e Gatilho", "Porque o mercado está fechado", "Porque o preço muda rápido"], correctIndex: 1, explanation: "Preço é apenas um número. Um setup exige uma região de interesse (contexto), um stop definido (risco) e um sinal de validação (gatilho)." },
  { id: 19, visualId: 'fakeout-up', difficulty: 'Intermediate', question: "Rompimento de topo histórico com divergência de RSI (Preço sobe, RSI cai).", options: ["Sinal de força máxima", "Alerta gravíssimo de reversão/correção", "Ignorar o RSI", "Comprar alavancado"], correctIndex: 1, explanation: "Divergência Bearish em topos indica que o preço está subindo por inércia, mas a força comprador real está acabando. Risco de topo iminente." },
  { id: 20, visualId: 'bollinger-squeeze', difficulty: 'Advanced', question: "O mercado está em consolidação lateral há dias. O que as Bandas de Bollinger indicam quando se estreitam muito?", options: ["Fim da volatilidade para sempre", "Squeeze: Movimento explosivo iminente", "Tendência de baixa", "Erro no indicador"], correctIndex: 1, explanation: "O estreitamento das bandas (Squeeze) indica compressão extrema de volatilidade. A energia acumulada resultará em uma explosão de preço em breve." },
];

const LearnFutures: React.FC = () => {
  // Main Navigation State
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  
  // Lesson State
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [userXP, setUserXP] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [quizState, setQuizState] = useState<'question' | 'correct' | 'wrong'>('question');

  // Assessment State
  const [assessmentStatus, setAssessmentStatus] = useState<'idle' | 'invite' | 'challenge' | 'quiz' | 'result'>('idle');
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [timer, setTimer] = useState(20);
  const [shuffledOptions, setShuffledOptions] = useState<QuizOption[]>([]);
  const [timerActive, setTimerActive] = useState(false);

  // --- LOGIC: NORMAL LESSONS ---
  const activeModule = MODULES_DATA.find(m => m.id === activeModuleId);
  const activeLesson = activeModule ? activeModule.lessons[activeLessonIndex] : null;

  const handleModuleClick = (id: number) => {
    setActiveModuleId(id);
    setActiveLessonIndex(0);
    setQuizState('question');
  };

  const handleAnswer = (optionIndex: number) => {
    if (!activeLesson || !activeLesson.quiz) return;
    if (optionIndex === activeLesson.quiz.correct) {
      setQuizState('correct');
      if (!completedLessons.includes(activeLesson.id)) {
        setCompletedLessons([...completedLessons, activeLesson.id]);
        setUserXP(prev => prev + 50);
      }
    } else {
      setQuizState('wrong');
    }
  };

  const handleNextLesson = () => {
    if (!activeModule) return;
    if (activeLessonIndex < activeModule.lessons.length - 1) {
      setActiveLessonIndex(prev => prev + 1);
      setQuizState('question');
    } else {
      if (!completedLessons.includes(`mod-${activeModule.id}`)) {
          setUserXP(prev => prev + activeModule.xpReward);
          setCompletedLessons([...completedLessons, `mod-${activeModule.id}`]);
      }
      setActiveModuleId(null);
    }
  };

  // --- LOGIC: ASSESSMENT ---
  const startAssessmentFlow = () => {
      setAssessmentStatus('invite');
  };

  const acceptChallenge = () => {
      // Shuffle 20 questions from pool
      const shuffled = [...ASSESSMENT_POOL].sort(() => 0.5 - Math.random());
      setAssessmentQuestions(shuffled);
      setScore({ correct: 0, wrong: 0 });
      setCurrentQIndex(0);
      setAssessmentStatus('quiz');
      prepareQuestion(shuffled[0]);
  };

  const prepareQuestion = (q: AssessmentQuestion) => {
      // Shuffle options
      const opts = q.options.map((text, idx) => ({ id: idx, text }));
      setShuffledOptions(opts.sort(() => 0.5 - Math.random()));
      setTimer(20); // UPDATED TO 20 SECONDS
      setTimerActive(true);
  };

  const handleAssessmentAnswer = (originalIndex: number | null) => {
      setTimerActive(false);
      const currentQ = assessmentQuestions[currentQIndex];
      
      if (originalIndex === currentQ.correctIndex) {
          setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
      } else {
          setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      }

      // Next Question
      if (currentQIndex < assessmentQuestions.length - 1) {
          setTimeout(() => {
              setCurrentQIndex(prev => prev + 1);
              prepareQuestion(assessmentQuestions[currentQIndex + 1]);
          }, 500); // Small delay for UX
      } else {
          setAssessmentStatus('result');
      }
  };

  // Timer Effect
  useEffect(() => {
      let interval: any;
      if (assessmentStatus === 'quiz' && timerActive && timer > 0) {
          interval = setInterval(() => {
              setTimer(prev => prev - 1);
          }, 1000);
      } else if (timer === 0 && timerActive) {
          // Time's up -> Wrong answer
          handleAssessmentAnswer(null); 
      }
      return () => clearInterval(interval);
  }, [timer, timerActive, assessmentStatus]);

  const getLevel = (xp: number) => Math.floor(xp / 300) + 1;

  // --- COURSE COMPLETION LOGIC ---
  const allLessonIds = MODULES_DATA.flatMap(m => m.lessons.map(l => l.id));
  const completedLessonCount = completedLessons.filter(id => allLessonIds.includes(id)).length;
  // Also need to check if all MODULES are marked as complete in completedLessons
  const allModulesCompleted = MODULES_DATA.every(m => completedLessons.includes(`mod-${m.id}`));
  
  const isCourseComplete = allModulesCompleted;

  // --- RENDERERS ---

  const renderAssessment = () => {
      if (assessmentStatus === 'invite') {
          return (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-genesis-accent/10 rounded-full flex items-center justify-center mb-8 border-genesis-accent/20 shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                      <GraduationCap size={48} className="text-genesis-accent" />
                  </div>
                  <h1 className="text-3xl font-thin text-white uppercase tracking-[0.2em] mb-4">Avaliação Gênesis</h1>
                  <p className="text-gray-400 text-sm max-w-md leading-relaxed mb-10">
                      Descubra em qual nível está sua leitura de mercado. <br/>
                      Você é iniciante, intermediário ou avançado?
                  </p>
                  <button onClick={() => setAssessmentStatus('challenge')} className="bg-white text-black hover:bg-genesis-positive px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl flex items-center gap-3">
                      Iniciar A Avaliação <ChevronRight size={14} />
                  </button>
                  <button onClick={() => setAssessmentStatus('idle')} className="mt-6 text-[10px] text-gray-500 hover:text-white uppercase tracking-widest">
                      Voltar ao menu
                  </button>
              </div>
          );
      }

      if (assessmentStatus === 'challenge') {
          return (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in slide-in- duration-500">
                  <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border-yellow-500/20">
                      <Coins size={40} className="text-yellow-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-6">Desafio Aceito?</h2>
                  <div className="bg-white/5 p-6 rounded-xl  max-w-md mb-8">
                      <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                          Esta é uma avaliação prática de alta pressão.
                      </p>
                      <ul className="text-left text-xs text-gray-400 space-y-3 mb-6">
                          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-genesis-positive" /> 20 Questões Técnicas</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-genesis-positive" /> 20 Segundos por questão (Sem pausa)</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-genesis-positive" /> Recompensa: <span className="text-genesis-positive font-bold">+200 Créditos</span> (100% Acerto)</li>
                          <li className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Custo: <span className="text-red-500 font-bold">-200 Créditos</span> (Qualquer erro)</li>
                      </ul>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                          *Simulação Educativa
                      </p>
                  </div>
                  <div className="flex gap-[16px]">
                      <button onClick={() => setAssessmentStatus('idle')} className="px-8 py-3 rounded-lg  hover:bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-widest transition-all">
                          Não, Sair
                      </button>
                      <button onClick={acceptChallenge} className="px-8 py-3 rounded-lg bg-genesis-accent hover:bg-genesis-primaryHover text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all">
                          Sim, Aceito
                      </button>
                  </div>
              </div>
          );
      }

      if (assessmentStatus === 'quiz') {
          const q = assessmentQuestions[currentQIndex];
          const progress = ((currentQIndex + 1) / assessmentQuestions.length) * 100;
          
          return (
              <div className="h-full flex flex-col max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-300">
                  {/* HEADER */}
                  <div className="flex justify-between items-end mb-6">
                      <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Questão {currentQIndex + 1}/{assessmentQuestions.length}</span>
                          <div className="text-xs font-bold text-genesis-accent uppercase tracking-wider mt-1">{q.difficulty} Level</div>
                      </div>
                      <div className="flex items-center gap-2 text-white font-mono text-xl font-bold bg-white/5 px-4 py-2 rounded-lg ">
                          <Timer size={20} className={timer <= 3 ? 'text-red-500 animate-pulse' : 'text-genesis-accent'} />
                          <span className="text-[12px] md:text-xl font-mono text-white tracking-widest">00:{timer.toString().padStart(2, '0')}</span>
                      </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="w-full h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
                      <div className="h-full bg-genesis-accent transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>

                  {/* CONTENT */}
                  <div className="flex-1 flex flex-col md:flex-row gap-8">
                      {/* VISUAL */}
                      <div className="md:w-1/2 bg-black  rounded-2xl p-6 flex items-center justify-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-genesis-accent/5 blur-3xl opacity-50"></div>
                          <div className="w-full h-64 relative z-10 flex items-center justify-center">
                              {q.visualId && <TechSVG id={q.visualId} className="w-full h-full drop--2xl" />}
                          </div>
                      </div>

                      {/* QUESTION & OPTIONS */}
                      <div className="md:w-1/2 flex flex-col justify-center">
                          <h3 className="text-lg font-bold text-white mb-8 leading-relaxed">
                              {q.question}
                          </h3>
                          <div className="space-y-3">
                              {shuffledOptions.map((opt) => (
                                  <button
                                      key={opt.id}
                                      onClick={() => handleAssessmentAnswer(opt.id)}
                                      className="w-full p-[16px] rounded-xl  bg-white/[0.02] hover:bg-white/10 hover:border-genesis-accent/50 hover:text-white text-left text-sm text-gray-300 transition-all duration-200 flex items-center gap-3 group"
                                  >
                                      <div className="w-6 h-6 rounded-full  flex items-center justify-center text-[10px] group-hover:border-genesis-accent group-hover:bg-genesis-accent group-hover:text-black transition-all">
                                          {['A','B','C','D'][shuffledOptions.indexOf(opt)]}
                                      </div>
                                      {opt.text}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          );
      }

      if (assessmentStatus === 'result') {
          const isPerfect = score.correct === assessmentQuestions.length;
          const percentage = (score.correct / assessmentQuestions.length) * 100;
          
          let level = 'Iniciante';
          let feedback = '';
          
          if (score.correct < 10) {
              level = 'Iniciante';
              feedback = "Seu diagnóstico aponta lacunas nos fundamentos estruturais. Você tende a operar por impulso ou sem confirmação adequada. Recomendamos refazer os módulos de 'Fundamentos' e 'Leitura Gráfica' focando em diferenciar rompimentos reais de armadilhas.";
          } else if (score.correct < 17) {
              level = 'Intermediário';
              feedback = "Você possui boa leitura técnica, mas ainda falha em contextos complexos de 'Fakeouts' e 'Psicologia'. Sua técnica é sólida, mas a execução precisa de mais prudência em zonas de risco. Estude mais sobre 'Onde NÃO entrar'.";
          } else {
              level = 'Avançado';
              feedback = "Excelente. Sua leitura de mercado demonstra maturidade, paciência e compreensão profunda de estrutura e liquidez. Você não apenas identifica padrões, mas entende o contexto institucional por trás deles. Mantenha a disciplina.";
          }

          return (
              <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto p-8 animate-in slide-in- duration-700">
                  <div className="w-24 h-24 rounded-full bg-black border-4  flex items-center justify-center mb-8 relative">
                      <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin-slow ${isPerfect ? 'border-genesis-positive' : 'border-genesis-accent'}`}></div>
                      <span className="text-3xl font-bold text-white">{percentage.toFixed(0)}%</span>
                  </div>

                  <h2 className="text-4xl font-thin text-white uppercase tracking-tighter mb-2">Resultado Final</h2>
                  <div className={`text-sm font-bold uppercase tracking-[0.3em] px-4 py-1 rounded mb-8 ${level === 'Avançado' ? 'bg-genesis-positive/10 text-genesis-positive' : (level === 'Intermediário' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-white/10 text-gray-400')}`}>
                      Nível {level}
                  </div>

                  <div className="grid grid-cols-2 gap-8 w-full max-w-md mb-10">
                      <div className="bg-green-900/10 border-green-500/20 p-[16px] rounded-xl text-center">
                          <span className="block text-2xl font-bold text-green-500">{score.correct}</span>
                          <span className="text-[10px] text-green-300 uppercase font-bold tracking-wider">Acertos</span>
                      </div>
                      <div className="bg-red-900/10 border-red-500/20 p-[16px] rounded-xl text-center">
                          <span className="block text-2xl font-bold text-red-500">{score.wrong}</span>
                          <span className="text-[10px] text-red-300 uppercase font-bold tracking-wider">Erros</span>
                      </div>
                  </div>

                  <div className="bg-white/[0.03]  p-8 rounded-2xl w-full mb-8 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-genesis-accent"></div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Activity size={14} className="text-genesis-accent" /> Diagnóstico Técnico
                      </h4>
                      <p className="text-sm text-gray-300 leading-loose text-justify font-light">
                          {feedback}
                      </p>
                  </div>

                  {isPerfect ? (
                      <div className="flex items-center gap-2 text-genesis-positive mb-8 font-bold text-sm uppercase tracking-widest animate-pulse">
                          <Coins size={16} /> +200 Créditos Adicionados
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 text-red-500 mb-8 font-bold text-sm uppercase tracking-widest">
                          <Coins size={16} /> -200 Créditos Deduzidos
                      </div>
                  )}

                  <div className="flex gap-[16px]">
                      <button onClick={() => setAssessmentStatus('idle')} className="px-8 py-3 rounded-xl  hover:bg-white/5 text-white text-xs font-bold uppercase tracking-widest transition-all">
                          Finalizar
                      </button>
                      <button onClick={acceptChallenge} className="px-8 py-3 rounded-xl bg-genesis-accent hover:bg-genesis-primaryHover text-white text-xs font-bold uppercase tracking-widest shadow-lg transition-all flex items-center gap-2">
                          <RefreshCw size={14} /> Refazer Avaliação
                      </button>
                  </div>
              </div>
          );
      }
      return null;
  };

  // --- RENDER MAIN ---
  if (assessmentStatus !== 'idle') {
      return (
          <div className="h-full bg-black relative">
              {/* EXIT BUTTON FOR ASSESSMENT */}
              <button 
                  onClick={() => setAssessmentStatus('idle')} 
                  className="absolute top-6 right-6 p-2 text-gray-600 hover:text-white transition-colors z-[999999]"
              >
                  <X size={24} />
              </button>
              {renderAssessment()}
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      
      {/* HEADER GAMIFICADO */}
      <div className="flex items-center justify-between mb-8  pb-6">
        <div className="flex items-center gap-[16px]">
           <div className="w-12 h-12 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
              <Trophy size={24} className="text-genesis-accent" />
           </div>
           <div>
              <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Academia Gênesis</h1>
              <p className="text-xs text-gray-500 font-mono">Formação de Traders de Alta Performance</p>
           </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Nível Trader</span>
              <span className="text-xl font-bold text-white font-mono">Lvl {getLevel(userXP)}</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">XP Acumulado</span>
              <span className="text-xl font-bold text-genesis-positive font-mono">{userXP}</span>
           </div>
        </div>
      </div>

      {!activeModule ? (
        // DASHBOARD DE MÓDULOS
        <div className="pb-20 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES_DATA.map((module, index) => {
                const isCompleted = completedLessons.includes(`mod-${module.id}`);
                // Unlock/Active Logic:
                // If it is the first module, it is active if NOT completed.
                // If it is > 0, it is active if previous is completed AND current is NOT completed.
                const isPreviousCompleted = index === 0 ? true : completedLessons.includes(`mod-${MODULES_DATA[index - 1].id}`);
                const isActive = isPreviousCompleted && !isCompleted;
                
                // Determine Visual State
                let stateClass = "";
                let statusLabel = "";
                let iconClass = "";
                
                if (isCompleted) {
                    stateClass = "border-genesis-positive/30 bg-genesis-positive/5 cursor-not-allowed opacity-80";
                    statusLabel = "Concluído";
                    iconClass = "bg-genesis-positive/20 text-genesis-positive";
                } else if (isActive) {
                    stateClass = "hover:border-genesis-accent/30 hover:-translate-y-1  cursor-pointer bg-genesis-card";
                    statusLabel = "Iniciar";
                    iconClass = "bg-white/5 text-genesis-accent group-hover:bg-genesis-accent group-hover:text-black";
                } else {
                    // Future / Locked
                    stateClass = " opacity-40 cursor-not-allowed grayscale bg-genesis-card";
                    statusLabel = "Bloqueado";
                    iconClass = "bg-white/5 text-gray-600";
                }
                
                return (
                <button 
                    key={module.id} 
                    onClick={() => isActive && handleModuleClick(module.id)}
                    disabled={!isActive}
                    className={`text-left rounded-2xl p-6 relative group transition-all duration-300 flex flex-col h-full ${stateClass}`}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${iconClass}`}>
                            <module.icon size={24} />
                        </div>
                        <span className={`text-xs font-medium ${isCompleted ? 'text-genesis-positive' : (isActive ? 'text-white' : 'text-gray-500')}`}>
                            Módulo {module.id}
                        </span>
                    </div>

                    <h3 className={`text-lg font-bold mb-2 uppercase tracking-wide ${isCompleted ? 'text-genesis-positive' : 'text-white'}`}>
                        {module.title}
                    </h3>
                    <p className="text-sm text-gray-500 font-light leading-relaxed mb-6 flex-1">
                        {module.description}
                    </p>

                    <div className=" pt-4 flex justify-between items-center w-full mt-auto">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1">
                        <Star size={10} className="fill-current" /> {module.xpReward} XP
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${
                            isCompleted ? 'text-genesis-positive' : (isActive ? 'text-genesis-accent' : 'text-gray-600')
                        }`}>
                        {statusLabel} {isActive && <ChevronRight size={12} />}
                        {isCompleted && <CheckCircle2 size={12} />}
                        {!isActive && !isCompleted && <Lock size={12} />}
                        </span>
                    </div>
                </button>
                );
            })}
            </div>

            {/* AVALIAÇÃO GÊNESIS CALL-TO-ACTION */}
            <div className=" pt-8">
                <div 
                    onClick={isCourseComplete ? startAssessmentFlow : undefined} 
                    className={` from-[#0a0a0a] to-[#111] rounded-2xl p-8 relative overflow-hidden transition-all duration-500
                        ${isCourseComplete 
                            ? 'border-genesis-accent/30 hover:border-genesis-accent/60 cursor-pointer group' 
                            : ' opacity-50 cursor-not-allowed grayscale'
                        }`}
                    title={!isCourseComplete ? "Você precisa concluir todos os módulos do curso para liberar a avaliação." : ""}
                >
                    <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] transition-all ${isCourseComplete ? 'bg-genesis-accent/5 group-hover:bg-genesis-accent/10' : 'bg-transparent'}`}></div>
                    
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform ${isCourseComplete ? 'bg-genesis-accent text-black shadow-[0_0_30px_rgba(139,92,246,0.3)] group-hover:scale-110' : 'bg-white/10 text-gray-500'}`}>
                                <GraduationCap size={32} />
                            </div>
                            <div>
                                <span className={`text-[10px] font-bold uppercase tracking-[0.3em] mb-2 block ${isCourseComplete ? 'text-genesis-accent' : 'text-gray-500'}`}>
                                    {isCourseComplete ? 'Certificação Final' : 'Bloqueado'}
                                </span>
                                <h2 className="text-3xl font-thin text-white uppercase tracking-tighter">Avaliação Gênesis</h2>
                                <p className="text-gray-400 text-sm font-light mt-2 max-w-lg">
                                    Teste sua leitura de mercado em um ambiente de alta pressão. 
                                    20 questões, 20 segundos, sem volta. Você está pronto?
                                </p>
                            </div>
                        </div>
                        <div className={`px-8 py-4 rounded-xl transition-colors ${isCourseComplete ? 'bg-genesis-positive border-genesis-positive text-black' : 'bg-white/5  text-gray-500'}`}>
                            <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                {isCourseComplete ? 'Iniciar Avaliação' : 'Conclua o Curso'} <ChevronRight size={14} />
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      ) : (
        // VISUALIZAÇÃO DA LIÇÃO (Normal Flow)
        <div className="max-w-5xl mx-auto w-full animate-in slide-in- duration-500 pb-20">
           <button 
             onClick={() => setActiveModuleId(null)}
             className="mb-6 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
           >
             <ChevronRight size={14} className="rotate-180" /> Voltar ao Menu
           </button>

           <div className="bg-genesis-card  rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
              
              {/* SIDEBAR DA LIÇÃO */}
              <div className="md:w-72 bg-black/40  p-6 flex flex-col">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Plano de Estudo</h3>
                 <div className="space-y-2">
                    {activeModule.lessons.map((lesson, idx) => (
                       <button 
                         key={lesson.id}
                         onClick={() => { setActiveLessonIndex(idx); setQuizState('question'); }}
                         className={`w-full text-left p-3 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors
                           ${idx === activeLessonIndex ? 'bg-genesis-accent/10 text-genesis-accent border-genesis-accent/20' : 
                             (completedLessons.includes(lesson.id) ? 'text-genesis-positive opacity-70' : 'text-gray-500 hover:bg-white/5')}`}
                       >
                          <div className={`w-1.5 h-1.5 rounded-full ${idx === activeLessonIndex ? 'bg-genesis-accent animate-pulse' : (completedLessons.includes(lesson.id) ? 'bg-genesis-positive' : 'bg-gray-700')}`}></div>
                          {lesson.title}
                       </button>
                    ))}
                 </div>
              </div>

              {/* CONTEÚDO DA LIÇÃO */}
              <div className="flex-1 p-8 md:p-12 flex flex-col">
                 {activeLesson && (
                   <>
                     <div className="mb-8">
                        <span className="text-[10px] font-bold text-genesis-accent uppercase tracking-widest mb-2 block">
                           Módulo {activeModule.id} • Aula {activeLessonIndex + 1}
                        </span>
                        <h2 className="text-3xl font-light text-white mb-6 uppercase tracking-tight">{activeLesson.title}</h2>
                        <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white">
                           {activeLesson.content}
                        </div>
                     </div>

                     {/* QUIZ AREA */}
                     {activeLesson.quiz && (
                       <div className="mt-auto pt-8 ">
                          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                             <Zap size={16} className="text-yellow-400" /> Validação de Conhecimento
                          </h3>
                          
                          {/* VISUAL QUESTION SUPPORT */}
                          {activeLesson.quiz.visualId && (
                              <div className="mb-6 w-full max-w-md mx-auto h-48 bg-black/40  rounded-[10px] p-[16px] flex items-center justify-center">
                                  <TechSVG id={activeLesson.quiz.visualId} className="w-full h-full" />
                              </div>
                          )}

                          <p className="text-sm text-gray-200 mb-6 font-medium bg-white/5 p-[16px] rounded-lg ">
                            {activeLesson.quiz.question}
                          </p>

                          <div className="grid gap-3">
                             {activeLesson.quiz.options.map((option, idx) => {
                               let btnClass = "bg-black  hover:bg-white/5 text-gray-400";
                               if (quizState === 'correct' && idx === activeLesson.quiz!.correct) btnClass = "bg-genesis-positive/10 border-genesis-positive text-genesis-positive font-bold";
                               if (quizState === 'wrong' && idx !== activeLesson.quiz!.correct) btnClass = "opacity-30 cursor-not-allowed";
                               
                               return (
                                 <button
                                   key={idx}
                                   onClick={() => handleAnswer(idx)}
                                   disabled={quizState !== 'question'}
                                   className={`w-full p-[16px] rounded-xl text-left text-xs uppercase tracking-wide transition-all duration-300 flex items-center gap-3 ${btnClass}`}
                                 >
                                   <MousePointerClick size={14} className="opacity-50" />
                                   {option}
                                 </button>
                               )
                             })}
                          </div>

                          {quizState !== 'question' && (
                             <div className={`mt-6 p-6 rounded-xl animate-in fade-in slide-in- duration-500 ${quizState === 'correct' ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                <div className="flex items-start gap-[16px]">
                                   {quizState === 'correct' ? <CheckCircle2 className="text-genesis-positive shrink-0" /> : <AlertTriangle className="text-red-500 shrink-0" />}
                                   <div>
                                      <h4 className={`text-sm font-bold uppercase tracking-wide mb-2 ${quizState === 'correct' ? 'text-genesis-positive' : 'text-red-500'}`}>
                                         {quizState === 'correct' ? 'Análise Correta' : 'Análise Incorreta'}
                                      </h4>
                                      <p className="text-xs text-gray-300 leading-relaxed font-light">
                                         {activeLesson.quiz.explanation}
                                      </p>
                                   </div>
                                </div>
                                {quizState === 'correct' && (
                                  <button 
                                    onClick={handleNextLesson}
                                    className="mt-6 bg-white text-black hover:bg-gray-200 px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-lg flex items-center gap-2"
                                  >
                                     Próxima Aula <ChevronRight size={14} />
                                  </button>
                                )}
                                {quizState === 'wrong' && (
                                  <button 
                                    onClick={() => setQuizState('question')}
                                    className="mt-6 bg-transparent  hover:bg-white/5 text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                                  >
                                     <XCircle size={14} /> Tentar Novamente
                                  </button>
                                )}
                             </div>
                          )}
                       </div>
                     )}
                   </>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default LearnFutures;
