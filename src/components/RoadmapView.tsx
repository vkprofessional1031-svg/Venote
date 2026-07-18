'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Milestone {
  label: string;
  description: string;
}

export interface RoadmapViewProps {
  title: string;
  goal: string;
  milestones: Milestone[];
  onUpdate?: (data: any) => void;
}

export default function RoadmapView({ title, goal, milestones, onUpdate }: RoadmapViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(title);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingTitle]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check on mount
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const saveTitle = () => {
    if (onUpdate && titleText.trim() && titleText !== title) {
      onUpdate({ type: 'roadmap', title: titleText, goal, milestones });
    }
    setEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void, cancelAction: () => void) => {
    if (e.key === 'Enter') action();
    else if (e.key === 'Escape') cancelAction();
  };

  const handleShare = async () => {
    let text = `${title}\nGoal: ${goal}\n\n`;
    text += milestones.map((m, i) => `${i + 1}. ${m.label}\n   ${m.description}`).join('\n\n');
    
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setToastMessage('Copied to clipboard');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to share', err);
    }
  };

  const handleDownload = async () => {
    if (!svgRef.current) return;
    setIsDownloading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      const exportLabels = svgClone.querySelector('.export-labels') as SVGGElement;
      if (exportLabels) {
        exportLabels.style.display = 'block';
      }
      
      const svgData = new XMLSerializer().serializeToString(svgClone);
      
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.fillStyle = '#1E1A17';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(true);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });
      
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas toBlob failed');
        
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'roadmap';
        a.download = `${safeTitle}.png`;
        a.href = downloadUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        setToastMessage('Download started');
        setTimeout(() => setToastMessage(null), 3000);
      }, 'image/png');
      
    } catch (err) {
      console.error('Failed to download roadmap:', err);
      setToastMessage('Failed to generate image');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Dynamic SVG Calculation ---
  const totalPoints = milestones.length + 1;
  const CANVAS_WIDTH = isMobile ? 400 : 800; 
  const ROW_HEIGHT = isMobile ? 220 : 160;
  const CANVAS_HEIGHT = Math.max(isMobile ? 500 : 400, totalPoints * ROW_HEIGHT + 100);
  
  // Calculate coordinates for milestones + goal
  const points = Array.from({ length: totalPoints }).map((_, i) => {
    const y = i * ROW_HEIGHT + 100;
    // Alternate left/right. Range 35% to 65% on mobile, 25% to 75% on desktop
    const isLeft = i % 2 === 0;
    const x = isLeft 
      ? (isMobile ? CANVAS_WIDTH * 0.35 : CANVAS_WIDTH * 0.25)
      : (isMobile ? CANVAS_WIDTH * 0.65 : CANVAS_WIDTH * 0.75);
    return { x, y, isLeft, isGoal: i === totalPoints - 1 };
  });

  // Build segments for tapering effect
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const cp1y = current.y + ROW_HEIGHT / 2;
    const cp2y = next.y - ROW_HEIGHT / 2;
    const d = `M ${current.x} ${current.y} C ${current.x} ${cp1y}, ${next.x} ${cp2y}, ${next.x} ${next.y}`;
    
    const widthStart = 48;
    const widthEnd = 16;
    const progress = i / Math.max(1, (points.length - 2));
    const strokeWidth = widthStart - (widthStart - widthEnd) * progress;
    const dashWidth = Math.max(2, strokeWidth * 0.15);

    segments.push({ d, strokeWidth, dashWidth });
  }

  // --- Markers ---
  const StackedMarker = ({ x, y, num, isGoal }: { x: number, y: number, num?: number, isGoal?: boolean }) => {
    const primaryColor = isGoal ? '#FF5C38' : '#1E1A17';
    const textColor = '#F5EDD9';
    const radiusX = isGoal ? 36 : 28;
    const radiusY = isGoal ? 22 : 16;
    const offsets = [14, 9, 4];
    
    return (
      <g transform={`translate(${x}, ${y})`}>
        {offsets.map((offset, i) => (
          <ellipse 
            key={i} 
            cx="0" cy={offset} rx={radiusX} ry={radiusY} 
            fill={isGoal ? '#8a2b16' : '#0a0908'} 
            opacity={0.5 + i * 0.15}
          />
        ))}
        <ellipse cx="0" cy="0" rx={radiusX} ry={radiusY} fill={primaryColor} stroke="#F5EDD9" strokeWidth="1" strokeOpacity="0.2"/>
        <text 
          x="0" y="5" 
          textAnchor="middle" 
          fill={textColor} 
          fontFamily="sans-serif" 
          fontWeight="bold" 
          fontSize={isGoal ? "14" : "16"}
        >
          {isGoal ? "GOAL" : num}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full bg-card rounded-[24px] border border-hairline overflow-hidden shadow-2xl">
      <div className="p-6 md:p-8 lg:p-10 pb-0">
        <div className="flex items-center justify-between mb-6 md:mb-8 relative">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-[#1D9E75]/10 text-[#1D9E75] flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-2.25 5.447 2.724A1 1 0 0121 8.382v10.764a1 1 0 01-1.447.894L15 17l-6 2.25z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7v13M15 4v13" />
            </svg>
            ROADMAP
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button" 
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-2 text-muted-text hover:text-primary-accent transition-colors rounded-lg bg-background/50 hover:bg-background disabled:opacity-50"
              title="Download as PNG"
            >
              {isDownloading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button
              type="button" 
              onClick={handleShare}
              className="p-2 text-muted-text hover:text-primary-accent transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Share card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            </button>
            <button
              type="button" 
              onClick={() => setEditingTitle(true)}
              className="p-2 text-muted-text hover:text-primary-text transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Edit title"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
          
          {toastMessage && (
            <div className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-primary-accent text-primary-text text-xs font-bold rounded shadow-lg z-10 transition-opacity">
              {toastMessage}
            </div>
          )}
        </div>

        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => handleKeyDown(e, saveTitle, () => setEditingTitle(false))}
            className="w-full font-serif italic font-bold text-2xl md:text-4xl text-primary-text bg-background border border-primary-accent/50 rounded px-3 py-2 mb-6 md:mb-8 tracking-tight leading-snug outline-none"
          />
        ) : (
          <h2 
            onClick={() => setEditingTitle(true)}
            className="font-serif italic font-bold text-2xl md:text-4xl text-primary-text mb-6 md:mb-8 tracking-tight leading-snug cursor-text hover:text-white transition-colors inline-block"
          >
            {title}
          </h2>
        )}
      </div>

      {/* SVG Canvas & Overlay */}
      <div className="relative w-full overflow-y-auto overflow-x-hidden custom-scrollbar max-h-[70vh] border-t border-hairline/50">
        <div className="w-full relative" style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}>
          
          <svg ref={svgRef} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="w-full h-full absolute inset-0 preserve-3d">
            <defs>
              <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1D9E75" />
                <stop offset="100%" stopColor="#FF5C38" />
              </linearGradient>
            </defs>
            
            {/* Base Road */}
            {segments.map((seg, i) => (
              <path key={`base-${i}`} d={seg.d} fill="none" stroke="url(#roadGrad)" strokeWidth={seg.strokeWidth} strokeLinecap="round" />
            ))}
            
            {/* Dashed Center Line */}
            {segments.map((seg, i) => (
              <path key={`dash-${i}`} d={seg.d} fill="none" stroke="#F5EDD9" strokeOpacity="0.85" strokeWidth={seg.dashWidth} strokeDasharray={`${seg.dashWidth * 2} ${seg.dashWidth * 3}`} strokeLinecap="round" />
            ))}
            
            {/* Checkered pattern at the end */}
            <g transform={`translate(${points[points.length-1].x - 24}, ${points[points.length-1].y - 40})`}>
              <rect x="0" y="0" width="16" height="16" fill="#1E1A17" />
              <rect x="16" y="0" width="16" height="16" fill="#F5EDD9" />
              <rect x="32" y="0" width="16" height="16" fill="#1E1A17" />
              <rect x="0" y="16" width="16" height="16" fill="#F5EDD9" />
              <rect x="16" y="16" width="16" height="16" fill="#1E1A17" />
              <rect x="32" y="16" width="16" height="16" fill="#F5EDD9" />
            </g>

            {/* Pennant at start */}
            <g transform={`translate(${points[0].x - 30}, ${points[0].y - 50})`}>
              <line x1="0" y1="0" x2="0" y2="40" stroke="#888" strokeWidth="4" strokeLinecap="round" />
              <polygon points="0,0 24,10 0,20" fill="#888" />
            </g>

            {/* Markers */}
            {points.map((pt, i) => (
              <StackedMarker key={`marker-${i}`} x={pt.x} y={pt.y} num={i + 1} isGoal={pt.isGoal} />
            ))}

            {/* SVG Text Labels (Visible only on export or fallback) */}
            <g className="export-labels" style={{ display: 'none' }}>
              {points.map((pt, i) => {
                if (pt.isGoal) {
                  return (
                    <g key={`svg-goal-${i}`} transform={`translate(${pt.x}, ${pt.y - 60})`}>
                      <rect x="-140" y="-20" width="280" height="40" rx="20" fill="#1E1A17" stroke="#F5EDD9" strokeWidth="1" strokeOpacity="0.2"/>
                      <text x="0" y="7" textAnchor="middle" fill="#F5EDD9" fontFamily="serif" fontStyle="italic" fontWeight="bold" fontSize="24">{goal}</text>
                    </g>
                  );
                }
                const milestone = milestones[i];
                return (
                  <g key={`svg-label-${i}`} transform={`translate(${pt.x}, ${pt.y + 50})`}>
                    <rect x="-100" y="-16" width="200" height="32" rx="16" fill="#1E1A17" stroke="#F5EDD9" strokeWidth="1" strokeOpacity="0.2"/>
                    <text x="0" y="5" textAnchor="middle" fill="#F5EDD9" fontFamily="sans-serif" fontSize="14" fontWeight="500">{milestone.label}</text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* HTML Overlay for Text Chips */}
          {points.map((pt, i) => {
            if (pt.isGoal) {
              return (
                <div 
                  key={`html-${i}`} 
                  className="absolute flex flex-col items-center"
                  style={{ 
                    left: `${(pt.x / CANVAS_WIDTH) * 100}%`, 
                    top: `${(pt.y / CANVAS_HEIGHT) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    marginTop: '-40px',
                    width: 'max-content',
                    maxWidth: isMobile ? '220px' : '320px'
                  }}
                >
                  <div className="font-serif italic font-bold text-xl md:text-2xl text-primary-text mb-2 bg-background/80 px-5 py-2 rounded-[20px] backdrop-blur-md border border-hairline shadow-lg text-center break-words leading-tight w-full">
                    {goal}
                  </div>
                </div>
              );
            }

            const milestone = milestones[i];
            const isExpanded = expandedIndex === i;

            return (
              <div 
                key={`html-${i}`}
                className="absolute flex flex-col items-center z-10"
                style={{ 
                  left: `${(pt.x / CANVAS_WIDTH) * 100}%`, 
                  top: `${(pt.y / CANVAS_HEIGHT) * 100}%`,
                  transform: 'translate(-50%, 0)',
                  marginTop: isMobile ? '30px' : '36px',
                  width: 'max-content',
                  maxWidth: isMobile ? '160px' : '260px'
                }}
              >
                <button
                  type="button" 
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="bg-[#1E1A17] border border-hairline rounded-[20px] px-3 py-2 sm:px-4 sm:py-1.5 shadow-xl hover:border-primary-accent/50 transition-colors z-20 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 group w-full"
                >
                  <span className="font-sans text-xs sm:text-sm font-medium text-primary-text text-center break-words leading-tight">
                    {milestone.label}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-muted-text group-hover:text-primary-text transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Description Popover/Expansion */}
                {isExpanded && (
                  <div className="mt-2 w-[200px] sm:w-[260px] bg-card border border-hairline rounded-xl p-3 shadow-2xl text-xs sm:text-sm text-muted-text font-sans leading-relaxed animate-in fade-in slide-in-from-top-2 break-words">
                    {milestone.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
