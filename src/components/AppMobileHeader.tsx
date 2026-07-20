import Link from "next/link";
import React from "react";

interface AppMobileHeaderProps {
  onOpenMenu: () => void;
  rightContent?: React.ReactNode;
}

export default function AppMobileHeader({ onOpenMenu, rightContent }: AppMobileHeaderProps) {
  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b border-hairline bg-background sticky top-0 z-30">
      <Link href="/app" className="flex items-center gap-3">
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); onOpenMenu(); }}
          className="p-2 -ml-2 text-primary-text rounded-lg hover:bg-card transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#logo-grad-mobile)"/>
            <defs>
              <linearGradient id="logo-grad-mobile" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6B3D"/>
                <stop offset="1" stopColor="#FF3B1D"/>
              </linearGradient>
            </defs>
            <path d="M14.5 22.5L9 11.5H13L16 18L21 9H25L17.5 22.5H14.5Z" fill="white"/>
            <circle cx="8" cy="14" r="1.5" fill="white"/>
            <circle cx="10" cy="20" r="1" fill="white"/>
            <circle cx="7" cy="18" r="1" fill="white"/>
            <polygon points="10,8 13,10 9,11" fill="white"/>
            <polygon points="8,21 12,23 9,24" fill="white"/>
            <polygon points="12,14 15,16 12,17" fill="white"/>
          </svg>
          <span className="font-serif italic font-bold text-2xl tracking-tight leading-none text-[#F5EDD9] pt-1">Venote</span>
        </div>
      </Link>
      {rightContent && rightContent}
    </div>
  );
}
