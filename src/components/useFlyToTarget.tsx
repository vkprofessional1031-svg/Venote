"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

type Item = { target: 'wallet' | 'job' | 'organize'; label: string; type: string; entryId?: string };
type Flight = Item & { id: number; x: number; y: number; dx: number; dy: number; targetElement?: HTMLElement };

function visibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  });
}

export function useFlyToTarget() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const animations = useRef<Set<Animation>>(new Set());
  const sequence = useRef(0);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    animations.current.forEach(animation => animation.cancel());
  }, []);

  const fly = useCallback((items: Item[]) => {
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
      timers.current.add(timer);
    };
    const pulse = (element?: HTMLElement) => {
      if (!element?.isConnected) return;
      const animation = element.animate([
        { outline: '2px solid transparent', outlineOffset: '2px' },
        { outline: '2px solid var(--primary-accent)', outlineOffset: '4px', filter: 'drop-shadow(0 0 8px var(--primary-accent))' },
        { outline: '2px solid transparent', outlineOffset: '2px' },
      ], { duration: 400, easing: 'ease-out' });
      animations.current.add(animation);
      animation.onfinish = () => animations.current.delete(animation);
    };
    // Let the saved card commit before measuring. Each chip measures independently.
    items.slice(0, 3).forEach((item, index) => later(() => {
      const target = (item.entryId && visibleTarget(`[data-fly-entry="${CSS.escape(item.entryId)}"]`)) || visibleTarget(`[data-fly-target="${item.target}"]`);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { pulse(target || undefined); return; }
      const source = visibleTarget('[data-fly-source]');
      if (!source) return;
      const start = source.getBoundingClientRect();
      const end = target?.getBoundingClientRect();
      const x = start.left + start.width / 2;
      const y = start.top + start.height / 2;
      const flight: Flight = { ...item, id: ++sequence.current, x, y, dx: end ? end.left + end.width / 2 - x : 0, dy: end ? end.top + end.height / 2 - y : 0, targetElement: target || undefined };
      setFlights(current => [...current, flight]);
      // The chip reaches its destination at 420ms, then fades as the pulse finishes.
      later(() => pulse(flight.targetElement), 420);
      later(() => setFlights(current => current.filter(f => f.id !== flight.id)), 650);
    }, index * 80));
  }, []);

  const overlay = typeof document === 'undefined' ? null : createPortal(
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {flights.map(flight => <motion.div key={flight.id}
        className="absolute" style={{ left: flight.x, top: flight.y }}
        initial={{ x: 0, y: 0, scale: 1, opacity: 0 }}
        animate={{ x: [0, flight.dx * .45, flight.dx, flight.dx], y: [0, flight.dy * .5 - (flight.targetElement ? 56 : 0), flight.dy, flight.dy], scale: [1, 1, .82, .76], opacity: [0, 1, 1, 0] }}
        transition={{ duration: .62, times: [0, .35, .68, 1], ease: 'easeOut' }}>
        <div className="glass-chip flex items-center gap-2 px-3 py-2 text-xs text-primary-text max-w-48 -translate-x-1/2 -translate-y-1/2">
          <span className="text-primary-accent" role="img" aria-label={flight.type}>{flight.target === 'wallet' ? '$' : flight.target === 'job' ? '▣' : flight.type === 'tasks' || flight.type === 'task' ? '✓' : flight.type === 'table' ? '▦' : flight.type === 'roadmap' ? '↗' : '≡'}</span>
          <span className="truncate">{flight.label.slice(0, 36)}</span>
        </div>
      </motion.div>)}
    </div>, document.body);
  return { fly, overlay };
}
