'use client';
import { useEffect, useState, type ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`venote-skeleton rounded-xl ${className}`} />;
}
export function GlassSkeletonCard({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return <div aria-hidden="true" className={`glass p-5 space-y-3 ${className}`}><Skeleton className="h-6 w-2/5" />{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-5 ${i === rows - 1 ? 'w-3/4' : 'w-full'}`} />)}</div>;
}
export function DelayedSkeleton({ children, className = '', label = 'Loading' }: { children?: ReactNode; className?: string; label?: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setShown(true), 150); return () => clearTimeout(timer); }, []);
  return <div role="status" aria-label={label} className={`relative ${className}`}><div className={shown ? '' : 'invisible'}>{children || <GlassSkeletonCard />}</div></div>;
}
