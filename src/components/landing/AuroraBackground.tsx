'use client';

export default function AuroraBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Soft Aurora Mesh Blobs */}
      <div className="landing-aurora-blob orange w-[62vw] max-w-[740px] min-w-[320px] aspect-square -top-[14%] -left-[8%]" />
      <div className="landing-aurora-blob purple w-[56vw] max-w-[680px] min-w-[300px] aspect-square top-[15%] -right-[10%]" />
      <div className="landing-aurora-blob gold w-[52vw] max-w-[620px] min-w-[280px] aspect-square -bottom-[12%] left-[18%]" />

      {/* Faint SVG Grain Overlay */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 'var(--landing-grain-opacity, 0.03)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
        }}
      />

      {/* Scattered Geometric Shards & Dots in Hero Area (Echoing Brand Logo) */}
      <svg
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1440px] h-[760px] opacity-60"
        viewBox="0 0 1440 760"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g className="landing-shard" style={{ animationDelay: '0s' }}>
          <polygon points="180,140 194,164 166,164" fill="#FF5C38" fillOpacity="0.32" />
          <circle cx="220" cy="195" r="3" fill="#E8B86D" fillOpacity="0.4" />
        </g>
        <g className="landing-shard" style={{ animationDelay: '-3.5s' }}>
          <polygon points="1240,165 1258,188 1230,194" fill="#8B5CF6" fillOpacity="0.32" />
          <circle cx="1190" cy="135" r="3.5" fill="#FF5C38" fillOpacity="0.35" />
        </g>
        <g className="landing-shard" style={{ animationDelay: '-7s' }}>
          <polygon points="260,440 275,462 248,468" fill="#E8B86D" fillOpacity="0.28" />
          <circle cx="145" cy="360" r="2.5" fill="#8B5CF6" fillOpacity="0.35" />
        </g>
        <g className="landing-shard" style={{ animationDelay: '-5s' }}>
          <polygon points="1185,430 1202,450 1176,456" fill="#FF5C38" fillOpacity="0.26" />
          <circle cx="1275" cy="355" r="3" fill="#E8B86D" fillOpacity="0.35" />
        </g>
      </svg>
    </div>
  );
}

