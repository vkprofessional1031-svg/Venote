'use client';
import type { usePipelineProgress } from '@/hooks/usePipelineProgress';

export function PipelineChips({ pipeline, onRetry }: { pipeline: Pick<ReturnType<typeof usePipelineProgress>, 'progress'>; onRetry?: () => void }) {
  const progress = pipeline.progress;
  return <div className="venote-progress min-h-10 min-w-0 flex items-center" aria-live="polite" aria-atomic="true">
    {progress && <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-1 text-[11px]">
      {progress.labels.map((label, i) => {
        const done = progress.finished || i < progress.stage;
        const active = !progress.finished && !progress.waiting && i === progress.stage;
        const error = active && progress.error;
        return <span key={i} aria-label={`${label}: ${error ? 'failed' : done ? 'complete' : active ? 'in progress' : 'pending'}`} className={`glass-chip inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 ${active ? 'text-primary-accent bg-primary-accent/10 border-primary-accent/30' : done ? 'text-primary-accent/70' : 'text-muted-text'}`}>
          {done ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg> : <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full bg-current ${active && !error ? 'motion-safe:animate-pulse' : ''}`} />}
          {error ? 'Failed' : label}
        </span>;
      })}
      {progress.error && <span className="min-w-0 break-words text-muted-text">{progress.error} {onRetry && <button type="button" onClick={onRetry} className="text-primary-accent underline underline-offset-2">Retry</button>}</span>}
    </div>}
  </div>;
}
