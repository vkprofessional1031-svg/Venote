'use client';

type SidebarRowActionProps = {
  label: string;
  collapsed: boolean;
  onClick: () => void;
};

export default function SidebarRowAction({ label, collapsed, onClick }: SidebarRowActionProps) {
  return (
    <button data-sidebar-action="" type="button" aria-label={label} title={label} onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-primary-accent/30 bg-primary-accent/15 text-primary-accent hover:bg-primary-accent/25 hover:border-primary-accent/50 active:scale-95 transition-[background-color,border-color,transform] motion-reduce:transition-none motion-reduce:active:transform-none focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 ${collapsed ? 'md:hidden' : ''}`}>
      <svg aria-hidden="true" className="relative z-10 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
