'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PipelineChips } from './PipelineChips';
import { DelayedSkeleton, Skeleton } from './Skeleton';
import type { usePipelineProgress } from '@/hooks/usePipelineProgress';

type Pipeline = Pick<ReturnType<typeof usePipelineProgress>, 'progress'>;

export function AskAssistantBubble({ hasAnswer, pipeline, children }: {
  hasAnswer: boolean;
  pipeline?: Pipeline;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const progress = pipeline?.progress;
  const askProgress = progress?.labels[1] === 'Looking up your data' ? {
    ...progress,
    labels: progress.labels.slice(1),
    stage: Math.max(0, progress.stage - 1),
  } : null;
  const visible = Boolean(askProgress);
  const shownAt = useRef(0);
  const [showAnswer, setShowAnswer] = useState(hasAnswer);

  useEffect(() => {
    if (!hasAnswer && !visible) shownAt.current = 0;
    if (visible && !shownAt.current) shownAt.current = Date.now();
    if (!hasAnswer) { setShowAnswer(false); return; }
    // Hold presentation only: streamed text continues arriving normally underneath.
    const remaining = shownAt.current ? Math.max(0, 250 - (Date.now() - shownAt.current)) : 0;
    if (!remaining) { setShowAnswer(true); return; }
    const timer = setTimeout(() => setShowAnswer(true), remaining);
    return () => clearTimeout(timer);
  }, [hasAnswer, visible]);

  const ready = hasAnswer && showAnswer;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={ready ? 'answer' : 'loading'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.09 }}
        className="w-full max-w-3xl glass rounded-[24px] p-5 md:p-6 relative overflow-hidden group"
      >
        {askProgress && <div className="mb-3 [&>div]:h-auto"><PipelineChips pipeline={{ progress: askProgress }} /></div>}
        {ready ? children : (
          <div className="ask-skeleton" role="status" aria-label="Waiting for answer">
            <DelayedSkeleton label="Preparing answer">
              <div className="space-y-3"><Skeleton className="h-5 w-[85%]" /><Skeleton className="h-5 w-[55%]" /></div>
            </DelayedSkeleton>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
