'use client';

export interface EmbeddedTask {
  text: string;
  done: boolean;
}

export interface NoteViewProps {
  title: string;
  body: string;
  embeddedTasks?: EmbeddedTask[];
  onToggle?: (index: number) => void;
}

export default function NoteView({ title, body, embeddedTasks = [], onToggle }: NoteViewProps) {
  const handleToggle = (index: number) => {
    if (onToggle) {
      onToggle(index);
    }
  };

  return (
    <div className="w-full bg-card rounded-[24px] border border-hairline overflow-hidden shadow-2xl">
      <div className="p-6 md:p-8 lg:p-10">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-tertiary-accent/10 text-tertiary-accent flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            NOTE
          </span>
        </div>
        
        <h2 className="font-serif italic font-bold text-2xl md:text-4xl text-primary-text mb-6 md:mb-8 tracking-tight leading-snug">
          {title}
        </h2>
        
        <div className="mb-10">
          <p className="font-sans text-primary-text text-lg leading-[1.8] whitespace-pre-wrap">
            {body}
          </p>
        </div>

        {embeddedTasks && embeddedTasks.length > 0 && (
          <div className="mt-10 pt-8 border-t border-hairline">
            <h3 className="font-mono text-xs font-bold text-muted-text uppercase tracking-widest mb-6">
              Related Tasks
            </h3>
            <ul className="space-y-2">
              {embeddedTasks.map((task, index) => (
                <li key={index}>
                  <label className="flex items-start gap-4 p-4 -mx-4 md:p-3 md:-mx-3 rounded-xl hover:bg-background cursor-pointer transition-colors group">
                    <div className="relative flex items-center justify-center pt-0.5 md:pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggle(index)}
                        className="w-5 h-5 cursor-pointer appearance-none rounded border-2 border-muted-text/50 checked:border-primary-accent checked:bg-primary-accent transition-all peer focus:ring-2 focus:ring-primary-accent/30 focus:ring-offset-0 focus:outline-none bg-transparent"
                      />
                      <span className="pointer-events-none absolute top-[6px] text-card opacity-0 peer-checked:opacity-100 transition-opacity">
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </div>
                    <span
                      className={`font-sans text-lg leading-relaxed select-none transition-all duration-200 pt-0.5 ${
                        task.done ? 'text-muted-text line-through' : 'text-primary-text group-hover:text-white'
                      }`}
                    >
                      {task.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
