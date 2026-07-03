'use client';

export interface TaskItem {
  text: string;
  done: boolean;
}

export interface TaskViewProps {
  title: string;
  items: TaskItem[];
  onToggle?: (index: number) => void;
}

export default function TaskView({ title, items, onToggle }: TaskViewProps) {
  const handleToggle = (index: number) => {
    if (onToggle) {
      onToggle(index);
    }
  };

  return (
    <div className="w-full bg-card rounded-[24px] border border-hairline overflow-hidden shadow-2xl">
      <div className="p-8 md:p-10">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-primary-accent/10 text-primary-accent flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            TASK
          </span>
        </div>

        <h2 className="font-serif italic font-bold text-4xl text-primary-text mb-8 tracking-tight leading-snug">
          {title}
        </h2>
        
        <ul className="space-y-2">
          {items.map((task, index) => (
            <li key={index}>
              <label className="flex items-start gap-4 p-3 -mx-3 rounded-xl hover:bg-background cursor-pointer transition-colors group">
                <div className="relative flex items-center justify-center pt-1 shrink-0">
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

        {(!items || items.length === 0) && (
          <p className="text-muted-text text-sm py-4 text-center italic">
            No items in this list.
          </p>
        )}
      </div>
    </div>
  );
}
