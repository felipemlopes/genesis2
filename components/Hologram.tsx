
import React, { useEffect, useRef } from 'react';

const Hologram: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
  
    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
  
      let animationFrameId: number;
      let width = canvas.width;
      let height = canvas.height;
  
      const resize = () => {
        const parent = canvas.parentElement;
        if (parent) {
          // High DPI canvas support
          const dpr = window.devicePixelRatio || 1;
          width = parent.clientWidth || 300;
          height = parent.clientHeight || 400;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
      };
  
      window.addEventListener('resize', resize);
      resize();
  
      // 3D Sphere Points Generation (Fibonacci Sphere)
      const points: { x: number, y: number, z: number, color: string }[] = [];
      const numPoints = 350; // Sufficient density for a nice globe
      for (let i = 0; i < numPoints; i++) {
          const phi = Math.acos(-1 + (2 * i) / numPoints);
          const theta = Math.sqrt(numPoints * Math.PI) * phi;
          points.push({
              x: Math.cos(theta) * Math.sin(phi),
              y: Math.sin(theta) * Math.sin(phi),
              z: Math.cos(phi),
              color: Math.random() > 0.4 ? '#b026ff' : '#05d5ff'
          });
      }
  
      let rx = 0;
      let ry = 0;
      let targetRx = 0;
      let targetRy = 0;
  
      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left - width / 2;
        const my = e.clientY - rect.top - height / 2;
        
        // Target rotation mapped to mouse position
        targetRy = (mx / width) * Math.PI; 
        targetRx = (my / height) * Math.PI * 0.5;
      };
      
      // Catch mouse everywhere
      window.addEventListener('mousemove', handleMouseMove);
  
      let time = 0;
  
      const draw = () => {
        time += 0.003;
        ctx.clearRect(0, 0, width, height);
        
        // Smooth interpolation for mouse interaction
        rx += (targetRx - rx) * 0.05;
        ry += (targetRy - ry) * 0.05;
        
        // Add continuous automatic rotation
        const currentRy = ry + time;
        const currentRx = rx + Math.sin(time * 0.5) * 0.2; // slight bobbing in X axis
  
        const radius = Math.min(width, height) * 0.45;
        const focalLength = 400;
  
        // Transform points to 3D and project to 2D
        const projectedPoints = points.map(p => {
          // Rotate X
          let y1 = p.y * Math.cos(currentRx) - p.z * Math.sin(currentRx);
          let z1 = p.y * Math.sin(currentRx) + p.z * Math.cos(currentRx);
  
          // Rotate Y
          let x2 = p.x * Math.cos(currentRy) + z1 * Math.sin(currentRy);
          let z2 = -p.x * Math.sin(currentRy) + z1 * Math.cos(currentRy);
          let y2 = y1;
  
          const scale = focalLength / (focalLength + z2 * radius * 0.6);
          const px = width / 2 + x2 * radius * scale;
          const py = height / 2 + y2 * radius * scale;
  
          return { x: px, y: py, z: z2, scale, color: p.color };
        });
  
        // Sort points by Z to draw back-to-front for proper visual overlapping
        projectedPoints.sort((a, b) => b.z - a.z);
  
        // Draw connections for visual structure
        ctx.lineWidth = 0.8;
        for (let i = 0; i < projectedPoints.length; i++) {
           const p1 = projectedPoints[i];
           // Reduce opacity for elements in the back
           if (p1.z > 0.4) continue; 
  
           let connectCount = 0;
           for (let j = i + 1; j < projectedPoints.length && connectCount < 3; j++) {
              const p2 = projectedPoints[j];
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < 65 * p1.scale) {
                 ctx.beginPath();
                 ctx.moveTo(p1.x, p1.y);
                 ctx.lineTo(p2.x, p2.y);
                 const alpha = Math.max(0, 0.4 - (dist / (65 * p1.scale)) * 0.4) * (p1.scale);
                 // Using purple/cyan blend for connections
                 ctx.strokeStyle = p1.color === '#b026ff' ? `rgba(176, 38, 255, ${alpha})` : `rgba(5, 213, 255, ${alpha})`;
                 ctx.stroke();
                 connectCount++;
              }
           }
        }
  
        // Draw particles
        projectedPoints.forEach(p => {
          const size = Math.max(0.6, 2.5 * p.scale);
          const alpha = Math.max(0.15, p.scale * 1.2);
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          
          // Add glow for front particles
          if (p.z < -0.2) {
             ctx.shadowBlur = 12 * p.scale;
             ctx.shadowColor = p.color;
          } else {
             ctx.shadowBlur = 0;
          }
          
          ctx.fillStyle = p.color === '#b026ff' ? `rgba(176, 38, 255, ${alpha})` : `rgba(5, 213, 255, ${alpha})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
  
        animationFrameId = requestAnimationFrame(draw);
      };
  
      draw();
  
      return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationFrameId);
      };
    }, []);
  
    return (
      <div className="relative w-full h-[400px] md:h-[600px] flex items-center justify-center pointer-events-none">
        <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none w-full h-full" />
        
        {/* Overlay to fade edges (Shadow borders) */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none" 
          style={{
            background: 'radial-gradient(circle at center, transparent 35%, black 75%, black 100%)'
          }}
        ></div>
  
        {/* Brilho pulsante central para melhorar a profundidade e imersão 3D */}
        <div className="relative z-0 w-[200px] h-[200px] flex items-center justify-center animate-pulse-slow mix-blend-screen opacity-70">
           <div className="absolute inset-0 bg-[#b026ff]/30 rounded-full blur-[80px]"></div>
           <div className="absolute inset-0 bg-[#05d5ff]/20 rounded-full blur-[60px] opacity-60"></div>
        </div>
      </div>
    );
  };
  
  export default Hologram;
