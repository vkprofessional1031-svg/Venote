import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export const SlashCommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    }
  }));

  return (
    <div className="glass-panel-modal border border-card-border rounded-xl shadow-2xl overflow-hidden flex flex-col p-1.5 min-w-[180px]">
      {props.items.length ? props.items.map((item: any, index: number) => (
        <button
          className={`flex items-center gap-3 px-4 py-3 md:py-2 text-[15px] md:text-sm text-left rounded-lg transition-colors ${
            index === selectedIndex ? 'bg-primary-accent/15 text-primary-accent font-semibold' : 'text-primary-text/80 hover:bg-surface-brown/50 hover:text-primary-text'
          }`}
          key={index}
          onClick={() => selectItem(index)}
        >
          <span className="text-primary-accent opacity-90 flex items-center justify-center w-4 h-4">{item.icon}</span>
          {item.title}
        </button>
      )) : (
        <div className="px-3 py-2 text-sm text-muted-text">No results</div>
      )}
    </div>
  );
});

SlashCommandList.displayName = 'SlashCommandList';
