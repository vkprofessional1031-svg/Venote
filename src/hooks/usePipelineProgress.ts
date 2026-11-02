'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Progress = { labels: string[]; stage: number; finished: boolean; waiting?: boolean; error?: string };
export const PIPELINES = {
  default: ['Routing', 'Structuring', 'Saving'],
  ask: ['Routing', 'Looking up your data', 'Writing answer'],
  receipt: ['Reading receipt', 'Structuring', 'Saving'],
  prep: ['Routing', 'Preparing', 'Saving'],
};

export function usePipelineProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [visible, setVisible] = useState(false);
  const generation = useRef(0);
  const shownAt = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); fn(); }, ms);
    timers.current.add(timer);
  }, []);
  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current.clear();
    generation.current++; shownAt.current = 0; setVisible(false);
  }, []);
  const cancel = useCallback(() => { reset(); setProgress(null); }, [reset]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const begin = useCallback((labels = PIPELINES.default, stage = 0) => {
    reset(); setProgress({ labels, stage, finished: false });
    later(() => { shownAt.current = Date.now(); setVisible(true); }, 400);
  }, [reset, later]);
  const stage = useCallback((index: number) => setProgress(p => p && (p.stage !== index || p.waiting) ? { ...p, stage: index, waiting: false } : p), []);
  const pause = useCallback((index: number) => setProgress(p => p ? { ...p, stage: index, waiting: true } : p), []);
  const labels = useCallback((names: string[]) => setProgress(p => p ? { ...p, labels: names } : p), []);
  const fail = useCallback((message: string) => {
    timers.current.forEach(clearTimeout); timers.current.clear();
    shownAt.current ||= Date.now(); setVisible(true);
    setProgress(p => p ? { ...p, finished: false, waiting: false, error: message.slice(0, 120) } : p);
  }, []);
  const complete = useCallback((onComplete?: () => void) => {
    timers.current.forEach(clearTimeout); timers.current.clear();
    setProgress(p => p ? { ...p, finished: true } : p);
    const run = generation.current;
    // Timing affects presentation only. Stage transitions always come from callers.
    const wait = shownAt.current ? Math.max(0, 250 - (Date.now() - shownAt.current)) : 0;
    later(() => {
      if (generation.current !== run) return;
      onComplete?.(); setVisible(false);
    }, wait);
  }, [later]);
  return { progress: visible ? progress : null, begin, stage, pause, labels, fail, complete, cancel };
}
